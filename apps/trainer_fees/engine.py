"""Trainer fee engine: only completed/validated sessions are eligible by default."""
from datetime import timedelta

from .models import TrainerFeeRule


def find_rule(trainer_id, *, sport_id=None, batch_id=None, session_type_id=None, on_date=None):
    qs = TrainerFeeRule.objects.filter(trainer_id=trainer_id, is_active=True)
    if on_date:
        qs = qs.filter(effective_from__lte=on_date).filter(
            models_Q_effective_to(on_date))
    # Priority: batch+type > batch > sport+type > sport > generic trainer rule
    candidates = list(qs.select_related("sport", "batch", "session_type"))
    def score(r):
        return ((1 if r.batch_id == batch_id and batch_id else 0) * 8
                + (1 if r.session_type_id == session_type_id and session_type_id else 0) * 4
                + (1 if r.sport_id == sport_id and sport_id else 0) * 2
                + (1 if not r.batch_id and not r.sport_id and not r.session_type_id else 0))
    # filter to rules that don't contradict the session
    valid = [r for r in candidates
             if (not r.batch_id or r.batch_id == batch_id)
             and (not r.sport_id or r.sport_id == sport_id)
             and (not r.session_type_id or r.session_type_id == session_type_id)]
    if not valid:
        return None
    return sorted(valid, key=score, reverse=True)[0]


def models_Q_effective_to(on_date):
    from django.db import models
    return models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=on_date)


def compute_payables_for_session(session):
    """Create the TrainerPayable for a completed session. Returns payable or None.

    History-safe: the amount is snapshotted once at creation and NEVER
    rewritten by later runs — a rate change only affects sessions completed
    afterwards. Re-running generate is idempotent (one payable per session).
    """
    from .models import TrainerPayable
    if session.status != "completed":
        return None
    rule = find_rule(session.coach_id, sport_id=session.sport_id, batch_id=session.batch_id,
                     session_type_id=session.session_type_id, on_date=session.date)
    if not rule or rule.payment_model != "per_session":
        return None
    payable, _ = TrainerPayable.objects.get_or_create(
        session=session,
        defaults={"trainer_id": session.coach_id, "rule": rule, "amount": rule.rate_per_session},
    )
    return payable


def find_salary_rule(trainer_id, kind, on_date):
    """Active weekly/monthly rule effective on a date (latest wins)."""
    from .models import TrainerFeeRule
    return (TrainerFeeRule.objects
            .filter(trainer_id=trainer_id, payment_model=kind, is_active=True,
                    effective_from__lte=on_date)
            .filter(models_Q_effective_to(on_date))
            .order_by("-effective_from").first())


def week_starts(from_date, to_date):
    """Monday starts of every calendar week overlapping [from_date, to_date]."""
    cur = from_date - timedelta(days=from_date.weekday())
    out = []
    while cur <= to_date:
        out.append(cur)
        cur += timedelta(days=7)
    return out


def month_starts(from_date, to_date):
    """First-of-month starts overlapping [from_date, to_date]."""
    out = []
    cur = from_date.replace(day=1)
    while cur <= to_date:
        out.append(cur)
        cur = (cur.replace(day=28) + timedelta(days=4)).replace(day=1)
    return out


def compute_salary_for_period(trainer_id, kind, period_start, period_end):
    """Create the fixed salary payable for one trainer + period. Idempotent."""
    return _salary_get_or_none(trainer_id, kind, period_start, period_end)[0]


def generate_salaries(trainer_ids, from_date, to_date):
    """Weekly/monthly salary payables for trainers with fixed-salary rules."""
    from .models import TrainerFeeRule
    created = 0
    rules = (TrainerFeeRule.objects
             .filter(trainer_id__in=list(trainer_ids), is_active=True,
                     payment_model__in=["weekly", "monthly"])
             .values_list("trainer_id", "payment_model").distinct())
    for trainer_id, kind in rules:  # kind: "weekly" | "monthly"
        starts = week_starts(from_date, to_date) if kind == "weekly" else month_starts(from_date, to_date)
        for start in starts:
            if kind == "weekly":
                end = min(start + timedelta(days=6), to_date)
            else:
                month_end = (start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
                end = min(month_end, to_date)
            if start > to_date:
                continue
            _, was_created = _salary_get_or_none(trainer_id, kind, start, end)
            if was_created:
                created += 1
    return created


def _salary_get_or_none(trainer_id, kind, start, end):
    from .models import TrainerPayable
    rule = find_salary_rule(trainer_id, kind, start)
    if not rule or rule.fixed_amount <= 0:
        return None, False
    return TrainerPayable.objects.get_or_create(
        trainer_id=trainer_id, kind=f"{kind}_salary", period_start=start,
        defaults={"period_end": end, "rule": rule, "amount": rule.fixed_amount},
    )
