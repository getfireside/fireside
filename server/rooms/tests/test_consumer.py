import pytest
from channels.test import HttpClient
from django.utils.timezone import now
from datetime import timedelta
from rooms.models import RoomMembership, Message
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
def client3(participant3, participant3_client):
    client = HttpClient()
    client._session = participant3_client.session
    client.participant = participant3
    return client


@pytest.fixture
def joined_clients(room, client, client2):
    client.send_and_consume('websocket.connect', path=room.get_socket_url())
    client.consume('room.join')
    client.peer_id = client.receive()['p']['self']['peer_id']
    client2.send_and_consume('websocket.connect', path=room.get_socket_url())
    client2.consume('room.join')
    client2.peer_id = client2.receive()['p']['self']['peer_id']
    client.receive()
    client.membership = room.memberships.get(
        participant=client.user.participant
    )
    client2.membership = room.memberships.get(
        participant=client2.user.participant
    )
    return client, client2


@pytest.mark.usefixtures('redisdb', 'channel_test')
@pytest.mark.django_db
class TestRoomConsumer:
    def send_message(self, client, room, **kwargs):
        msg = room.message(**kwargs)
        client.send_and_consume('websocket.receive', {
            'text': room.encode_message(msg),
            'path': room.get_socket_url(),
        })
        # just consuming the websocket alone isn't enough
        # have to also consume on the room receive channel
        client.consume('room.receive')

    def get_message(self, client, room):
        res = client.receive()
        if res is not None:
            return room.decode_message(res)
        else:
            return None

    def test_join(self, room, client, client2):
        client.send_and_consume(
            'websocket.connect',
            path=room.get_socket_url()
        )
        client.consume('room.join')

        # should receive only a join message
        # members should contain both disconnected and connected members
        msg = self.get_message(client, room)
        assert msg.type == Message.TYPE.join
        assert msg.payload['members'] == [{
            'info': {
                'current_recording_id': None,
                'name': 'HAL',
                'recordings': [],
                'role': 'o'
            },
            'peer_id': None,
            'status': 0,
            'uid': 1
        }, {
            'info': {
                'current_recording_id': None,
                'name': 'Dave',
                'recordings': [],
                'role': 'g'
            },
            'peer_id': None,
            'status': 0,
            'uid': 2
        }]

        joined_peer1 = msg.payload['self']
        assert 'peer_id' in joined_peer1
        assert joined_peer1['uid'] == room.owner.id
        assert joined_peer1['info']['name'] == 'HAL'
        assert joined_peer1['info']['role'] == 'o'

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

        # make sure client1 received announce
        msg2 = self.get_message(client, room)
        assert msg2.type == Message.TYPE.announce

        expected_peer2 = {
            'uid': client2.user.participant.id,
            'status': RoomMembership.STATUS.connected,
            'info': {
                'current_recording_id': None,
                'role': 'g',
                'name': 'Dave',
                'disk_usage': None,
                'resources': None,
                'recordings': [RecordingSerializer(rec).data]
            }
        }
        assert msg2.payload['peer'].items() >= expected_peer2.items()

        # and then that client2 got a proper join message too
        msg3 = self.get_message(client2, room)
        assert msg3.type == Message.TYPE.join
        peer1_data = msg3.payload['members'][0]

        assert len(msg3.payload['members']) == 2
        assert (
            msg3.payload['members'][0]['status'] ==
            RoomMembership.STATUS.connected
        )
        assert joined_peer1['peer_id'] == peer1_data['peer_id']
        assert joined_peer1['uid'] == peer1_data['uid']
        assert joined_peer1['info'].items() <= peer1_data['info'].items()

    def test_signalling(self, room, joined_clients):
        client, client2 = joined_clients
        self.send_message(
            room=room,
            client=client,
            type=Message.TYPE.signalling,
            payload={'foo': 'bar', 'to': client2.peer_id}
        )

        msg = self.get_message(client2, room)
        assert msg.type == Message.TYPE.signalling
        assert msg.payload == {
            'to': client2.peer_id,
            'foo': 'bar',
        }

        assert self.get_message(client, room) is None

        # the room shouldn't store the signalling message
        assert room.messages.count() == 2

    def test_leave(self, room, joined_clients):
        client, client2 = joined_clients
        client2.send_and_consume(
            'websocket.disconnect',
            path=room.get_socket_url()
        )
        client2.consume('room.leave')

        # client should have got a leave message
        msg = self.get_message(client, room)
        assert msg.type == Message.TYPE.leave
        assert msg.payload == {
            'id': client2.peer_id,
        }

    def test_recording_start_event(self, room, joined_clients):
        client, client2 = joined_clients
        rec = room.create_recording(
            started=now(),
            participant=client2.user.participant,
            type='audio/wav',
            id=uuid.uuid4()
        )

        msg = self.get_message(client, room)
        assert msg.type == Message.TYPE.event
        assert msg.payload['type'] == 'start_recording'
        assert msg.payload['data'] == RecordingSerializer(rec).data
        assert msg.participant == client2.user.participant
        assert self.get_message(client2, room) == msg

    def test_disk_usage_event(self, room, joined_clients, client3):
        client, client2 = joined_clients
        disk_usage = {
            'quota': 1024**3, 'usage': 1024**2
        }
        self.send_message(
            room=room,
            client=client,
            type=Message.TYPE.event,
            payload={
                'type': 'update_status',
                'data': {'disk_usage': disk_usage}
            }
        )
        assert client.membership.disk_usage == disk_usage
        msg = self.get_message(client2, room)
        assert msg.type == Message.TYPE.event
        assert msg.payload['type'] == 'update_status'
        assert msg.payload['data'] == {'disk_usage': disk_usage}
        assert msg.participant == client.user.participant

        # check if disk usage is present on initial message when
        # third client joins
        room.memberships.create(participant=client3.participant)
        client3.send_and_consume(
            'websocket.connect',
            path=room.get_socket_url()
        )
        client3.consume('room.join')
        msg2 = self.get_message(client3, room)
        assert msg2.type == Message.TYPE.join
        members = msg2.payload['members']
        member_data = next(
            m for m in members if m['peer_id'] == client.peer_id
        )
        assert member_data['info']['disk_usage'] == disk_usage

    def test_resources_event(self, room, joined_clients, client3):
        client, client2 = joined_clients
        resources = {
            'audio': True, 'video': {'resolution': [1280, 720]}
        }
        self.send_message(
            room=room,
            client=client,
            type=Message.TYPE.event,
            payload={
                'type': 'update_status',
                'data': {'resources': resources}
            }
        )
        assert client.membership.resources == resources
        msg = self.get_message(client2, room)
        assert msg.type == Message.TYPE.event
        assert msg.payload['type'] == 'update_status'
        assert msg.payload['data'] == {'resources': resources}
        assert msg.participant == client.user.participant

        # check if disk usage is present on initial message when
        # third client joins
        room.memberships.create(participant=client3.participant)
        client3.send_and_consume(
            'websocket.connect',
            path=room.get_socket_url()
        )
        client3.consume('room.join')
        msg2 = self.get_message(client3, room)
        assert msg2.type == Message.TYPE.join
        members = msg2.payload['members']
        member_data = next(
            m for m in members if m['peer_id'] == client.peer_id
        )
        assert member_data['info']['resources'] == resources
