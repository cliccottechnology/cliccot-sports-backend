from django.db import models

STATUS_CHOICES = [("scheduled", "Scheduled"), ("in_progress", "In Progress"),
                  ("completed", "Completed"), ("cancelled", "Cancelled")]


class Session(models.Model):
    SLOT_CHOICES = [(1, "Session 1"), (2, "Session 2"), (3, "Session 3")]

    sport = models.ForeignKey("academy.Sport", on_delete=models.PROTECT, related_name="sessions")
    batch = models.ForeignKey("batches.Batch", on_delete=models.PROTECT, related_name="sessions")
    coach = models.ForeignKey("coaches.Coach", on_delete=models.PROTECT, related_name="sessions")
    session_type = models.ForeignKey("academy.SessionType", null=True, blank=True, on_delete=models.SET_NULL)
    date = models.DateField(db_index=True)
    slot = models.PositiveSmallIntegerField(choices=SLOT_CHOICES, default=1,
                                            help_text="Academy-wide daily slot: the academy runs Session 1/2/3 per day.")
    start_time = models.TimeField()
    end_time = models.TimeField()
    location = models.ForeignKey("academy.TrainingLocation", null=True, blank=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="scheduled", db_index=True)
    notes = models.TextField(blank=True)
    validated_for_trainer_fee = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["date", "status"]), models.Index(fields=["coach", "date"])]
        ordering = ["-date", "start_time"]

    def __str__(self):
        return f"{self.batch.name} @ {self.date} ({self.status})"


class SessionStudent(models.Model):
    """Snapshot of assigned students for a session (roster linkage)."""
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="assigned")
    student = models.ForeignKey("students.Student", on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("session", "student")
