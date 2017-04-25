from rest_framework import serializers
from . import models
from recordings.serializers import RecordingSerializer
from fireside.util import TimestampField


class PeerInfoSerializer(serializers.Serializer):
    recordings = RecordingSerializer(many=True)
    current_recording_id = serializers.UUIDField(required=False, default=None, format='hex')
    role = serializers.CharField()
    name = serializers.CharField(source='get_display_name')


class MembershipSerializer(serializers.Serializer):
    peerId = serializers.CharField(source='peer_id')
    uid = serializers.IntegerField(source='participant_id')
    info = PeerInfoSerializer(source='*')
    status = serializers.IntegerField()


class MessageSerializer(serializers.ModelSerializer):
    timestamp = TimestampField(read_only=True)
    uid = serializers.IntegerField(source='participant_id')

    def validate_type(self, value):
        return value == 'event'

    class Meta:
        model = models.Message
        fields = ('id', 'uid', 'type', 'payload', 'timestamp', 'peer_id')


class InitialRoomDataSerializer(serializers.Serializer):
    members = MembershipSerializer(source='get_memberships_with_peer_ids', many=True)


class JoinRoomSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, default=None)


class PeerActionSerializer(serializers.Serializer):
    peer_id = serializers.UUIDField(format='hex')

    def validate_peer_id(self, value):
        if value.hex not in self.context['room'].get_peer_ids():
            raise serializers.ValidationError('Peer is not connected.')
        return value

