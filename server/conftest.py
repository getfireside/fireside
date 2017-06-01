import pytest
from django.utils.timezone import now
from datetime import timedelta
from rest_framework.test import APIClient
from channels.test import ChannelTestCase

from accounts.models import User
from rooms.models import Room, Participant
from recordings.models import Recording


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user():
    return User.objects.create_user(
        email='hal@example.com',
        password='hal',
        first_name='HAL',
        last_name='9000',
    )


@pytest.fixture
def user2():
    return User.objects.create_user(
        email='dave@example.com',
        password='dave',
        first_name='Dave',
        last_name='Bowman'
    )


@pytest.fixture
def participant3_client():
    c = APIClient()
    c.session.save()
    return c


@pytest.fixture
def participant3(participant3_client):
    return Participant.objects.create(
        session_key=participant3_client.session.session_key,
        name='Frank Poole'
    )


@pytest.fixture
def room(user, user2):
    room = Room.objects.create_with_owner(
        owner=user.participant
    )
    room.memberships.create(participant=user.participant, role='o')
    room.memberships.create(participant=user2.participant, role='g')
    return room


@pytest.fixture
def recording(room, user):
    return Recording.objects.create(
        participant=user.participant,
        room=room,
        type='video/webm',
        filesize=650 * 1024 ** 2,
        started=now() - timedelta(minutes=20),
        ended=now(),
    )


@pytest.fixture
def recording2(room, user2):
    return Recording.objects.create(
        participant=user2.participant,
        room=room,
        type='video/webm',
        filesize=648 * 1024 ** 2,
        started=now() - timedelta(minutes=19, seconds=50),
        ended=now(),
    )


@pytest.fixture
def empty_room(user):
    room = Room.objects.create_with_owner(owner=user.participant)
    room.memberships.create(participant=user.participant, role='o')
    return room


@pytest.fixture
def channel_test(request):
    t = ChannelTestCase()
    t._pre_setup()
    if request.cls:
        request.cls.channel_test = t
    yield t
    t._post_teardown()
