from django.db import transaction
from rest_framework import parsers, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.utils import log_audit
from apps.common.permissions import HasPerm
from .models import AttendanceCorrection, AttendanceRecord


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.first_name", read_only=True)
    student_ref = serializers.CharField(source="student.student_id", read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = "__all__"
        read_only_fields = ["marked_by", "marked_at", "updated_at"]

    def validate(self, attrs):
        session = attrs.get("session") or getattr(self.instance, "session", None)
        student = attrs.get("student") or getattr(self.instance, "student", None)
        if session and student and not session.assigned.filter(student=student).exists():
            raise serializers.ValidationError("Student is not in this session's roster.")
        return attrs


class AttendanceCorrectionSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="record.student.first_name", read_only=True)
    session = serializers.IntegerField(source="record.session_id", read_only=True)
    corrected_by_name = serializers.CharField(source="corrected_by.username", read_only=True, default="")

    class Meta:
        model = AttendanceCorrection
        fields = "__all__"
        read_only_fields = ["corrected_by", "created_at"]


class AttendanceCorrectionViewSet(viewsets.ReadOnlyModelViewSet):
    """Coach-visible correction audit trail (read-only)."""
    serializer_class = AttendanceCorrectionSerializer
    permission_classes = [HasPerm("attendance.view")]
    filterset_fields = ["record", "record__session"]

    def get_queryset(self):
        qs = AttendanceCorrection.objects.select_related(
            "record__session", "record__student", "corrected_by").all().order_by("-created_at")
        user = self.request.user
        if user.is_authenticated and not user.is_superuser and getattr(user, "role", None) and user.role.name == "coach":
            if user.coach_profile_id:
                qs = qs.filter(record__session__coach_id=user.coach_profile_id)
            else:
                qs = qs.none()
        from apps.common.scope import scope_queryset
        return scope_queryset(qs, user, "record__session__batch__school_id")


