import pytest
from channels.test import HttpClient
from django.utils.timezone import now
from datetime import timedelta
from rooms.models import Room, RoomMembership
from recordings.models import Recording
from recordings.serializers import RecordingSerializer
import uuid


@pytest.fixture
def client(user):
    client = HttpClient()
    client.user = user
    client.login(email='hal@example.com', password='hal')
    return client


@pytest.fixture
def client2(user2):
    client = HttpClient()
    client.user = user2
    client.login(email='dave@example.com', password='dave')
    return client


@pytest.fixture
def joined_clients(room, client, client2):
    client.send_and_consume('websocket.connect', path=room.get_socket_url())
    client.consume('room.join')
    client.peer_id = client.receive()['p']['peer']['id']
    client.receive()
    client2.send_and_consume('websocket.connect', path=room.get_socket_url())
    client2.consume('room.join')
    client2.peer_id = client2.receive()['p']['peer']['id']
    client.receive()
    client2.receive()
    return client, client2


@pytest.mark.usefixtures('redisdb', 'channel_test')
@pytest.mark.django_db
class TestRoomConsumer:
    def send_message(self, client, room, **kwargs):
        client.send_and_consume('websocket.receive', {
            'text': Room.encode_message(Room.message(**kwargs)),
            'path': room.get_socket_url(),
        })
        # just consuming the websocket alone isn't enough
        # have to also consume on the room receive channel
        client.consume('room.receive')

    def get_message(self, client):
        res = client.receive()
        if res is not None:
            return Room.decode_message(res)
        else:
            return None

    def test_join(self, room, client, client2):
        client.send_and_consume(
            'websocket.connect',
            path=room.get_socket_url()
        )
        client.consume('room.join')

        # receives announce message...
        msg = self.get_message(client)

        expected_peer = {
            'uid': room.memberships.get(
                participant=client.user.participant
            ).id,
            'status': RoomMembership.STATUS.connected,
            'info': {
                'current_recording_id': None,
                'role': 'o',
                'name': 'HAL',
                'recordings': []
            }
        }
        assert msg['type'] == 'announce'

        # test that peer is a superset of expected peer
        assert msg['payload']['peer'].items() >= expected_peer.items()

        # (we'll need this later)
        expected_peer['id'] = msg['payload']['peer']['id']

        # next message should be a join message
        msg2 = self.get_message(client)
        assert msg2['type'] == 'join'
        assert msg2['payload']['peers'] == []

        # now let's join another client, with a recording
        rec = Recording.objects.create(
            participant=client2.user.participant,
            room=room,
            type='video/webm',
            filesize=648 * 1024 ** 2,
            started=now() - timedelta(minutes=30),
            ended=now(),
        )
        client2.send_and_consume(
            'websocket.connect',
            path=room.get_socket_url()
        )
        client2.consume('room.join')

        # firstly, make sure both clients received the same announce messages
        msg3 = self.get_message(client)
        msg4 = self.get_message(client2)
        assert msg3 == msg4
        assert msg3['type'] == 'announce'

        expected_peer2 = {
            'uid': room.memberships.get(
                participant=client2.user.participant
            ).id,
            'status': RoomMembership.STATUS.connected,
            'info': {
                'current_recording_id': None,
                'role': 'g',
                'name': 'Dave',
                'recordings': [RecordingSerializer(rec).data]
            }
        }
        assert msg3['payload']['peer'].items() >= expected_peer2.items()

        # and then that client2 got a proper join message too
        msg5 = self.get_message(client2)
        assert msg5['type'] == 'join'
        assert msg5['payload']['peers'] == [expected_peer]

    def test_signalling(self, room, joined_clients):
        client, client2 = joined_clients
        self.send_message(
            room=room,
            client=client,
            type='signalling',
            payload={'foo': 'bar', 'to': client2.peer_id}
        )

        msg = self.get_message(client2)
        assert msg == {
            'type': 'signalling',
            'payload': {
                'to': client2.peer_id,
                'from': client.peer_id,
                'foo': 'bar',
            }
        }

        assert self.get_message(client) is None
        assert room.messages.count() == 2
        # the room shouldn't store the signalling message

    def test_leave(self, room, joined_clients):
        client, client2 = joined_clients
        client2.send_and_consume(
            'websocket.disconnect',
            path=room.get_socket_url()
        )
        client2.consume('room.leave')

        # client should have got a leave message
        msg = self.get_message(client)
        assert msg == {
            'type': 'leave',
            'payload': {
                'id': client2.peer_id,
            }
        }

    def test_recording_start_event(self, room, joined_clients):
        client, client2 = joined_clients
        rec = room.create_recording(
            started=now(),
            participant=client2.user.participant,
            type='audio/wav',
            id=uuid.uuid4()
        )

        msg = self.get_message(client)
        assert msg['type'] == 'event'
        assert msg['payload']['type'] == 'start_recording'
        assert msg['payload']['data'] == RecordingSerializer(rec).data
        assert self.get_message(client2) == msg
