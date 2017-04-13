from rest_framework import serializers
from .models import Participant
from recordings.serializers import RecordingSerializer


class PeerInfoSerializer(serializers.Serializer):
    recordings = RecordingSerializer(many=True)
    currentRecordingId = serializers.UUIDField(required=False, source='current_recording_id')
    role = serializers.CharField()


class PeerSerializer(serializers.Serializer):
    id = serializers.UUIDField(source='peer_id')
    uid = serializers.IntegerField(source='participant_id')
    info = PeerInfoSerializer(source='*')

class InitialRoomDataSerializer(serializers.Serializer):
    peers = PeerSerializer(source='connected_memberships', many=True)