class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceRecordSerializer
    filterset_fields = ["session", "student", "status"]
    search_fields = ["student__first_name", "student__student_id"]

    def get_queryset(self):
        from apps.common.scope import scope_queryset, scope_to_parent
        qs = AttendanceRecord.objects.select_related("session", "student").all().order_by("-marked_at")
        user = self.request.user
        if user.is_authenticated and not user.is_superuser and getattr(user, "role", None) and user.role.name == "coach":
            if user.coach_profile_id:
                qs = qs.filter(session__coach_id=user.coach_profile_id)
            else:
                qs = qs.none()
        session_id = self.request.query_params.get("session")
        if session_id:
            qs = qs.filter(session_id=session_id)
        qs = scope_to_parent(qs, user, "student_id")
        return scope_queryset(qs, user, "session__batch__school_id")

    def get_permissions(self):
        # NOTE: @action-level classes are NOT honored here — mapped below.
        if self.action in ("list", "retrieve", "roster"):
            return [HasPerm("attendance.view")]
        if self.action in ("bulk_mark", "photo_analyze", "create"):
            return [HasPerm("attendance.mark")]
        return [HasPerm("attendance.correct")]

    def perform_create(self, serializer):
        serializer.save(marked_by=self.request.user)

    def perform_update(self, serializer):
        rec = self.get_object()
        if rec.locked and not self.request.user.has_perm_code("attendance.correct"):
            raise serializers.ValidationError("Record is locked. Correction permission required.")
        old = rec.status
        new = serializer.validated_data.get("status", old)
        obj = serializer.save()
        if old != new:
            reason = self.request.data.get("reason", "")
            if not reason and self.request.user.has_perm_code("attendance.correct"):
                raise serializers.ValidationError("Correction requires a reason.")
            AttendanceCorrection.objects.create(record=obj, old_status=old, new_status=new,
                                                reason=reason or "marked", corrected_by=self.request.user)
            log_audit(self.request, "attendance.correct", "attendance", f"attendance:{obj.pk}",
                      old={"status": old}, new={"status": new, "reason": reason})

    @action(detail=False, methods=["get"])
    def roster(self, request):
        """Return session roster with current attendance — mobile-friendly fast path."""
        from apps.common.scope import user_school_id
        session_id = request.query_params.get("session")
        if not session_id:
            return Response({"detail": "session query param required."}, status=400)
        sid = user_school_id(request.user)
        if sid is not None:
            from apps.sessions.models import Session as _Session
            if not _Session.objects.filter(pk=session_id, batch__school_id=sid).exists():
                return Response({"detail": "Outside your school's scope."}, status=403)
        from apps.sessions.models import SessionStudent
        from apps.common.scope import parent_student_ids
        allowed = parent_student_ids(request.user)
        assigned = SessionStudent.objects.filter(session_id=session_id).select_related("student")
        if allowed is not None:
            # Parents may only see roster rows for their own linked students.
            assigned = assigned.filter(student_id__in=allowed)
        existing = {a.student_id: a for a in AttendanceRecord.objects.filter(session_id=session_id)}
        from apps.students.models import StudentReferencePhoto
        with_ref = set(StudentReferencePhoto.objects.filter(
            student_id__in=[l.student_id for l in assigned], is_active=True
        ).values_list("student_id", flat=True))
        rows = []
        for link in assigned:
            rec = existing.get(link.student_id)
            try:
                photo_url = request.build_absolute_uri(link.student.photo.url) if link.student.photo else None
            except (ValueError, AttributeError):
                photo_url = None
            rows.append({
                "student": link.student_id,
                "student_id": link.student.student_id,
                "name": f"{link.student.first_name} {link.student.last_name}".strip(),
                "status": rec.status if rec else "not_marked",
                "record_id": rec.pk if rec else None,
                "photo": photo_url,
                "has_reference": link.student_id in with_ref,
            })
        return Response({"session": session_id, "roster": rows})

    @action(detail=False, methods=["post"], permission_classes=[HasPerm("attendance.mark")])
    def bulk_mark(self, request):
        """Mark attendance for a whole session in one call. Idempotent per (session, student)."""
        session_id = request.data.get("session")
        items = request.data.get("items", [])
        if not session_id or not isinstance(items, list):
            return Response({"detail": "session and items[] required."}, status=400)
        from apps.sessions.models import Session
        try:
            session = Session.objects.get(pk=session_id)
        except Session.DoesNotExist:
            return Response({"detail": "Session not found."}, status=404)
        # trainer scope check
        user = request.user
        if not user.is_superuser and getattr(user, "role", None) and user.role.name == "coach":
            if user.coach_profile_id != session.coach_id:
                return Response({"detail": "Not your session."}, status=403)
        # school scope check
        from apps.common.scope import user_school_id
        sid = user_school_id(user)
        if sid is not None and session.batch.school_id != sid:
            return Response({"detail": "Outside your school's scope."}, status=403)
        roster_ids = set(session.assigned.values_list("student_id", flat=True))
        results = []
        with transaction.atomic():
            for item in items:
                sid = item.get("student")
                st = item.get("status", "present")
                if sid not in roster_ids:
                    results.append({"student": sid, "error": "not in roster"})
                    continue
                if st not in ("present", "absent", "late", "leave", "not_marked"):
                    results.append({"student": sid, "error": "invalid status"})
                    continue
                rec, created = AttendanceRecord.objects.get_or_create(
                    session_id=session_id, student_id=sid,
                    defaults={"status": st, "marked_by": user})
                if not created:
                    if rec.locked and not user.has_perm_code("attendance.correct"):
                        results.append({"student": sid, "error": "locked"})
                        continue
                    if rec.status != st:
                        AttendanceCorrection.objects.create(
                            record=rec, old_status=rec.status, new_status=st,
                            reason=request.data.get("reason", "bulk mark"), corrected_by=user)
                        rec.status = st
                        rec.marked_by = user
                        rec.save(update_fields=["status", "marked_by", "updated_at"])
                results.append({"student": sid, "status": rec.status, "created": created})
        log_audit(request, "attendance.bulk_mark", "attendance", f"session:{session_id}", new={"count": len(results)})
        return Response({"session": session_id, "results": results})

    @action(detail=False, methods=["post"], permission_classes=[HasPerm("attendance.mark")],
            parser_classes=[parsers.MultiPartParser, parsers.FormParser])
    def photo_analyze(self, request):
        """Analyze a session group photo and return per-student suggestions.

        Accepts multipart ``session`` + ``photo``. Never writes attendance
        records — the coach confirms suggestions on the review screen and the
        app then calls ``bulk_mark``. The photo is stored as audit evidence.
        """
        from io import BytesIO

        from django.conf import settings as dj_settings
        from django.core.files.base import ContentFile
        from PIL import Image, ImageStat, UnidentifiedImageError

        from apps.sessions.models import Session, SessionStudent
        from .models import AttendancePhotoEvidence
        from .vision import SUGGESTION_CHOICES, dhash_hex, get_provider, hamming_hex

        session_id = request.data.get("session")
        photo = request.data.get("photo")
        if not session_id or photo is None:
            return Response({"detail": "session and photo required."}, status=400)
        try:
            session = Session.objects.get(pk=session_id)
        except (Session.DoesNotExist, ValueError):
            return Response({"detail": "Session not found."}, status=404)
        user = request.user
        if not user.is_superuser and getattr(user, "role", None) and user.role.name == "coach":
            if user.coach_profile_id != session.coach_id:
                return Response({"detail": "Not your session."}, status=403)
        from apps.common.scope import user_school_id as _school_of
        _sid = _school_of(user)
        if _sid is not None and session.batch.school_id != _sid:
            return Response({"detail": "Outside your school's scope."}, status=403)
        max_bytes = int(getattr(dj_settings, "MAX_UPLOAD_SIZE_MB", 10)) * 1024 * 1024
        if getattr(photo, "size", 0) > max_bytes:
            return Response({"detail": f"Photo exceeds {max_bytes // (1024 * 1024)} MB."}, status=400)
        try:
            raw = photo.read()
            img = Image.open(BytesIO(raw))
            img.verify()
            img = Image.open(BytesIO(raw))  # reopen after verify() closes the parser
            width, height = img.size
            fmt = (img.format or "").upper()
        except (UnidentifiedImageError, OSError, ValueError):
            return Response({"detail": "Upload a valid JPEG, PNG, or WEBP photo."}, status=400)
        if fmt not in ("JPEG", "JPG", "PNG", "WEBP"):
            return Response({"detail": "Upload a valid JPEG, PNG, or WEBP photo."}, status=400)
        if width < 320 or height < 320:
            return Response({"detail": "Photo is too small. Capture at least 320x320."}, status=400)
        gray = img.convert("L")
        stats = ImageStat.Stat(gray)
        brightness = round(stats.mean[0], 1)
        contrast = round(stats.stddev[0], 1)
        quality_notes = []
        if brightness < 45:
            quality_notes.append("Poor lighting detected (dark image). Retake in better light for reliable review.")
        elif brightness > 215:
            quality_notes.append("Image looks overexposed. Avoid harsh backlight and retake if faces are washed out.")
        if contrast < 22:
            quality_notes.append("Low contrast detected (hazy or blurry). Hold steady and retake a sharper photo.")
        quality = {"brightness": brightness, "contrast": contrast, "width": width, "height": height}
        name_map = {link.student_id: link for link in
                    SessionStudent.objects.filter(session=session).select_related("student")}
        if not name_map:
            return Response({"detail": "Session has no roster to analyze against."}, status=400)
        evidence = AttendancePhotoEvidence.objects.create(
            session=session, provider=getattr(dj_settings, "ATTENDANCE_VISION_PROVIDER", "pilot"),
            width=width, height=height, uploaded_by=user,
            image=ContentFile(raw, name=getattr(photo, "name", "session-photo.jpg")),
        )
        # Duplicate detection: same/near-identical photo submitted before for this session.
        photo_hash = dhash_hex(img)
        evidence.dhash = photo_hash
        evidence.save(update_fields=["dhash"])
        possible_duplicate = AttendancePhotoEvidence.objects.filter(
            session=session, dhash__isnull=False).exclude(pk=evidence.pk).order_by("-created_at")[:10]
        dup_of = None
        for prev in possible_duplicate:
            try:
                if prev.dhash and hamming_hex(photo_hash, prev.dhash) <= 6:
                    dup_of = prev.pk
                    break
            except ValueError:
                continue
        # Reference-photo enrollment status per roster student.
        from apps.students.models import StudentReferencePhoto
        with_ref = set(StudentReferencePhoto.objects.filter(
            student_id__in=list(name_map), is_active=True, consent_given=True
        ).values_list("student_id", flat=True))
        try:
            result = get_provider().analyze(evidence.image, sorted(name_map))
        except ValueError as e:
            evidence.delete()
            return Response({"detail": str(e)}, status=500)
        if evidence.provider != result.provider:
            evidence.provider = result.provider
            evidence.persons_detected = result.persons_detected
            evidence.save(update_fields=["provider", "persons_detected"])
        suggestions = []
        for s in result.suggestions:
            if s.suggestion not in SUGGESTION_CHOICES or s.student_id not in name_map:
                continue
            link = name_map[s.student_id]
            suggestions.append({
                "student": s.student_id,
                "name": f"{link.student.first_name} {link.student.last_name}".strip(),
                "student_ref": link.student.student_id,
                "suggestion": s.suggestion,
                "confidence": s.confidence,
                "reason": s.reason,
                "has_reference": s.student_id in with_ref,
            })
        notes = result.notes + quality_notes
        if dup_of:
            notes.append(f"This photo looks like a duplicate of an earlier submission (evidence #{dup_of}).")
        log_audit(request, "attendance.photo_analyze", "attendance", f"session:{session.pk}",
                  new={"photo": evidence.pk, "provider": result.provider})
        return Response({
            "session": session.pk,
            "photo_id": evidence.pk,
            "photo_url": evidence.image.url if evidence.image else None,
            "provider": result.provider,
            "persons_detected": result.persons_detected,
            "unrecognized_count": result.unrecognized_count,
            "possible_duplicate": dup_of,
            "quality": quality,
            "notes": notes,
            "suggestions": suggestions,
        })
