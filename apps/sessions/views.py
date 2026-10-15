from django.db import transaction
from django_filters import rest_framework as filters
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.utils import log_audit
from apps.common.permissions import GranularPermissions, HasPerm
from .models import Session, SessionStudent


class SessionStudentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.first_name", read_only=True)
    student_ref = serializers.CharField(source="student.student_id", read_only=True)

    class Meta:
        model = SessionStudent
        fields = "__all__"


class SessionSerializer(serializers.ModelSerializer):
    assigned = SessionStudentSerializer(many=True, read_only=True)
    batch_name = serializers.CharField(source="batch.name", read_only=True)
    sport_name = serializers.CharField(source="sport.name", read_only=True)
    location_name = serializers.SerializerMethodField()
    coach_name = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = "__all__"

    def get_location_name(self, obj):
        return obj.location.name if obj.location_id else ""

    def get_coach_name(self, obj):
        return f"{obj.coach.first_name} {obj.coach.last_name}".strip() if obj.coach_id else ""

    def validate(self, attrs):
        sport = attrs.get("sport") or getattr(self.instance, "sport", None)
        if sport and not sport.is_active:
            raise serializers.ValidationError("Inactive sports cannot be used for sessions.")
        coach = attrs.get("coach") or getattr(self.instance, "coach", None)
        date = attrs.get("date") or getattr(self.instance, "date", None)
        if coach and date and coach.weekly_off_days and date.weekday() in coach.weekly_off_days:
            raise serializers.ValidationError("Coach is on weekly off on this date.")
        # academy-wide week off (Settings → academy.week_off_days, Mon=0..Sun=6).
        # Enforced only when scheduling (create or date change) so existing
        # rows never block unrelated edits. An explicit allow_off_day flag
        # (admin-confirmed exceptional scheduling, e.g. holiday camp) bypasses.
        if date and (not self.instance or "date" in attrs):
            req = self.context.get("request")
            override = False
            try:
                override = bool(req and req.data.get("allow_off_day"))
            except Exception:
                override = False
            if not override:
                try:
                    from apps.academy.models import AcademySetting
                    row = AcademySetting.objects.filter(key="academy.week_off_days").first()
                    offs = (row.value if row else []) or []
                    if date.weekday() in [int(x) for x in offs]:
                        raise serializers.ValidationError(
                            f"Academy week off ({date.strftime('%A')}). Remove the day in Settings to schedule.")
                except serializers.ValidationError:
                    raise
                except Exception:
                    pass  # settings table unavailable → skip this check
        # conflict: same coach overlapping same date (any sport)
        if coach and date and (attrs.get("start_time") or getattr(self.instance, "start_time", None)):
            st = attrs.get("start_time") or self.instance.start_time
            en = attrs.get("end_time") or self.instance.end_time
            qs = Session.objects.filter(coach=coach, date=date, status__in=["scheduled", "in_progress"])
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            for s in qs.select_related("sport", "batch"):
                if st < s.end_time and en > s.start_time:
                    cname = f"{coach.first_name} {coach.last_name or ''}".strip()
                    where = f"{s.sport.name + ' · ' if s.sport_id else ''}{s.batch.name if s.batch_id else ''}".strip(" ·")
                    raise serializers.ValidationError(
                        f"Coach {cname} is already assigned to another session from "
                        f"{s.start_time.strftime('%I:%M %p')} to {s.end_time.strftime('%I:%M %p')}"
                        f"{f' ({where})' if where else ''}. "
                        f"Please select another available coach or change the session timing.")
        # academy-wide daily slots: only one session per (date, slot).
        # Enforced only when scheduling (create or date/slot change) so legacy
        # rows never block unrelated edits.
        if not self.instance or "slot" in attrs or "date" in attrs:
            slot = attrs.get("slot")
            if slot is None:
                slot = getattr(self.instance, "slot", 1) if self.instance else 1
            if date and slot:
                qs = Session.objects.filter(date=date, slot=slot)
                if self.instance:
                    qs = qs.exclude(pk=self.instance.pk)
                if qs.exists():
                    raise serializers.ValidationError(
                        f"Session {slot} is already scheduled for {date}. The academy runs 3 sessions per day.")
        return attrs


class SessionFilter(filters.FilterSet):
    student = filters.NumberFilter(field_name="assigned__student", label="Assigned student pk")
    date__gte = filters.DateFilter(field_name="date", lookup_expr="gte")
    date__lte = filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = Session
        fields = ["sport", "batch", "coach", "date", "status", "slot",
                  "student", "date__gte", "date__lte"]


