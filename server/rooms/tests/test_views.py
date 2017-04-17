import pytest
from django.urls import reverse
from rooms.models import Message

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
        }, {
            'id': msg1.id,
            'type': 'e',
            'payload': {'type': 'test', 'data': {'foo': 'bar'}},
            'timestamp': int(msg1.timestamp.timestamp() * 1000),
        }]

    @pytest.mark.skip
    def test_pagination(self):
        pass

    @pytest.mark.skip
    def test_until(self):
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
    @pytest.mark.usefixtures('redisdb')
    def test_start_stop_recording(self, action_name, api_client, room, user, user2, mocker):
        peer_id = room.join(user.participant, 'user_channel')
        peer2_id = room.join(user2.participant, 'user2_channel')
        url = reverse('rooms:action', kwargs={
            'room_id': room.id,
            'name': action_name,
        })
        api_client.force_login(user)
        mock = mocker.patch('rooms.models.Group', autospec=True)
        response = api_client.post(url, {
            'peer_id': peer2_id
        }, format='json')
        assert response.status_code == 200
        expected_message = room.message('event', {
            'type': f'request_{action_name}',
            'data': {
                'from': peer_id,
                'target': peer2_id
            }
        })
        assert mock.method_calls == [mocker.call().send({
            'text': room.encode_message(expected_message)
        })]