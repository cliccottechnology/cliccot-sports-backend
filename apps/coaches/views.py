from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.utils import log_audit
from apps.common.permissions import GranularPermissions, HasPerm
from .models import Coach, CoachAssignment, CoachAvailability, CoachSport, TrainerCertificate, TrainerCheckIn


class TrainerCheckInSerializer(serializers.ModelSerializer):
    session_date = serializers.DateField(source="session.date", read_only=True)
    batch_name = serializers.CharField(source="session.batch.name", read_only=True)

    class Meta:
        model = TrainerCheckIn
        fields = "__all__"
        read_only_fields = ["coach", "marked_by", "marked_at"]


class TrainerCheckInViewSet(viewsets.ModelViewSet):
    """Trainers check in to their OWN assigned sessions only.

    Coaches may list their own check-ins and create one per assigned session.
    Updates/deletes and other coaches' records require coaches.manage.
    """
    serializer_class = TrainerCheckInSerializer
    filterset_fields = ["coach", "session", "status"]

    def get_permissions(self):
        if self.action in ("list", "retrieve", "create"):
            return [IsAuthenticated()]
        return [HasPerm("coaches.manage")]

    def get_queryset(self):
        qs = TrainerCheckIn.objects.select_related("session__batch", "coach").all().order_by("-marked_at")
        user = self.request.user
        if user.is_authenticated and not user.is_superuser and getattr(user, "role", None) and user.role.name == "coach":
            if user.coach_profile_id:
                qs = qs.filter(coach_id=user.coach_profile_id)
            else:
                qs = qs.none()
        return qs

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied, ValidationError
        user = self.request.user
        session = serializer.validated_data["session"]
        privileged = user.is_superuser or user.has_perm_code("coaches.manage")
        if privileged:
            raw_coach = self.request.data.get("coach") or getattr(user, "coach_profile_id", None)
            if raw_coach is None:
                raise ValidationError("coach is required.")
            coach_id = raw_coach.pk if hasattr(raw_coach, "pk") else raw_coach
        else:
            coach_id = getattr(user, "coach_profile_id", None)
            if not coach_id:
                raise PermissionDenied("No coach profile linked to this account.")
            if session.coach_id != coach_id:
                raise PermissionDenied("You can only check in to your own assigned sessions.")
        try:
            obj = serializer.save(coach_id=coach_id, marked_by=user)
        except Exception as e:
            from django.db import IntegrityError
            if isinstance(e, IntegrityError):
                raise ValidationError("Already checked in to this session.")
            raise
        log_audit(self.request, "trainer.checkin", "coaches", f"session:{session.pk}",
                  new={"coach": coach_id, "status": obj.status})

WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def validate_off_days(days):
    """Manual week-off rule: exactly two distinct weekdays (0=Mon..6=Sun)."""
    if days is None:
        return None
    if not isinstance(days, list) or len(days) != 2 or len(set(days)) != 2:
        raise serializers.ValidationError("Choose exactly two weekly off-days.")
    if any(not isinstance(d, int) or d < 0 or d > 6 for d in days):
        raise serializers.ValidationError("Off-days must be weekdays 0 (Mon) to 6 (Sun).")
    return sorted(days)


class CoachSerializer(serializers.ModelSerializer):
    sports = serializers.SerializerMethodField()
    school_name = serializers.CharField(source="school.name", read_only=True)

    class Meta:
        model = Coach
        fields = "__all__"

    def get_sports(self, obj):
        return list(obj.sport_links.values_list("sport__name", flat=True))

    def validate_weekly_off_days(self, value):
        # Empty = unset (preserves older records); any manual selection must be exactly two days.
        if value in (None, []):
            return value
        return validate_off_days(value)


class CoachSportSerializer(serializers.ModelSerializer):
    class Meta:
        model = CoachSport
        fields = "__all__"


class CoachAvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = CoachAvailability
        fields = "__all__"


class CoachAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CoachAssignment
        fields = "__all__"

    def validate(self, attrs):
        from datetime import date
        coach = attrs.get("coach") or getattr(self.instance, "coach", None)
        assigned_from = attrs.get("assigned_from") or getattr(self.instance, "assigned_from", None)
        if coach and assigned_from and isinstance(assigned_from, date):
            if assigned_from.weekday() in (coach.weekly_off_days or []):
                raise serializers.ValidationError("Coach should not normally be assigned on a weekly off-day.")
        return attrs


class CoachViewSet(GranularPermissions, viewsets.ModelViewSet):
    queryset = Coach.objects.select_related("school").all().order_by("first_name")
    serializer_class = CoachSerializer
    perm_module = "coaches"
    filterset_fields = ["is_active", "school"]
    search_fields = ["trainer_id", "first_name", "last_name", "phone", "email"]

    def get_permissions(self):
        # NOTE: action-level `permission_classes` on @action are NOT honored here —
        # this override decides everything, so self-service actions stay public to
        # any signed-in coach while CRUD follows the granular matrix.
        if self.action in ("me", "set_my_off_days", "update_my_profile"):
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        from apps.common.scope import scope_queryset
        return scope_queryset(super().get_queryset(), self.request.user, "school_id")

    def perform_create(self, serializer):
        from apps.common.scope import ensure_school
        given = serializer.validated_data.pop("school", None)
        coach = serializer.save(school_id=ensure_school(self.request, given))
        log_audit(self.request, "coach.create", "coaches", f"coach:{coach.pk}",
                  new={"trainer_id": coach.trainer_id})

    def perform_update(self, serializer):
        old = {f: getattr(serializer.instance, f) for f in ("first_name", "last_name", "phone", "email")}
        coach = serializer.save()
        changed = {f: getattr(coach, f) for f in old if getattr(coach, f) != old[f]}
        if changed:
            # Keep the linked login account in sync so app headers update too.
            from apps.accounts.models import User
            User.objects.filter(coach_profile=coach).update(**{f: v for f, v in changed.items() if f in ("first_name", "last_name", "phone", "email")})
            log_audit(self.request, "coach.update", "coaches", f"coach:{coach.pk}",
                      old={k: old[k] for k in changed}, new=changed)

    @action(detail=False, methods=["get"])
    def me(self, request):
        """Return the logged-in coach's own record (sports, off-days)."""
        coach_id = getattr(request.user, "coach_profile_id", None)
        if not coach_id:
            return Response({"detail": "No coach profile linked to this account."}, status=404)
        try:
            coach = Coach.objects.get(pk=coach_id)
        except Coach.DoesNotExist:
            return Response({"detail": "No coach profile linked to this account."}, status=404)
        return Response(self.get_serializer(coach).data)

    @action(detail=False, methods=["patch"])
    def update_my_profile(self, request):
        """Self-service edit: coaches may update their own contact details only.

        Accepted: first_name, last_name, phone, email, photo (image upload).
        Everything else (trainer_id, sports, assignments, status) is ignored —
        admin-managed. The linked login account is synced so headers stay
        consistent.
        """
        coach_id = getattr(request.user, "coach_profile_id", None)
        if not coach_id:
            return Response({"detail": "No coach profile linked to this account."}, status=404)
        try:
            coach = Coach.objects.get(pk=coach_id)
        except Coach.DoesNotExist:
            return Response({"detail": "No coach profile linked to this account."}, status=404)
        changed = {}
        photo = request.data.get("photo")
        if photo is not None and hasattr(photo, "read"):
            from django.conf import settings as dj_settings
            ext = (getattr(photo, "name", "").rsplit(".", 1)[-1] if "." in getattr(photo, "name", "") else "").lower()
            if ext not in ("jpg", "jpeg", "png", "webp"):
                return Response({"detail": "Photo must be JPG, PNG, or WEBP."}, status=400)
            if getattr(photo, "size", 0) > int(getattr(dj_settings, "MAX_UPLOAD_SIZE_MB", 10)) * 1024 * 1024:
                return Response({"detail": "Photo too large (max 10 MB)."}, status=400)
            coach.photo.save(getattr(photo, "name", "coach.jpg"), photo, save=False)
            changed["photo"] = coach.photo.name
        for field in ("first_name", "last_name", "phone", "email"):
            if field in request.data:
                value = request.data.get(field) or ""
                value = str(value).strip()
                if field == "email" and value:
                    from django.core.exceptions import ValidationError as VE
                    from django.core.validators import validate_email
                    try:
                        validate_email(value)
                    except VE:
                        return Response({"detail": "Enter a valid email address."}, status=400)
                if getattr(coach, field) != value:
                    setattr(coach, field, value)
                    changed[field] = value
        if changed:
            coach.save(update_fields=list(changed))
            user = request.user
            for field in ("first_name", "last_name", "phone", "email"):
                if field in changed and hasattr(user, field):
                    setattr(user, field, changed[field])
            user.save(update_fields=[f for f in changed if hasattr(user, f)] or ["username"])
            log_audit(request, "coach.profile_update", "coaches", f"coach:{coach.pk}", new=changed)
        return Response({
            "coach": self.get_serializer(coach).data,
            "user": {"first_name": request.user.first_name, "last_name": request.user.last_name,
                     "email": request.user.email, "phone": getattr(request.user, "phone", "")},
            "changed": changed,
        })

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated])
    def set_my_off_days(self, request):
        """Let a trainer manually pick their own two weekly off-days (0=Mon..6=Sun)."""
        coach_id = getattr(request.user, "coach_profile_id", None)
        if not coach_id:
            return Response({"detail": "No coach profile linked to this account."}, status=404)
        try:
            coach = Coach.objects.get(pk=coach_id)
        except Coach.DoesNotExist:
            return Response({"detail": "No coach profile linked to this account."}, status=404)
        try:
            days = validate_off_days(request.data.get("weekly_off_days"))
        except serializers.ValidationError as e:
            return Response({"detail": e.detail[0] if isinstance(e.detail, list) else e.detail}, status=400)
        if days is None:
            return Response({"detail": "weekly_off_days is required: pick exactly two days."}, status=400)
        old = list(coach.weekly_off_days or [])
        coach.weekly_off_days = days
        coach.save(update_fields=["weekly_off_days"])
        log_audit(request, "coach.offdays_set", "coaches", f"coach:{coach.pk}",
                  old={"weekly_off_days": old}, new={"weekly_off_days": days})
        return Response(self.get_serializer(coach).data)


