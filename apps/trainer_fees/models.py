"""Session-based trainer fees: Eligible Completed Sessions x Session Rate = Payable."""
from django.db import models


class TrainerFeeRule(models.Model):
    PAYMENT_MODELS = [("per_session", "Per session"), ("weekly", "Weekly salary"), ("monthly", "Monthly salary")]
    trainer = models.ForeignKey("coaches.Coach", on_delete=models.CASCADE, related_name="fee_rules")
    sport = models.ForeignKey("academy.Sport", null=True, blank=True, on_delete=models.SET_NULL)
    batch = models.ForeignKey("batches.Batch", null=True, blank=True, on_delete=models.SET_NULL)
    session_type = models.ForeignKey("academy.SessionType", null=True, blank=True, on_delete=models.SET_NULL)
    payment_model = models.CharField(max_length=20, choices=PAYMENT_MODELS, default="per_session")
    rate_per_session = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # per-session model
    fixed_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # weekly/monthly salary
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=["trainer", "is_active"])]

    def amount_for_session(self):
        return self.rate_per_session if self.payment_model == "per_session" else self.fixed_amount


class TrainerPayable(models.Model):
    STATUS = [("pending", "Pending"), ("verified", "Verified"), ("paid", "Paid"), ("cancelled", "Cancelled")]
    KIND = [("session", "Per session"), ("weekly_salary", "Weekly salary"), ("monthly_salary", "Monthly salary")]
    trainer = models.ForeignKey("coaches.Coach", on_delete=models.CASCADE, related_name="payables")
    # Per-session payables link exactly one session; salary payables span a period instead.
    session = models.OneToOneField("training_sessions.Session", null=True, blank=True,
                                   on_delete=models.CASCADE, related_name="trainer_payable")
    kind = models.CharField(max_length=20, choices=KIND, default="session")
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    rule = models.ForeignKey(TrainerFeeRule, null=True, on_delete=models.SET_NULL)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS, default="pending", db_index=True)
    verified_by = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="verified_payables")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["trainer", "status"]),
            models.Index(fields=["trainer", "kind", "period_start"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["trainer", "kind", "period_start"],
                                    name="uniq_trainer_period_payable"),
        ]


class TrainerPayment(models.Model):
    METHOD_CHOICES = [("cash", "Cash"), ("upi", "UPI"), ("bank_transfer", "Bank transfer"), ("other", "Other")]
    trainer = models.ForeignKey("coaches.Coach", on_delete=models.CASCADE, related_name="trainer_payments")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default="cash")
    reference = models.CharField(max_length=100, unique=True)
    paid_on = models.DateField()
    paid_by = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class TrainerFeeAdjustment(models.Model):
    trainer = models.ForeignKey("coaches.Coach", on_delete=models.CASCADE, related_name="fee_adjustments")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.TextField()
    approved_by = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
