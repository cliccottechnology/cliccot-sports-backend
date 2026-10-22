from apps.sessions import services
from apps.sessions.models import Session, SessionStudent
from faceauth.enrollment import index_student_faces
s = Session.objects.get(id=7)
services.ensure_session_roster(s)
roster = list(SessionStudent.objects.filter(session=s).values_list('student_id', flat=True))
print('roster', len(roster))
try:
    index_student_faces(roster, getattr(s.batch,'school_id',None))
    print('done')
except Exception as e:
    print('ERR')
    print(e)

