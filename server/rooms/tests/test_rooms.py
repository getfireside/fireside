import pytest
import json

from rooms.models import Room
# from channels.test import ChannelTestCase
from fireside import redis_conn

pytestmark = pytest.mark.django_db


def test_create_with_owner(user, participant3):
    room1 = Room.objects.create_with_owner(user.participant)
    assert room1.owner == user.participant
    mem1 = room1.memberships.get()
    assert mem1.participant == user.participant
    assert mem1.role == mem1.ROLE.owner

    room2 = Room.objects.create_with_owner(participant3)
    assert room2.owner == participant3

@pytest.mark.usefixtures('redisdb')
def test_join_new_participant(empty_room, participant3, mocker):
    m1 = mocker.patch('rooms.models.Room.connect_peer')
    m2 = mocker.patch('rooms.models.Room.announce')
    peer_id = empty_room.join(participant3, channel_name='test_channel_name')
    assert isinstance(peer_id, str)
    assert peer_id == empty_room.get_peer_id(participant3)
    mem = empty_room.memberships.get(
        participant=participant3
    )
    assert mem.role == mem.ROLE.guest

    m1.assert_called_once_with(peer_id, 'test_channel_name')
    m2.assert_called_once_with(peer_id, participant3)


@pytest.mark.usefixtures('redisdb')
def test_join_existing_participant(room, user, mocker):
    m1 = mocker.patch('rooms.models.Room.connect_peer')
    m2 = mocker.patch('rooms.models.Room.announce')
    peer_id = room.join(user.participant, channel_name='test_channel_name')
    assert isinstance(peer_id, str)
    assert peer_id == room.get_peer_id(user.participant)
    mem = room.memberships.get(
        participant=user.participant
    )
    assert mem.role == mem.ROLE.owner

    m1.assert_called_once_with(peer_id, 'test_channel_name')
    m2.assert_called_once_with(peer_id, user.participant)


@pytest.mark.usefixtures('redisdb')
def test_get_and_set_peer_id(room, participant3):
    peer_id = room.set_peer_id(participant3)
    assert isinstance(peer_id, str)
    assert len(peer_id) == 32
    assert room.get_peer_id(participant3) == peer_id
    assert room.get_peer_id(room.owner) is None


@pytest.mark.usefixtures('redisdb')
def test_connect_peer(room, mocker):
    m1 = mocker.patch('rooms.models.Room.set_peer_data')
    peer_id = '443ecc03b59f46809854a965defb2d03'
    room.connect_peer(
        peer_id,
        'peer_channel_name',
    )
    m1.assert_called_once_with(
        peer_id,
        'channel',
        'peer_channel_name',
    )
    assert redis_conn.sismember(
        'rooms:{}:peers'.format(room.id),
        peer_id,
    )


@pytest.mark.usefixtures('redisdb')
def test_get_and_set_peer_data(empty_room):
    testdata = {'foo': 'bar', 'foo2': 231}
    peer_id = '443ecc03b59f46809854a965defb2d03'
    empty_room.set_peer_data(peer_id, 'test', testdata)
    assert redis_conn.hget(
        'rooms:{}:peers:{}'.format(
            empty_room.id,
            peer_id
        ), 'test'
    ) == json.dumps(testdata)
    assert empty_room.get_peer_data(peer_id, 'test') == testdata


def test_encode_message(empty_room):
    for short_type, type in empty_room.MESSAGE_TYPE_MAP.items():
        res = empty_room.encode_message({
            'type': type,
            'payload': {'foo': 'bar'}
        })
        assert isinstance(res, str)
        data = json.loads(res)
        assert data['t'] == short_type
        assert data['p'] == {'foo': 'bar'}


def test_message(empty_room):
    assert empty_room.message(type='t', payload={'foo': 'bar'}) == {
        'type': 't',
        'payload': {'foo': 'bar'}
    }
