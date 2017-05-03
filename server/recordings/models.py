from django.db import models
import uuid


class Recording(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participant = models.ForeignKey('rooms.Participant',
        related_name='recordings'
    )
    room = models.ForeignKey('rooms.Room',
        related_name='recordings'
    )
    type = models.CharField(max_length=48)
    filesize = models.BigIntegerField(default=0, blank=True, null=True)
    started = models.DateTimeField(blank=True, null=True)
    ended = models.DateTimeField(blank=True, null=True)

    class Meta:
        get_latest_by = 'started'
        ordering = ['-id']
