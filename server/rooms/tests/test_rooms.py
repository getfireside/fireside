import pytest
import json
import uuid

from django.utils.timezone import now

from rooms.models import Room, Message, RoomMembership
from rooms.serializers import MembershipSerializer
from recordings.serializers import RecordingSerializer
# from channels.test import ChannelTestCase
from fireside import redis_conn

pytestmark = pytest.mark.django_db


class TestRoomManager:
    def test_create_with_owner(self, user, participant3):
        room1 = Room.objects.create_with_owner(user.participant)
        assert room1.owner == user.participant
        assert room1.memberships.count() == 0

        room2 = Room.objects.create_with_owner(participant3)
        assert room2.owner == participant3


class TestRoom:
    def test_is_admin(self, room, user, user2):
        assert not room.is_admin(user2.participant)
        assert room.is_admin(user.participant)

    def test_is_member(self, room, user, user2, participant3):
        assert room.is_member(user.participant)
        assert room.is_member(user2.participant)
        assert not room.is_member(participant3)

    def test_is_valid_action(self, room):
        for action in room.ACTION_TYPES:
            assert room.is_valid_action(action)
        assert not room.is_valid_action('some_invalid_action')
        assert not room.is_valid_action(None)

    def test_message(self, empty_room):
        msg = empty_room.message(type='t', payload={'foo': 'bar'})
        assert msg.type == 't'
        assert msg.payload == {'foo': 'bar'}

    @pytest.mark.skip
    def test_receive_event(self):
        pass

    def test_should_save_message(self, room):
        for msg_type in (Message.TYPE.leave, Message.TYPE.announce):
            msg = room.message(type=msg_type, payload={'foo': 'bar'})
            assert room.should_save_message(msg)

        for msg_type in (
            Message.TYPE.join,
            Message.TYPE.signalling,
            Message.TYPE.action
        ):
            msg = room.message(type=msg_type, payload={'foo': 'bar'})
            assert not room.should_save_message(msg)

        for event_type in (
            'update_recording',
            'update_meter',
            'update_upload_progress',
        ):
            msg = room.message(type=Message.TYPE.event, payload={
                'type': event_type,
                'data': {'foo': 'bar'}
            })
            assert not room.should_save_message(msg)

        assert not room.should_save_message(
            room.message(type=Message.TYPE.event, payload={
                'type': 'update_status',
                'data': {'disk_usage': {'usage': 0, 'quota': 0}}
            })
        )

        assert not room.should_save_message(
            room.message(type=Message.TYPE.event, payload={
                'type': 'update_status',
                'data': {'resources': {'video': True, 'quota': True}}
            })
        )

        for event_type in (
            'request_start_recording',
            'request_stop_recording',
            'request_kick',
            'request_upload',
            'message',
        ):
            msg = room.message(type=Message.TYPE.event, payload={
                'type': event_type,
                'data': {'foo': 'bar'}
            })
            assert room.should_save_message(msg)

    @pytest.mark.usefixtures('redisdb')
    def test_connected_memberships(self, room, user, user2):
        assert len(room.connected_memberships) == 0
        redis_conn.hset(
            f'rooms:{room.id}:peers',
            'peerid',
            room.owner.id
        )
        assert list(room.connected_memberships) == \
            [room.memberships.get(participant=room.owner)]
        redis_conn.hset(
            f'rooms:{room.id}:peers',
            'peerid2',
            user2.participant.id
        )
        assert set(room.connected_memberships) == set(room.memberships.all())

    @pytest.mark.usefixtures('redisdb')
    def test_connect(self, empty_room, user, participant3):
        empty_room.memberships.create(
            participant=participant3
        )
        peer_id = empty_room.connect(
            participant=user.participant,
            channel_name='xxx'
        )
        peer2_id = empty_room.connect(
            participant=participant3,
            channel_name='yyy'
        )
        assert isinstance(peer_id, str)
        assert peer_id == empty_room.peers.for_participant(user.participant).id
        assert peer2_id == empty_room.peers.for_participant(participant3).id
        mem = empty_room.connected_memberships.get(
            participant=participant3
        )
        assert mem.role == mem.ROLE.guest
        assert empty_room.connected_memberships.filter(participant=user.participant).exists()
        assert empty_room.peers[peer_id]['channel'] == 'xxx'


    @pytest.mark.usefixtures('redisdb')
    def test_announce(self, room, recording, recording2, participant3, mocker):
        peer_id = room.connect(room.owner, 'xxx')
        m = mocker.patch('rooms.models.Room.send')
        room.announce(peer_id, room.owner)
        assert m.call_count == 1
        msg = m.call_args[0][0]

        mem = room.memberships.get(participant=room.owner)
        expected_peer_dict = MembershipSerializer(mem).data
        expected_peer_dict['peer_id'] = peer_id
        expected_peer_dict['status'] = RoomMembership.STATUS.connected
        expected_peer_dict['info']['disk_usage'] = None
        expected_peer_dict['info']['resources'] = None
        expected_peer_dict['info']['recorder_status'] = None

        assert msg.type == Message.TYPE.announce
        assert msg.payload == {
            'peer': expected_peer_dict
        }

    def test_create_recording(self, room, mocker):
        send_mock = mocker.patch('rooms.models.Room.send')
        peer_id = room.connect(room.owner, channel_name='')
        rec = room.create_recording(
            started=now(),
            participant=room.owner,
            type='audio/wav',
            id=uuid.uuid4()
        )
        assert send_mock.call_count == 1
        msg = send_mock.call_args[0][0]
        assert msg.type == Message.TYPE.event
        assert msg.payload['type'] == 'start_recording'
        assert msg.participant == room.owner
        assert msg.peer_id == peer_id
        assert msg.payload['data'] == RecordingSerializer(rec).data

    @pytest.mark.skip
    def test_start_recording(self):
        pass

    @pytest.mark.skip
    def test_stop_recording(self):
        pass

    @pytest.mark.skip
    def test_kick(self):
        pass