class SessionViewSet(GranularPermissions, viewsets.ModelViewSet):
    serializer_class = SessionSerializer
    perm_module = "sessions"
    extra_action_perms = {"my_sessions": "sessions.view", "today": "sessions.view",
                          "change_status": "sessions.edit",
                          "available_coaches": "sessions.view"}
    filterset_class = SessionFilter
    search_fields = ["batch__name", "notes"]
    ordering_fields = ["date", "start_time", "slot"]

    def get_queryset(self):
        from apps.common.scope import scope_queryset, scope_to_parent
        qs = Session.objects.select_related("sport", "batch", "coach", "location").prefetch_related("assigned__student").all().order_by("-date")
        user = self.request.user
        # Trainers see only assigned sessions
        if user.is_authenticated and not user.is_superuser and getattr(user, "role", None) and user.role.name == "coach":
            if user.coach_profile_id:
                qs = qs.filter(coach_id=user.coach_profile_id)
            else:
                qs = qs.none()
        qs = scope_to_parent(qs, user, "assigned__student_id")
        return scope_queryset(qs, user, "batch__school_id").distinct()

    # NOTE: GranularPermissions.get_permissions decides everything, including
    # the my_sessions / today / change_status actions mapped above.

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError as DRFValidationError
        with transaction.atomic():
            session = serializer.save()
            # Race-safe re-check: lock this coach's live sessions for the day
            # and reject an overlap that slipped past validation.
            clash = (Session.objects.select_for_update().filter(
                coach=session.coach, date=session.date,
                status__in=["scheduled", "in_progress"]).exclude(pk=session.pk))
            for s in clash:
                if session.start_time < s.end_time and session.end_time > s.start_time:
                    raise DRFValidationError(
                        f"Coach {session.coach.first_name} was just assigned to an overlapping "
                        f"session ({s.start_time.strftime('%I:%M %p')}–{s.end_time.strftime('%I:%M %p')}). "
                        f"Pick another coach or timing.")
            # snapshot roster from batch
            roster = session.batch.rosters.filter(is_active=True).values_list("student_id", flat=True)
            SessionStudent.objects.bulk_create(
                [SessionStudent(session=session, student_id=sid) for sid in roster],
                ignore_conflicts=True,
            )
            log_audit(self.request, "session.create", "sessions", f"session:{session.pk}",
                      new={"batch": session.batch.name, "date": str(session.date),
                           "off_day_override": bool(self.request.data.get("allow_off_day"))})

    @action(detail=False, methods=["get"])
    def available_coaches(self, request):
        """Eligible alternative coaches for a sport + date + time window.

        Filters: sport (pk, required), date (YYYY-MM-DD, required),
        start_time, end_time (HH:MM, required), exclude_session (pk, optional).
        A coach qualifies when: active, qualified for the sport (CoachSport),
        not on weekly off that weekday, and holding no overlapping live session
        (any sport). Academy scoping applies.
        """
        from datetime import datetime
        from apps.coaches.models import Coach, CoachSport
        from apps.common.scope import user_school_id
        sport_id = request.query_params.get("sport")
        date_raw = request.query_params.get("date")
        start_raw = request.query_params.get("start_time")
        end_raw = request.query_params.get("end_time")
        if not (sport_id and date_raw and start_raw and end_raw):
            return Response(
                {"detail": "sport, date, start_time and end_time are required."}, status=400)
        try:
            day = datetime.strptime(date_raw, "%Y-%m-%d").date()
            st = datetime.strptime(start_raw, "%H:%M").time()
            en = datetime.strptime(end_raw, "%H:%M").time()
        except ValueError:
            return Response({"detail": "Use date YYYY-MM-DD and times HH:MM."}, status=400)
        if en <= st:
            return Response({"detail": "end_time must be after start_time."}, status=400)
        sid = user_school_id(request.user)
        coaches = Coach.objects.filter(is_active=True)
        if sid is not None and hasattr(Coach, "school_id"):
            coaches = coaches.filter(school_id=sid)
        qualified = set(CoachSport.objects.filter(sport_id=sport_id).values_list("coach_id", flat=True))
        busy = set(Session.objects.filter(
            date=day, status__in=["scheduled", "in_progress"],
            start_time__lt=en, end_time__gt=st,
        ).exclude(pk=request.query_params.get("exclude_session") or 0).values_list("coach_id", flat=True))
        # Configured availability windows: when a coach has
        # CoachAvailability rows for this weekday, the requested
        # window must sit fully inside one of them. Coaches with
        # no rows configured are unconstrained by windows.
        from apps.coaches.models import CoachAvailability
        window_ok = set()
        for c in coaches:
            if c.pk in busy:
                continue
            windows = CoachAvailability.objects.filter(
                coach=c, weekday=day.weekday(), is_available=True)
            if not windows.exists():
                window_ok.add(c.pk)
                continue
            for w in windows:
                if w.start_time <= st and en <= w.end_time:
                    window_ok.add(c.pk)
                    break
        out = []
        for c in coaches:
            if c.pk not in qualified:
                continue
            if (c.weekly_off_days or []) and day.weekday() in list(c.weekly_off_days):
                continue
            if c.pk in busy:
                continue
            if c.pk not in window_ok:
                continue
            out.append({"id": c.pk, "trainer_id": c.trainer_id,
                        "name": f"{c.first_name} {c.last_name or ''}".strip()})
        return Response({"date": date_raw, "available": out, "count": len(out)})

    @action(detail=False, methods=["get"])
    def my_sessions(self, request):
        qs = self.get_queryset()
        date = request.query_params.get("date")
        if date:
            qs = qs.filter(date=date)
        page = self.paginate_queryset(qs)
        ser = self.get_serializer(page or qs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)

    @action(detail=False, methods=["get"])
    def today(self, request):
        from datetime import date as d
        qs = self.get_queryset().filter(date=d.today())
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)

    @action(detail=True, methods=["post"], permission_classes=[HasPerm("sessions.manage")])
    def change_status(self, request, pk=None):
        session = self.get_object()
        new_status = request.data.get("status")
        if new_status not in dict([("scheduled", ""), ("in_progress", ""), ("completed", ""), ("cancelled", "")]):
            return Response({"detail": "Invalid status."}, status=400)
        old = session.status
        session.status = new_status
        session.save(update_fields=["status"])
        log_audit(request, "session.status", "sessions", f"session:{session.pk}", old={"status": old}, new={"status": new_status})
        return Response(self.get_serializer(session).data)
