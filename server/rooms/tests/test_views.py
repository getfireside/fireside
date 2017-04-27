import pytest
from django.urls import reverse
from rooms.models import Message, Room
import re


@pytest.mark.skip
class TestRoomJoinView:
    pass


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

    @pytest.mark.skip
    def test_until(self):
        pass

    @pytest.mark.skip
    def test_create(self):
        pass


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
        peer_id = room.join(user.participant, 'user_channel')
        peer2_id = room.join(user2.participant, 'user2_channel')
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
