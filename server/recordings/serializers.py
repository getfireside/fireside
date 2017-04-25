from rest_framework import serializers
from fireside.util import TimestampField

from . import models


class RecordingSerializer(serializers.ModelSerializer):
    uid = serializers.IntegerField(source='participant_id')
    peer_id = serializers.UUIDField(required=False)

    started = TimestampField(read_only=True)
    ended = TimestampField(read_only=True, default=None)

    class Meta:
        model = models.Recording
        fields = (
            'id',
            'uid',
            'peer_id',
            'room_id',
            'type',
            'filesize',
            'started',
            'ended',
        )
