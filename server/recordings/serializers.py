from rest_framework import serializers
from fireside.util import TimestampField

from . import models


class RecordingSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(required=True)
    uid = serializers.IntegerField(source='participant_id')

    started = TimestampField()
    ended = TimestampField(default=None, required=False, allow_null=True)

    class Meta:
        model = models.Recording
        fields = (
            'id',
            'uid',
            'room_id',
            'type',
            'filesize',
            'started',
            'ended',
        )
