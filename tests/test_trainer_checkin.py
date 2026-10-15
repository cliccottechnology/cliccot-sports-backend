"""Trainer self check-in: own sessions only, one per session, duplicates blocked."""
import pytest
from rest_framework.test import APIClient


@pytest.fixture
def checkin_setup():
    from datetime import date, time
    from apps.academy.models import Sport, TrainingLocation
    from apps.accounts.models import Permission, Role, User
    from apps.batches.models import Batch
    from apps.coaches.models import Coach
    from apps.sessions.models import Session, SessionStudent
    from apps.students.models import Student
    sport = Sport.objects.create(name="K-Football", code="KFB")
    coach = Coach.objects.create(trainer_id="K-T1", first_name="Kiran", phone="3", weekly_off_days=[])
    other = Coach.objects.create(trainer_id="K-T2", first_name="Mohan", phone="4", weekly_off_days=[])
    loc = TrainingLocation.objects.create(name="K-Loc")
    batch = Batch.objects.create(name="K-B", sport=sport, coach=coach,
                                 start_time=time(7, 0), end_time=time(8, 0), location=loc)
    st = Student.objects.create(student_id="K-S1", first_name="A", enrollment_date=date.today(), sport=sport)
    sess = Session.objects.create(sport=sport, batch=batch, coach=coach, date=date.today(),
                                  start_time=time(7, 0), end_time=time(8, 0), location=loc)
    SessionStudent.objects.create(session=sess, student=st)
    other_sess = Session.objects.create(sport=sport, batch=batch, coach=other, date=date.today(),
                                        start_time=time(9, 0), end_time=time(10, 0), location=loc)
    perm, _ = Permission.objects.get_or_create(code="attendance.mark",
                                               defaults={"name": "mark", "module": "attendance"})
    role, _ = Role.objects.get_or_create(name="coach")
    role.permissions.add(perm)
    user = User(username="checkin_coach", role=role, is_active=True, coach_profile=coach)
    user.set_password("pass12345")
    user.save()
    return {"user": user, "session": sess, "other_session": other_sess}


@pytest.mark.django_db
def test_checkin_own_session(checkin_setup):
    c = APIClient()
    c.force_authenticate(checkin_setup["user"])
    r = c.post("/api/coaches/checkins/", {"session": checkin_setup["session"].pk}, format="json")
    assert r.status_code == 201, r.content
    assert r.data["status"] == "present"
    mine = c.get("/api/coaches/checkins/")
    assert mine.status_code == 200
    assert any(x["session"] == checkin_setup["session"].pk for x in mine.data["results"])


@pytest.mark.django_db
def test_checkin_duplicate_blocked(checkin_setup):
    c = APIClient()
    c.force_authenticate(checkin_setup["user"])
    url = "/api/coaches/checkins/"
    assert c.post(url, {"session": checkin_setup["session"].pk}, format="json").status_code == 201
    r2 = c.post(url, {"session": checkin_setup["session"].pk}, format="json")
    assert r2.status_code == 400


@pytest.mark.django_db
def test_checkin_other_coach_session_forbidden(checkin_setup):
    c = APIClient()
    c.force_authenticate(checkin_setup["user"])
    r = c.post("/api/coaches/checkins/", {"session": checkin_setup["other_session"].pk}, format="json")
    assert r.status_code == 403