class TrainerCertificateSerializer(serializers.ModelSerializer):
    trainer_name = serializers.CharField(source="trainer.first_name", read_only=True)

    class Meta:
        model = TrainerCertificate
        fields = "__all__"
        read_only_fields = ["sessions_completed", "issued_by", "issued_at"]


def _render_certificate_pdf(cert):
    """Institute certificate PDF. Returns bytes (reportlab)."""
    from io import BytesIO
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(w / 2, h - 140, "Certificate of Achievement")
    c.setFont("Helvetica", 13)
    c.drawCentredString(w / 2, h - 175, cert.title)
    c.setFont("Helvetica", 15)
    name = f"{cert.trainer.first_name} {cert.trainer.last_name or ''}".strip()
    c.drawCentredString(w / 2, h - 230, f"Presented to {name} ({cert.trainer.trainer_id})")
    c.setFont("Helvetica", 12)
    c.drawCentredString(
        w / 2, h - 260,
        f"For {cert.sessions_completed} completed sessions "
        f"({cert.period_from} to {cert.period_to})")
    if cert.description:
        c.setFont("Helvetica-Oblique", 11)
        c.drawCentredString(w / 2, h - 285, cert.description[:120])
    c.setFont("Helvetica", 11)
    c.drawCentredString(w / 2, 120, f"Issued {cert.issued_at.date() if cert.issued_at else ''}")
    c.save()
    return buf.getvalue()


