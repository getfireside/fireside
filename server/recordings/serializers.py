from rest_framework import serializers
from .models import Recording


class RecordingSerializer(serializers.ModelSerializer):
    uid = serializers.IntegerField()
    peer_id = serializers.UUIDField(required=False)
    class Meta:
        model = Recording
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
