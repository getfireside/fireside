from rest_framework import serializers
from . import models
from recordings.serializers import RecordingSerializer
from fireside.util import TimestampField
from django.conf import settings

class PeerInfoSerializer(serializers.Serializer):
    recordings = RecordingSerializer(many=True)
    current_recording_id = serializers.UUIDField(
        required=False,
        default=None,
        format='hex'
    )
    role = serializers.CharField()
    name = serializers.CharField(source='get_display_name')
    disk_usage = serializers.DictField(required=False)
    resources = serializers.DictField(required=False)
    recorder_status = serializers.CharField(required=False)

    class Meta:
        peer_only_fields = [
            'disk_usage',
            'resources',
            'recorder_status'
        ]

    def to_representation(self, obj):
        '''Removes peer_only_fields from members who aren't connected'''
        res = super().to_representation(obj)
        if obj.peer_id is None:
            for field_name in self.Meta.peer_only_fields:
                res.pop(field_name)
        return res


class MembershipSerializer(serializers.Serializer):
    peer_id = serializers.CharField()
    uid = serializers.IntegerField(source='participant_id')
    info = PeerInfoSerializer(source='*')
    status = serializers.IntegerField()


class MessageSerializer(serializers.ModelSerializer):
    timestamp = TimestampField(read_only=True)
    uid = serializers.IntegerField(source='participant_id', required=False)

    def validate_type(self, value):
        if value != models.Message.TYPE.event:
            raise serializers.ValidationError('You can only send event messages.')
        return value

    class Meta:
        model = models.Message
        fields = ('id', 'uid', 'type', 'payload', 'timestamp', 'peer_id')


class RoomConfigSerializer(serializers.Serializer):
    UPLOAD_MODE_CHOICES = (
        ['p2p'] +
        ['http'] if settings.FIRESIDE_HTTP_UPLOAD_ENABLED else ['']
    )
    DEFAULT_UPLOAD_MODE = 'http' if 'http' in UPLOAD_MODE_CHOICES else 'p2p'
    mode = serializers.ChoiceField(choices=['audio', 'video'], default='audio')
    debug_mode = serializers.BooleanField(default=False)
    video_bitrate = serializers.IntegerField(allow_null=True, default=None)
    upload_mode = serializers.ChoiceField(
        choices=UPLOAD_MODE_CHOICES,
        default=DEFAULT_UPLOAD_MODE
    )
    upload_mode_choices = serializers.ListField(
        default=UPLOAD_MODE_CHOICES,
        read_only=True)


class InitialRoomDataSerializer(serializers.Serializer):
    members = MembershipSerializer(
        source='peers.get_memberships_with_peer_ids',
        many=True
    )
    config = RoomConfigSerializer()


class JoinRoomSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, default=None)


class EditNameSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, default=None)


class PeerActionSerializer(serializers.Serializer):
    peer_id = serializers.UUIDField(format='hex')

    def validate_peer_id(self, value):
        if value.hex not in self.context['room'].peers.ids:
            raise serializers.ValidationError('Peer is not connected.')
        return value