class TrainerCertificateViewSet(GranularPermissions, viewsets.ModelViewSet):
    queryset = TrainerCertificate.objects.select_related("trainer").all()
    serializer_class = TrainerCertificateSerializer
    perm_module = "coaches"
    list_perm = "coaches.view"
    retrieve_perm = "coaches.view"
    create_perm = "coaches.manage"
    edit_perm = "coaches.manage"
    destroy_perm = "coaches.manage"
    permission_classes = [HasPerm("coaches.manage")]
    filterset_fields = ["trainer"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_authenticated and not user.is_superuser and getattr(user, "role", None) and user.role.name == "coach":
            if user.coach_profile_id:
                return qs.filter(trainer_id=user.coach_profile_id)
            return qs.none()
        return qs

    def perform_create(self, serializer):
        obj = serializer.save(issued_by=self.request.user)
        log_audit(self.request, "coach.certificate_issue", "coaches", f"cert:{obj.pk}",
                  new={"trainer": obj.trainer_id, "title": obj.title})

    @action(detail=False, methods=["post"], permission_classes=[HasPerm("coaches.manage")])
    def generate(self, request):
        """Issue a certificate for completed sessions in a period (default: last 3 months).

        Body: {trainer, period_from?, period_to?, title?, description?}.
        The session count snapshots at issue; a PDF is generated and attached.
        """
        from datetime import date as d
        from django.core.files.base import ContentFile
        from apps.sessions.models import Session
        trainer_id = request.data.get("trainer")
        if not trainer_id:
            return Response({"detail": "trainer is required."}, status=400)
        try:
            coach = Coach.objects.get(pk=trainer_id)
        except Coach.DoesNotExist:
            return Response({"detail": "Trainer not found."}, status=404)
        to_date = d.fromisoformat(request.data["period_to"]) if request.data.get("period_to") else d.today()
        frm = request.data.get("period_from")
        if frm:
            period_from = d.fromisoformat(frm)
        else:
            # Default: the last 3 calendar months including the current one.
            from datetime import timedelta
            first = to_date.replace(day=1)
            period_from = (first - timedelta(days=1)).replace(day=1)
            period_from = (period_from - timedelta(days=1)).replace(day=1)
        count = Session.objects.filter(coach=coach, status="completed",
                                       date__gte=period_from, date__lte=to_date).count()
        cert = TrainerCertificate.objects.create(
            trainer=coach,
            title=request.data.get("title") or "Certificate of Service Excellence",
            period_from=period_from, period_to=to_date,
            sessions_completed=count,
            description=request.data.get("description", ""),
            issued_by=request.user)
        pdf = _render_certificate_pdf(cert)
        fname = f"certificate_{coach.trainer_id}_{period_from}_{to_date}.pdf"
        cert.file.save(fname, ContentFile(pdf))
        log_audit(request, "coach.certificate_issue", "coaches", f"cert:{cert.pk}",
                  new={"trainer": coach.pk, "sessions": count})
        return Response(self.get_serializer(cert).data, status=201)


class CoachSportViewSet(GranularPermissions, viewsets.ModelViewSet):
    queryset = CoachSport.objects.select_related("coach", "sport").all()
    serializer_class = CoachSportSerializer
    perm_module = "coaches"
    permission_classes = [HasPerm("coaches.manage")]
    filterset_fields = ["coach", "sport"]


class CoachAvailabilityViewSet(GranularPermissions, viewsets.ModelViewSet):
    queryset = CoachAvailability.objects.select_related("coach").all()
    serializer_class = CoachAvailabilitySerializer
    perm_module = "coaches"
    permission_classes = [HasPerm("coaches.manage")]
    filterset_fields = ["coach", "weekday"]


class CoachAssignmentViewSet(GranularPermissions, viewsets.ModelViewSet):
    queryset = CoachAssignment.objects.select_related("coach", "batch").all()
    serializer_class = CoachAssignmentSerializer
    perm_module = "coaches"
    permission_classes = [HasPerm("coaches.manage")]
    filterset_fields = ["coach", "batch", "is_primary"]
