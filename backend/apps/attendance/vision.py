"""Pluggable vision provider for AI-assisted photo attendance.

Privacy design (pilot phase):
- No biometric templates are enrolled or stored. The service never claims to
  identify a student from pixels alone.
- The default ``pilot`` provider validates the group photo, stores it as
  audit evidence, and returns every roster student as ``needs_review`` so a
  coach must explicitly confirm each athlete. It never auto-marks present.
- A future provider (face recognition against consented enrollment photos,
  head-count estimation, etc.) can implement :class:`BaseVisionProvider` and
  be selected via the ``ATTENDANCE_VISION_PROVIDER`` setting without changing
  the API contract.
"""
from dataclasses import dataclass, field

from django.conf import settings

SUGGESTION_CHOICES = ("verified", "not_detected", "needs_review")


@dataclass
class StudentSuggestion:
    student_id: int  # PK of students.Student
    suggestion: str  # one of SUGGESTION_CHOICES
    confidence: float | None
    reason: str


@dataclass
class AnalysisResult:
    provider: str
    persons_detected: int | None
    suggestions: list = field(default_factory=list)
    unrecognized_count: int = 0
    notes: list = field(default_factory=list)


class BaseVisionProvider:
    name = "base"

    def analyze(self, image_file, roster_student_ids: list[int],
                session=None) -> AnalysisResult:
        """Return per-student suggestions for a session group photo.

        ``session`` is optional context (school/roster scoping) supplied by the
        caller; providers that don't need it may ignore it.
        """
        raise NotImplementedError


class PilotVisionProvider(BaseVisionProvider):
    """Transparent pilot: evidence + honest deferral to the coach."""

    name = "pilot"

    def analyze(self, image_file, roster_student_ids: list[int],
                session=None) -> AnalysisResult:
        suggestions = [
            StudentSuggestion(
                student_id=sid,
                suggestion="needs_review",
                confidence=None,
                reason="Pilot mode: confirm presence manually against the group photo.",
            )
            for sid in roster_student_ids
        ]
        return AnalysisResult(
            provider=self.name,
            persons_detected=None,
            suggestions=suggestions,
            unrecognized_count=0,
            notes=[
                "Pilot provider: no biometric matching is enrolled, so no student "
                "is auto-marked present. The photo is stored as audit evidence and "
                "the coach confirms each athlete on the review screen.",
            ],
        )


_PROVIDERS = {"pilot": PilotVisionProvider}


def dhash_hex(image, size: int = 8) -> str:
    """Perceptual difference-hash (Pillow only, no numpy). Returns 16 hex chars."""
    gray = image.convert("L").resize((size + 1, size))
    px = list(gray.getdata())
    bits = 0
    for y in range(size):
        for x in range(size):
            bits = (bits << 1) | (1 if px[y * (size + 1) + x] > px[y * (size + 1) + x + 1] else 0)
    return f"{bits:016x}"


def hamming_hex(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def get_provider() -> BaseVisionProvider:
    name = getattr(settings, "ATTENDANCE_VISION_PROVIDER", "pilot")
    if name == "faceauth":
        # Imported lazily so the AWS deps (boto3/numpy) are only required when
        # real face matching is actually switched on.
        from faceauth.attendance_provider import FaceVisionProvider
        return FaceVisionProvider()
    cls = _PROVIDERS.get(name)
    if cls is None:
        raise ValueError(f"Unknown ATTENDANCE_VISION_PROVIDER: {name!r}")
    return cls()
