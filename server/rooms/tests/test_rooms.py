import pytest
import json
import uuid

from django.utils.timezone import now

from rooms.models import *
from rooms.serializers import MembershipSerializer
from recordings.serializers import RecordingSerializer
# from channels.test import ChannelTestCase
from fireside import redis_conn

pytestmark = pytest.mark.django_db


class TestRoomManager:
    def test_create_with_owner(self, user, participant3):
        room1 = Room.objects.create_with_owner(user.participant)
        assert room1.owner == user.participant
        mem1 = room1.memberships.get()
        assert mem1.participant == user.participant
        assert mem1.role == mem1.ROLE.owner

        room2 = Room.objects.create_with_owner(participant3)
        assert room2.owner == participant3


class TestRoom:
    def test_is_admin(self, room, user, user2):
        assert not room.is_admin(user2.participant)
        assert room.is_admin(user.participant)

    def test_is_valid_action(self, room):
        for action in room.ACTION_TYPES:
            assert room.is_valid_action(action)
        assert not room.is_valid_action('some_invalid_action')
        assert not room.is_valid_action(None)

    def test_encode_message(self, room):
        for type, type_name in Message.TYPE:
            res = room.encode_message(room.message(
                type=type,
                payload={'foo': 'bar'}
            ))
            assert isinstance(res, str)
            data = json.loads(res)
            assert data['t'] == type
            assert data['p'] == {'foo': 'bar'}
        with pytest.raises(ValueError, message='Invalid message'):
            room.encode_message(Message())
        with pytest.raises(ValueError, message='Invalid message'):
            room.encode_message(Message(type=type))
        with pytest.raises(ValueError, message='Invalid message'):
            room.encode_message(Message(payload={2: 3}))

    def test_decode_message(self, room):
        for type, type_name in Message.TYPE:
            msg = room.decode_message({'t': type, 'p': {'foo': 'bar'}})
            assert msg.type == type
            assert msg.payload == {'foo': 'bar'}
            assert msg.room == room

        with pytest.raises(ValueError, message='Invalid message'):
            room.decode_message({'t': 'fake', 'p': {'foo': 'bar'}})
        with pytest.raises(ValueError, message='Invalid message'):
            room.decode_message({'a': 'b', 'c': 'd'})
        with pytest.raises(ValueError, message='Invalid message'):
            room.decode_message(None)

    def test_message(self, empty_room):
        msg = empty_room.message(type='t', payload={'foo': 'bar'})
        assert msg.type == 't'
        assert msg.payload == {'foo': 'bar'}

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
            'recording_progress',
            'upload_progress',
            'meter_update'
        ):
            msg = room.message(type=Message.TYPE.event, payload={
                'type': event_type,
                'data': {'foo': 'bar'}
            })
            assert not room.should_save_message(msg)

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
    def test_join_new_participant(self, empty_room, participant3, mocker):
        m1 = mocker.patch('rooms.models.Room.connect_peer')
        m2 = mocker.patch('rooms.models.Room.announce')
        empty_room.memberships.create(
            participant=participant3
        )
        peer_id = empty_room.join(
            participant3,
            channel_name='test_channel_name'
        )
        assert isinstance(peer_id, str)
        assert peer_id == empty_room.get_peer_id(participant3)
        mem = empty_room.memberships.get(
            participant=participant3
        )
        assert mem.role == mem.ROLE.guest

        m1.assert_called_once_with(peer_id, 'test_channel_name', participant3)
        m2.assert_called_once_with(peer_id, participant3)

    @pytest.mark.usefixtures('redisdb')
    def test_join_existing_participant(self, room, user, mocker):
        m1 = mocker.patch('rooms.models.Room.connect_peer')
        m2 = mocker.patch('rooms.models.Room.announce')
        peer_id = room.join(user.participant, channel_name='test_channel_name')
        assert isinstance(peer_id, str)
        assert peer_id == room.get_peer_id(user.participant)
        mem = room.memberships.get(
            participant=user.participant
        )
        assert mem.role == mem.ROLE.owner

        m1.assert_called_once_with(
            peer_id,
            'test_channel_name',
            user.participant
        )
        m2.assert_called_once_with(peer_id, user.participant)

    @pytest.mark.usefixtures('redisdb')
    def test_get_and_set_peer_id(self, room, participant3):
        peer_id = room.set_peer_id(participant3)
        assert isinstance(peer_id, str)
        assert len(peer_id) == 32
        assert room.get_peer_id(participant3) == peer_id
        assert room.get_peer_id(room.owner) is None

    @pytest.mark.usefixtures('redisdb')
    def test_connect_peer(self, room, user, mocker):
        m1 = mocker.patch('rooms.models.Room.set_peer_data')
        peer_id = '443ecc03b59f46809854a965defb2d03'
        room.connect_peer(
            peer_id,
            'peer_channel_name',
            participant=user.participant
        )
        m1.assert_called_once_with(
            peer_id,
            'channel',
            'peer_channel_name',
        )
        assert redis_conn.hget(
            f'rooms:{room.id}:peers',
            peer_id
        ) == str(user.participant.id)

    @pytest.mark.usefixtures('redisdb')
    def test_disconnect_peer(self, room, user, mocker):
        peer_id = '443ecc03b59f46809854a965defb2d03'
        room.connect_peer(
            peer_id,
            'peer_channel_name',
            participant=user.participant
        )
        room.disconnect_peer(peer_id)
        assert not redis_conn.hexists(
            f'rooms:{room.id}:peers',
            peer_id
        )
        assert not redis_conn.exists(f'rooms:{room.id}:peers:{peer_id}')

    @pytest.mark.usefixtures('redisdb')
    def test_get_and_set_peer_data(self, empty_room):
        testdata = {'foo': 'bar', 'foo2': 231}
        peer_id = '443ecc03b59f46809854a965defb2d03'
        empty_room.set_peer_data(peer_id, 'test', testdata)
        assert redis_conn.hget(
            f'rooms:{empty_room.id}:peers:{peer_id}',
            'test'
        ) == json.dumps(testdata)
        assert empty_room.get_peer_data(peer_id, 'test') == testdata
        assert empty_room.get_peer_data(peer_id, 'non-existent') is None

    @pytest.mark.usefixtures('redisdb')
    def test_announce(self, room, recording, recording2, participant3, mocker):
        m = mocker.patch('rooms.models.Room.send')
        peer_id = '443ecc03b59f46809854a965defb2d03'
        room.announce(peer_id, room.owner)
        assert m.call_count == 1
        msg = m.call_args[0][0]

        mem = room.memberships.get(participant=room.owner)
        expected_peer_dict = MembershipSerializer(mem).data
        expected_peer_dict['peerId'] = peer_id
        expected_peer_dict['status'] = RoomMembership.STATUS.connected

        assert msg.type == Message.TYPE.announce
        assert msg.payload == {
            'peer': expected_peer_dict
        }

    def test_create_recording(self, room, mocker):
        send_mock = mocker.patch('rooms.models.Room.send')
        peer_id = room.set_peer_id(room.owner)
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
            'rooms.models.Room.channel_for_peer',
            autospec=True
        )
        mocker.group_class = mocker.patch('rooms.models.room.Group', autospec=True)
        mocker.add_message = mocker.patch('rooms.models.Room.add_message')
        mocker.should_save_message = mocker.patch(
            'rooms.models.Room.should_save_message'
        )
        return mocker

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
            'text': room.encode_message(msg1)
        }, immediately=True)]
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
            'text': room.encode_message(msg2)
        }, immediately=True)]
        assert not send_mocks.should_save_message.called
        send_mocks.add_message.assert_called_once_with(msg2)

    @pytest.mark.skip
    def test_send_action(self):
        pass

    def test_send_to_individual(self, room, mocker, send_mocks):
        msg3 = room.message(type='event', payload={
            'type': 'requestStartRecording',
            'data': {'requester': {'id': '443ecc03b59f46809854a965defb2d03'}}
        })
        to_id = '444ecc03b59f46809854a965defb2d03'
        room.send(msg3, to_peer=to_id)
        assert send_mocks.channel_for_peer.mock_calls[0] == \
            mocker.call(room, to_id)
        assert send_mocks.channel_for_peer.mock_calls[1] == \
            mocker.call().send({
                'text': room.encode_message(msg3)
            }, immediately=True)
        assert len(send_mocks.channel_for_peer.mock_calls) == 2
        assert not send_mocks.group_class.called
        assert not send_mocks.should_save_message.called

        assert not send_mocks.add_message.called
