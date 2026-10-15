"""Academy master data: schools, sports, categories, locations, session types, settings."""
from django.db import models


class School(models.Model):
    """One onboarded school/academy. All operational data is scoped to a school;
    users with a school see only their school's data (super admins see all)."""
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=20, unique=True)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Sport(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class SportCategory(models.Model):
    sport = models.ForeignKey(Sport, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=100)  # e.g. U-10, U-14
    min_age = models.PositiveIntegerField(null=True, blank=True)
    max_age = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("sport", "name")


class TrainingLocation(models.Model):
    name = models.CharField(max_length=150, unique=True)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)


class SessionType(models.Model):
    name = models.CharField(max_length=100, unique=True)  # Regular, Trial, Camp, Makeup
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)


class AcademySetting(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.JSONField(default=dict, blank=True)
    description = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.key


class AcademyAchievement(models.Model):
    """Institute achievements showcase (tournaments, milestones, honours)."""
    title = models.CharField(max_length=200)
    date = models.DateField()
    sport = models.ForeignKey(Sport, null=True, blank=True, on_delete=models.SET_NULL,
                              related_name="achievements")
    description = models.TextField(blank=True)
    photo = models.ImageField(upload_to="academy/achievements/%Y/%m/", null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.title} ({self.date})"
