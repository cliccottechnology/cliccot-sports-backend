import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class FaceauthConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "faceauth"
    verbose_name = "Face Verification Attendance"

    def ready(self):
        # Registers the provider configuration system checks (see checks.py).
        from . import checks  # noqa: F401

        # Make the active provider visible in the server log so a silently
        # "pilot" deployment is obvious at startup.
        from django.conf import settings

        logger.info(
            "Photo-attendance vision provider=%s (face engine=%s)",
            getattr(settings, "ATTENDANCE_VISION_PROVIDER", "pilot"),
            getattr(settings, "FACE_VERIFICATION_PROVIDER", "none"),
        )
