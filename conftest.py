"""Shared pytest setup.

The test-suite must never depend on a developer's `.env` provider choice or on
live cloud credentials, so every test runs with the safe, offline ``pilot``
photo-attendance provider unless a test explicitly opts into another one.
"""
import pytest


@pytest.fixture(autouse=True)
def _safe_vision_provider(settings):
    settings.ATTENDANCE_VISION_PROVIDER = "pilot"
    settings.FACE_VERIFICATION_PROVIDER = "mock"
    settings.AWS_REGION = ""
    settings.AWS_LIVENESS_REGION = ""
    yield
