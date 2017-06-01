import pytest
from django.urls import reverse
from rooms.models import Message, Room
import re
import datetime
from django.utils import timezone

@pytest.mark.django_db
class TestRoomJoinView:
    def test_returns_participant_id(self, api_client, empty_room, user2):
        url = reverse('rooms:join', kwargs={'room_id': empty_room.id})
        api_client.force_login(user2)
        response = api_client.post(url, {
            'name': 'test'
        }, format='json')
        assert empty_room.memberships.filter(
            participant=user2.participant
        ).exists()
        assert response.data == {'uid': user2.participant.id}


@pytest.mark.django_db
class TestCreateRoomView:
    def test_405_if_get(self, api_client):
        url = reverse('rooms:create')
        response = api_client.get(url)
        assert response.status_code == 405

    def test_redirects_and_creates_room(self, api_client):
        url = reverse('rooms:create')
        response = api_client.post(url)
        assert response.status_code == 302
        room_id = re.match(r'/rooms/(\w+)/', response.url)[1]
        room = Room.objects.get(id=room_id)
        assert room.owner.session_key == api_client.session.session_key


@pytest.mark.django_db
class TestRoomMessagesView:
    def test_403_if_non_existent_room(self, api_client):
        url = reverse('rooms:messages', kwargs={'room_id': 'ZZZZZZ'})
        response = api_client.get(url)
        assert response.status_code == 403

    def test_403_if_not_in_room(self, api_client, room, participant3,
                                participant3_client):
        url = reverse('rooms:messages', kwargs={'room_id': room.id})
        response = api_client.get(url)
        assert response.status_code == 403
        response2 = participant3_client.get(url)
        assert response2.status_code == 403

    def test_data(self, api_client, room, user):
        msg1 = room.messages.create(
            type='e',
            payload={'type': 'test', 'data': {'foo': 'bar'}},
        )
        msg2 = room.messages.create(type='a', payload={'foo': 'baz'})
        url = reverse('rooms:messages', kwargs={'room_id': room.id})
        api_client.force_login(user)
        response = api_client.get(url)
        assert response.data == [{
            'id': msg2.id,
            'type': 'a',
            'payload': {'foo': 'baz'},
            'timestamp': int(msg2.timestamp.timestamp() * 1000),
            'uid': None,
            'peer_id': None,
        }, {
            'id': msg1.id,
            'type': 'e',
            'payload': {'type': 'test', 'data': {'foo': 'bar'}},
            'timestamp': int(msg1.timestamp.timestamp() * 1000),
            'uid': None,
            'peer_id': None,
        }]

    @pytest.mark.skip
    def test_pagination(self):
        pass

    def test_until(self, api_client, room, user):
        messages = [room.messages.create(
            type='e',
            payload={
                'type': 'test',
                'data': x,
            },
            timestamp= datetime.datetime(2000, 1, 1, 0, 0, 0) + datetime.timedelta(days=x)
        ) for x in range(100)]
        url = reverse('rooms:messages', kwargs={'room_id': room.id})
        url += f"?until={int(datetime.datetime(2000, 3, 1, 0, 0, 0).timestamp() * 1000)}"
        api_client.force_login(user)
        response = api_client.get(url)
        assert [x['id'] for x in response.data] == [x.id for x in messages[:60][::-1]]

    @pytest.mark.usefixtures('redisdb')
    def test_create_success_with_valid_data(self, api_client, room, user):
        url = reverse('rooms:messages', kwargs={'room_id': room.id})
        peer_id = room.connect(user.participant, 'channel_name')
        api_client.force_login(user)
        resp = api_client.post(url, {
            'type': 'e',
            'payload': {
                'type': 'test',
                'data': {'foo': 'bar'}
            }
        }, format='json')
        msg = room.messages.latest()
        assert msg.type == 'e'
        assert msg.payload == {
            'type': 'test',
            'data': {'foo': 'bar'}
        }
        assert (timezone.now() - msg.timestamp).total_seconds() < 1
        assert msg.participant == user.participant
        assert msg.peer_id.hex == peer_id
        assert resp.data == {
            'timestamp': msg.timestamp.timestamp() * 1000,
            'id': msg.id
        }

    @pytest.mark.skip
    def test_create_400_with_invalid_data():
        pass

