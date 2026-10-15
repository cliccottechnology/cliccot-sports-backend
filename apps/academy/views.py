from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.utils import log_audit
from apps.common.permissions import GranularPermissions, HasPerm
from .models import (AcademyAchievement, AcademySetting, School, SessionType, Sport, SportCategory,
                     TrainingLocation)


class SchoolSerializer(serializers.ModelSerializer):
    student_count = serializers.SerializerMethodField()
    batch_count = serializers.SerializerMethodField()
    coach_count = serializers.SerializerMethodField()
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = School
        fields = "__all__"

    def get_student_count(self, obj):
        return obj.students.count()

    def get_batch_count(self, obj):
        return obj.batches.count()

    def get_coach_count(self, obj):
        return obj.coaches.count()

    def get_user_count(self, obj):
        return obj.users.count()


class SchoolViewSet(GranularPermissions, viewsets.ModelViewSet):
    """Onboarded schools. Only super admins manage them (plus holders of
    schools.manage); school admins never see this module."""
    queryset = School.objects.all().order_by("name")
    serializer_class = SchoolSerializer
    perm_module = "schools"
    filterset_fields = ["is_active"]
    search_fields = ["name", "code"]

    def perform_create(self, serializer):
        obj = serializer.save()
        log_audit(self.request, "school.create", "schools", f"school:{obj.pk}", new={"name": obj.name})

    def perform_update(self, serializer):
        obj = self.get_object()
        old = {"name": obj.name, "is_active": obj.is_active}
        obj = serializer.save()
        log_audit(self.request, "school.update", "schools", f"school:{obj.pk}", old=old,
                  new={"name": obj.name, "is_active": obj.is_active})

    def perform_destroy(self, instance):
        from rest_framework.exceptions import ValidationError
        members = (instance.students.count() + instance.batches.count()
                   + instance.coaches.count() + instance.users.count())
        if members:
            raise ValidationError("School still has students, batches, coaches or users. Move or remove them first.")
        log_audit(self.request, "school.delete", "schools", f"school:{instance.pk}",
                  old={"name": instance.name})
        instance.delete()


class SportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sport
        fields = "__all__"


class SportCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SportCategory
        fields = "__all__"


class TrainingLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingLocation
        fields = "__all__"


class SessionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionType
        fields = "__all__"


class AcademySettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademySetting
        fields = "__all__"


class SportViewSet(GranularPermissions, viewsets.ModelViewSet):
    queryset = Sport.objects.all().order_by("name")
    serializer_class = SportSerializer
    perm_module = "sports"
    permission_classes = [HasPerm("masters.view")]
    filterset_fields = ["is_active"]
    search_fields = ["name", "code"]

    def perform_create(self, serializer):
        obj = serializer.save()
        log_audit(self.request, "sport.create", "masters", f"sport:{obj.pk}", new={"name": obj.name})


class SportCategoryViewSet(GranularPermissions, viewsets.ModelViewSet):
    queryset = SportCategory.objects.select_related("sport").all()
    serializer_class = SportCategorySerializer
    perm_module = "sports"
    permission_classes = [HasPerm("masters.view")]
    filterset_fields = ["sport", "is_active"]


class TrainingLocationViewSet(GranularPermissions, viewsets.ModelViewSet):
    queryset = TrainingLocation.objects.all()
    serializer_class = TrainingLocationSerializer
    perm_module = "sports"
    permission_classes = [HasPerm("masters.view")]
    filterset_fields = ["is_active"]
    search_fields = ["name"]


class SessionTypeViewSet(GranularPermissions, viewsets.ModelViewSet):
    queryset = SessionType.objects.all()
    serializer_class = SessionTypeSerializer
    perm_module = "sports"
    permission_classes = [HasPerm("masters.view")]


class AcademyAchievementSerializer(serializers.ModelSerializer):
    sport_name = serializers.CharField(source="sport.name", read_only=True)

    class Meta:
        model = AcademyAchievement
        fields = "__all__"
        read_only_fields = ["created_by", "created_at"]


class AcademyAchievementViewSet(GranularPermissions, viewsets.ModelViewSet):
    queryset = AcademyAchievement.objects.select_related("sport").all()
    serializer_class = AcademyAchievementSerializer
    perm_module = "sports"
    list_perm = "sports.view"
    retrieve_perm = "sports.view"
    create_perm = "sports.create"
    edit_perm = "sports.edit"
    destroy_perm = "sports.archive"
    permission_classes = [HasPerm("masters.view")]
    filterset_fields = ["sport", "is_active"]
    search_fields = ["title", "description"]

    def perform_create(self, serializer):
        obj = serializer.save(created_by=self.request.user)
        log_audit(self.request, "academy.achievement_create", "sports", f"achievement:{obj.pk}",
                  new={"title": obj.title})


class AcademySettingViewSet(GranularPermissions, viewsets.ModelViewSet):
    queryset = AcademySetting.objects.all().order_by("key")
    serializer_class = AcademySettingSerializer
    perm_module = "settings"
    edit_perm = "settings.edit"
    extra_action_perms = {"brand": None}
    permission_classes = [HasPerm("settings.manage")]

    def get_permissions(self):
        # NOTE: @action-level `permission_classes` are NOT honored by DRF here —
        # this override decides everything, so the public brand action is listed.
        if self.action == "brand":
            return []
        return [HasPerm("settings.manage")]

    @action(detail=False, methods=["get"], permission_classes=[])
    def brand(self, request):
        """Public academy identity + contact details for login screens and apps.

        Authentication is intentionally NOT required here — the login page and
        coach/parent devices need this before anyone signs in. Only a fixed
        whitelist of public identity/contact keys is exposed (never the full
        settings store), so this cannot leak internal configuration.
        """
        keys = ["academy.name", "academy.tagline", "academy.phone",
                "academy.email", "academy.address", "academy.timings"]
        stored = {s.key: s.value for s in AcademySetting.objects.filter(key__in=keys)}
        return Response({
            "name": stored.get("academy.name") or "JETZ Sports Academy",
            "tagline": stored.get("academy.tagline") or "Sports Management ERP",
            "phone": stored.get("academy.phone") or "",
            "email": stored.get("academy.email") or "",
            "address": stored.get("academy.address") or "",
            "timings": stored.get("academy.timings") or "",
        })
