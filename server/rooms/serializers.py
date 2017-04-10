from rest_framework import serializers
from .models import Participant
from recordings.serializers import RecordingSerializer


class ParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Participant
        fields = ('id', 'name')


class PeerInfoSerializer(serializers.Serializer):
    userInfo = ParticipantSerializer()
    recordings = RecordingSerializer(many=True)
    currentRecordingId = serializers.UUIDField(required=False)
    role = serializers.CharField()


class PeerSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    uid = serializers.IntegerField()
    info = PeerInfoSerializer()
