from rest_framework import serializers
from .models import Recording


class RecordingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recording
        fields = (
            'id',
            'participant_id',
            'room_id',
            'type',
            'filesize',
            'duration',
            'created'
        )
