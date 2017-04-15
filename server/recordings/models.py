from django.db import models
import uuid

class Recording(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participant = models.ForeignKey('rooms.Participant', related_name='recordings')
    room = models.ForeignKey('rooms.Room', related_name='recordings')
    type = models.CharField(max_length=48)
    filesize = models.PositiveIntegerField(default=0)
    started = models.DateTimeField(blank=True, null=True)
    ended = models.DateTimeField(blank=True, null=True)

    @property
    def uid(self):
        from rooms.models import RoomMembership
        return RoomMembership.objects.get(
            participant_id=self.participant_id,
            room_id=self.room_id,
        ).id

    class Meta:
        get_latest_by = 'started'
        ordering = ['-id']
