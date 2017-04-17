import pytest
from django.contrib.auth.models import AnonymousUser
from accounts.models import User
from rooms.models import Participant

pytestmark = pytest.mark.django_db


def test_create_participant_with_user():
    u = User.objects.create_user('inigo@example.com')
    assert u.participant is not None
    assert u.participant.name == u.first_name


def test_get_participant_from_request(rf, user, participant3, mocker):
    req1 = rf.get('/')
    req1.user = user
    req1.session = None
    assert Participant.objects.from_request(req1) == user.participant
    req2 = rf.get('/')
    req2.user = AnonymousUser()
    req2.session = mocker.MagicMock()
    req2.session.session_key = participant3.session_key
    assert Participant.objects.from_request(req2) == participant3
