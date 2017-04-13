from rest_framework import serializers
from .models import Recording


class RecordingSerializer(serializers.ModelSerializer):
    uid = serializers.IntegerField(source='participant_id')
    class Meta:
        model = Recording
        fields = (
            'id',
            'uid',
            'room_id',
            'type',
            'filesize',
            'duration',
            'created'
        )
