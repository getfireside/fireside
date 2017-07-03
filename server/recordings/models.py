from django.db import models
from mimetypes import guess_extension
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

    @property
    def download_filename(self):
        name = self.room.memberships.get(participant=self.participant).get_display_name()
        duration = str(self.duration // 60) + 'h' + str(self.duration % 60) + 'm'
        date = self.started.strftime('%Y-%m-%d')
        return f'{date} - {name} - {duration}.{self.file_ext}'

    @property
    def file_ext(self):
        return guess_extension(self.type.split(';')[0])

    @property
    def duration(self):
        return (self.ended - self.started).total_seconds()

    class Meta:
        get_latest_by = 'started'
        ordering = ['-id']