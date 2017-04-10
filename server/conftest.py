from rest_framework.test import APIClient
import pytest

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
def participant3():
    return Participant.objects.create(
        session_key='woaijdosi2190u3',
        name='Frank Poole'
    )


@pytest.fixture
def room(user, user2):
    room = Room.objects.create_with_owner(
        owner=user.participant
    )
    room.memberships.create(participant=user2.participant)
    return room

@pytest.fixture
def recording(room, user):
    return Recording.objects.create(
        participant=user.participant,
        room=room,
        type='video/webm',
        filesize=650*1024**2,
        duration=60*20,
    )

@pytest.fixture
def recording2(room, user2):
    return Recording.objects.create(
        participant=user2.participant,
        room=room,
        type='video/webm',
        filesize=648*1024**2,
        duration=60*19,
    )


@pytest.fixture
def empty_room(user):
    room = Room.objects.create_with_owner(owner=user.participant)
    return room
