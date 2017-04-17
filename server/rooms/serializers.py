from rest_framework import serializers
from .models import RoomMembership, Message
from recordings.serializers import RecordingSerializer
from fireside.util import TimestampField


class PeerInfoSerializer(serializers.Serializer):
    recordings = RecordingSerializer(many=True)
    current_recording_id = serializers.UUIDField(required=False, default=None)
    role = serializers.CharField()
    name = serializers.CharField(source='get_display_name')


class MembershipSerializer(serializers.Serializer):
    uid = serializers.IntegerField(source='participant_id')
    info = PeerInfoSerializer(source='*')
    status = serializers.IntegerField()


class PeerSerializer(MembershipSerializer):
    id = serializers.UUIDField(source='peer_id')
    status = serializers.SerializerMethodField(method_name='connected_status')

    def connected_status(self, value):
        return RoomMembership.STATUS.connected


class MessageSerializer(serializers.ModelSerializer):
    timestamp = TimestampField(read_only=True)
    class Meta:
        model = Message
        fields = ('id', 'type', 'payload', 'timestamp')


class InitialRoomDataSerializer(serializers.Serializer):
    peers = PeerSerializer(source='connected_memberships', many=True)



class PeerActionSerializer(serializers.Serializer):
    peer_id = serializers.UUIDField()

    def validate_peer_id(self, value):
        if value.hex not in self.context['room'].get_peer_ids():
            raise serializers.ValidationError('Peer is not connected.')
        return value

