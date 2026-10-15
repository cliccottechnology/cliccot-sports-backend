from django.db import connection

with connection.cursor() as c:
    c.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_name = 'academy_school'"
    )
    print("academy_school table:", c.fetchall())
    c.execute(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = 'accounts_user' AND column_name = 'school_id'"
    )
    print("user.school_id col:", c.fetchall())
    c.execute(
        "SELECT app, name FROM django_migrations WHERE app IN ('academy', 'accounts', 'coaches') "
        "ORDER BY app, name"
    )
    print("records:", list(c.fetchall()))
