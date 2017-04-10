import pytest

from accounts.models import User

pytestmark = pytest.mark.django_db


def test_create_participant_with_user():
    u = User.objects.create_user('inigo@example.com')
    assert u.participant is not None
    assert u.participant.name == u.first_name