@pytest.mark.usefixtures('redisdb')
class TestRoomSend:
    @pytest.fixture
    def send_mocks(self, mocker):
        mocker.channel_for_peer = mocker.patch(
            'rooms.peers.Peer.channel',
            new_callable=mocker.PropertyMock
        )
        mocker.group_class = mocker.patch(
            'rooms.models.room.Group',
            autospec=True
        )
        mocker.add_message = mocker.patch('rooms.models.Room.add_message')
        mocker.should_save_message = mocker.patch(
            'rooms.models.Room.should_save_message'
        )
        return mocker

    @pytest.mark.skip
    def test_error_if_too_big(self):
        pass

    def test_send_normal(self, room, mocker, send_mocks):
        msg1 = room.message(type='announce', payload={
            'msg': 'New user!',
            'data': {'foo': 'bar'}
        })
        send_mocks.should_save_message.return_value = True
        room.send(msg1)
        assert not send_mocks.channel_for_peer.called
        assert send_mocks.should_save_message.called
        send_mocks.group_class.assert_called_once_with(room.group_name)
        assert send_mocks.group_class.method_calls == [mocker.call().send({
            'text': msg1.encode()
        })]
        send_mocks.add_message.assert_called_once_with(msg1)

    def test_send_default_no_save(self, room, mocker, send_mocks):
        msg1 = room.message(type='announce', payload={
            'msg': 'Another new user!',
            'data': {'foo': 'bar'}
        })
        send_mocks.should_save_message.return_value = False
        room.send(msg1)
        assert not send_mocks.add_message.called

    def test_send_explicit_save(self, room, mocker, send_mocks):
        msg2 = room.message(type='event', payload={
            'msg': 'test',
            'foo': 'bar'
        })
        room.send(msg2, save=True)
        assert not send_mocks.channel_for_peer.called
        assert send_mocks.group_class.method_calls == [mocker.call().send({
            'text': msg2.encode()
        })]
        assert not send_mocks.should_save_message.called
        send_mocks.add_message.assert_called_once_with(msg2)

    @pytest.mark.skip
    def test_send_action(self):
        pass

    def test_send_to_individual(self, room, user2, mocker, send_mocks):
        msg3 = room.message(type='event', payload={
            'type': 'requestStartRecording',
            'data': {'requester': {'id': '443ecc03b59f46809854a965defb2d03'}}
        })
        to_id = room.connect(user2.participant, 'xxx')
        room.send(msg3, to_peer_id=to_id)
        assert send_mocks.channel_for_peer.mock_calls[0] == \
            mocker.call()
        assert send_mocks.channel_for_peer.mock_calls[1] == \
            mocker.call().send({
                'text': msg3.encode()
            })
        assert len(send_mocks.channel_for_peer.mock_calls) == 2
        assert not send_mocks.group_class.called
        assert not send_mocks.should_save_message.called

        assert not send_mocks.add_message.called
