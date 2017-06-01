import pytest
import json

from fireside import redis_conn
from rooms.peers import Peer

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures('redisdb')]

class TestRoomPeers:
    def test_get_for_participant(self, room, user2, participant3):
        peer_id = '443ecc03b59f46809854a965defb2d03'
        redis_conn.set(
            f'rooms:{room.id}:participants:{user2.participant.id}:peer_id',
            peer_id
        )
        peer = room.peers.for_participant(user2.participant)
        assert isinstance(peer, Peer)
        assert peer.id == peer_id
        assert room.peers.for_participant(participant3) is None

    @pytest.mark.usefixtures('redisdb')
    def test_connect_peer(self, room, user, mocker):
        m1 = mocker.patch('rooms.peers.PeerManager.set_peer_data')
        peer = room.peers.connect(
            participant=user.participant,
            channel_name='peer_channel_name',
        )
        m1.assert_called_once_with(
            peer.id,
            'channel',
            'peer_channel_name',
        )
        assert redis_conn.hget(
            f'rooms:{room.id}:peers',
            peer.id
        ) == str(user.participant.id)
        assert redis_conn.get(
            f'rooms:{room.id}:participants:{user.participant.id}:peer_id'
        ) == peer.id

    @pytest.mark.usefixtures('redisdb')
    def test_disconnect_peer(self, room, user):
        peer = room.peers.connect(
            participant=user.participant,
            channel_name='peer_channel_name',
        )
        peer.disconnect()
        assert not redis_conn.hexists(
            f'rooms:{room.id}:peers',
            peer.id
        )
        assert not redis_conn.exists(f'rooms:{room.id}:peers:{peer.id}')
        assert not redis_conn.exists(
            f'rooms:{room.id}:participants:{user.participant.id}'
        )

    @pytest.mark.usefixtures('redisdb')
    def test_get_participant(self, room, user, user2, participant3):
        peer = room.peers.connect(
            participant=user.participant,
            channel_name='peer_channel_name',
        )
        peer2 = room.peers.connect(
            participant=user2.participant,
            channel_name='peer_channel_name',
        )

        assert peer.participant == user.participant
        assert room.peers.get_participant_id(peer2.id) == (
            user2.participant.id
        )
        assert room.peers.participant_ids == [
            user.participant.id,
            user2.participant.id
        ]
        peer2.disconnect()
        assert room.peers.participant_ids == [user.participant.id]

    @pytest.mark.usefixtures('redisdb')
    def test_get_and_set_peer_data(self, empty_room, user):
        testdata = {'foo': 'bar', 'foo2': 231}
        peer = empty_room.peers.connect(user.participant, 'xxx')
        peer['test'] = testdata
        assert redis_conn.hget(
            f'rooms:{empty_room.id}:peers:{peer.id}',
            'test'
        ) == json.dumps(testdata)
        assert peer['test'] == testdata
        assert empty_room.peers.get_peer_data(peer.id, 'non-existent') is None