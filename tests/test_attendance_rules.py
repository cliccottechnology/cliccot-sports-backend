"""Attendance business-rule tests: idempotent submit, locks, correction trail."""
from datetime import date, time

import pytest
from rest_framework.test import APIClient


@pytest.fixture
def rules_setup():
    from apps.academy.models import Sport, TrainingLocation
    from apps.accounts.models import Permission, Role, User
    from apps.attendance.models import AttendanceRecord
    from apps.batches.models import Batch
    from apps.coaches.models import Coach
    from apps.sessions.models import Session, SessionStudent
    from apps.students.models import Student
    sport = Sport.objects.create(name="R-Cricket", code="RCR")
    coach = Coach.objects.create(trainer_id="R-T1", first_name="Ravi", phone="7", weekly_off_days=[])
    loc = TrainingLocation.objects.create(name="R-Loc")
    batch = Batch.objects.create(name="R-B", sport=sport, coach=coach,
                                 start_time=time(7, 0), end_time=time(8, 0), location=loc)
    st = Student.objects.create(student_id="R-S1", first_name="Rohan", enrollment_date=date.today(), sport=sport)
    sess = Session.objects.create(sport=sport, batch=batch, coach=coach, date=date.today(),
                                  start_time=time(7, 0), end_time=time(8, 0), location=loc)
    SessionStudent.objects.create(session=sess, student=st)
    perm, _ = Permission.objects.get_or_create(code="attendance.mark",
                                               defaults={"name": "mark", "module": "attendance"})
    role, _ = Role.objects.get_or_create(name="coach")
    role.permissions.add(perm)
    user = User(username="rules_coach", role=role, is_active=True, coach_profile=coach)
    user.set_password("pass12345")
    user.save()
    return {"user": user, "session": sess, "student": st}


@pytest.mark.django_db
def test_bulk_mark_is_idempotent(rules_setup):
    from apps.attendance.models import AttendanceRecord
    client = APIClient()
    client.force_authenticate(rules_setup["user"])
    url = "/api/attendance/bulk_mark/"
    body = {"session": rules_setup["session"].pk,
            "items": [{"student": rules_setup["student"].pk, "status": "present"}]}
    r1 = client.post(url, body, format="json")
    assert r1.status_code == 200, r1.content
    assert r1.data["results"][0]["created"] is True
    r2 = client.post(url, body, format="json")
    assert r2.status_code == 200, r2.content
    assert r2.data["results"][0]["created"] is False
    assert AttendanceRecord.objects.filter(session=rules_setup["session"]).count() == 1


@pytest.mark.django_db
def test_bulk_mark_change_writes_correction_trail(rules_setup):
    from apps.attendance.models import AttendanceCorrection, AttendanceRecord
    client = APIClient()
    client.force_authenticate(rules_setup["user"])
    url = "/api/attendance/bulk_mark/"
    sid, st = rules_setup["session"].pk, rules_setup["student"].pk
    assert client.post(url, {"session": sid, "items": [{"student": st, "status": "present"}]}, format="json").status_code == 200
    r = client.post(url, {"session": sid, "items": [{"student": st, "status": "late"}]}, format="json")
    assert r.status_code == 200, r.content
    rec = AttendanceRecord.objects.get(session_id=sid, student_id=st)
    assert rec.status == "late"
    corr = AttendanceCorrection.objects.filter(record=rec).order_by("-created_at").first()
    assert corr is not None and (corr.old_status, corr.new_status) == ("present", "late")
    hist = client.get("/api/attendance/corrections/", {"record__session": sid})
    assert hist.status_code == 200, hist.content
    assert any(c["record"] == rec.pk for c in hist.data["results"])


@pytest.mark.django_db
def test_locked_record_rejects_change_without_correction_perm(rules_setup):
    from apps.attendance.models import AttendanceRecord
    rec = AttendanceRecord.objects.create(session=rules_setup["session"], student=rules_setup["student"],
                                          status="present", locked=True)
    client = APIClient()
    client.force_authenticate(rules_setup["user"])
    r = client.post("/api/attendance/bulk_mark/",
                    {"session": rules_setup["session"].pk,
                     "items": [{"student": rules_setup["student"].pk, "status": "absent"}]},
                    format="json")
    assert r.status_code == 200, r.content
    assert r.data["results"][0].get("error") == "locked"
    rec.refresh_from_db()
    assert rec.status == "present"


@pytest.mark.django_db
def test_corrections_require_auth():
    client = APIClient()
    r = client.get("/api/attendance/corrections/")
    assert r.status_code in (401, 403)