@pytest.mark.django_db
class TestRecordingsView:
    def test_403_if_non_existent_room(self, api_client):
        url = reverse('rooms:recordings', kwargs={'room_id': 'ZZZZZZ'})
        response = api_client.post(url)
        assert response.status_code == 403

    def test_403_if_not_in_room(self, api_client, room, participant3,
                                participant3_client):
        url = reverse('rooms:recordings', kwargs={'room_id': room.id})
        response = api_client.get(url)
        assert response.status_code == 403
        response2 = participant3_client.post(url)
        assert response2.status_code == 403

    @pytest.mark.usefixtures('redisdb', 'channel_test')
    def test_create_valid(self, room, api_client, user, user2, mocker):
        peer_id = room.connect(user.participant, 'user_channel')
        peer2_id = room.connect(user2.participant, 'user2_channel')

        api_client.force_login(user)
        url = reverse('rooms:recordings', kwargs={'room_id': room.id})
        mock_send = mocker.patch('rooms.models.room.Room.send', autospec=True)
        rec_data = {
            'id': '827f29c5-8721-4eca-8b86-5ec4c5b5c794',
            'started': 1493823158970,
            'ended': None,
            'filesize': None,
            'uid': user.participant.id,
            'type': 'audio/wav'
        }
        response = api_client.post(url, rec_data, format='json')
        msg = mock_send.call_args[0][1]
        assert msg.type == 'e'
        assert msg.payload['type'] == 'start_recording'
        assert msg.payload['data'] == {'room_id': room.id, **rec_data}
        assert response.status_code == 201

    def test_errors_invalid(self, room, api_client, user):
        api_client.force_login(user)
        url = reverse('rooms:recordings', kwargs={'room_id': room.id})
        response = api_client.post(url, {
            'id': '827f29c5-8721-4eca-8b86-5ec4c5b5c794',
            'started': None,
            'ended': None,
            'filesize': None,
            'uid': None,
            'type': None
        }, format='json')
        assert response.status_code == 400
        assert 'uid' in response.data
        assert 'type' in response.data
        assert 'started' in response.data


@pytest.mark.django_db
class TestRoomActionView:
    def test_403_if_non_existent_room(self, api_client):
        url = reverse('rooms:action', kwargs={
            'room_id': 'ZZZZZZ',
            'name': 'start_recording'
        })
        response = api_client.get(url)
        assert response.status_code == 403

    def test_403_if_not_in_room(self, api_client, room, participant3,
                                participant3_client):
        url = reverse('rooms:action', kwargs={
            'room_id': room.id,
            'name': 'start_recording'
        })
        response = api_client.post(url)
        assert response.status_code == 403
        response2 = participant3_client.post(url)
        assert response2.status_code == 403

    def test_403_if_not_admin(self, api_client, room, user2):
        url = reverse('rooms:action', kwargs={
            'room_id': room.id,
            'name': 'start_recording',
        })
        api_client.force_login(user2)
        response = api_client.post(url)
        assert response.status_code == 403

    def test_400_if_non_existent_action(self, api_client, room, user):
        url = reverse('rooms:action', kwargs={
            'room_id': room.id,
            'name': 'brew_tea',
        })
        api_client.force_login(user)
        response = api_client.post(url)
        assert response.status_code == 400

    recording_actions = ['start_recording', 'stop_recording']

    @pytest.mark.parametrize('action_name', recording_actions)
    @pytest.mark.usefixtures('redisdb', 'channel_test')
    def test_start_stop_recording(self, action_name, api_client, room, user,
                                  user2, mocker):
        peer_id = room.connect(user.participant, 'user_channel')
        peer2_id = room.connect(user2.participant, 'user2_channel')
        url = reverse('rooms:action', kwargs={
            'room_id': room.id,
            'name': action_name,
        })
        api_client.force_login(user)
        mock_send = mocker.patch('rooms.models.room.Room.send', autospec=True)
        response = api_client.post(url, {
            'peer_id': peer2_id
        }, format='json')
        assert response.status_code == 200
        msg = mock_send.call_args[0][1]

        assert msg.type == Message.TYPE.event
        assert msg.payload == {
            'type': f'request_{action_name}',
            'data': {'target': peer2_id},
        }
        assert msg.peer_id == peer_id
        assert msg.participant_id == room.owner.id

    @pytest.mark.usefixtures('redisdb', 'channel_test')
    def test_update_config(self, api_client, room, user, user2, mocker):
        peer_id = room.connect(user.participant, 'user_channel')
        peer2_id = room.connect(user2.participant, 'user2_channel')
        url = reverse('rooms:action', kwargs={
            'room_id': room.id,
            'name': 'update_config',
        })
        api_client.force_login(user)
        mock_send = mocker.patch('rooms.models.room.Room.send', autospec=True)
        response = api_client.post(url, {
            'mode': 'video',
            'video_bitrate': None,
        }, format='json')
        assert response.status_code == 200
        msg = mock_send.call_args[0][1]

        assert msg.type == Message.TYPE.event
        assert msg.payload == {
            'type': f'update_config',
            'data': {
                'mode': 'video',
                'video_bitrate': None,
            },
        }
