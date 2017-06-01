import pytest
import json
from rooms.models import Room, Message


class TestMessageEncoding:
    def test_encode(self):
        for type, type_name in Message.TYPE:
            res = Message(
                room_id='ZZZZZ',
                type=type,
                payload={'foo': 'bar'}
            ).encode()
            assert isinstance(res, str)
            data = json.loads(res)
            assert data['t'] == type
            assert data['p'] == {'foo': 'bar'}
        with pytest.raises(ValueError, message='Invalid message'):
            Message().encode()
        with pytest.raises(ValueError, message='Invalid message'):
            Message(type=type).encode()
        with pytest.raises(ValueError, message='Invalid message'):
            Message(payload={2: 3}).encode()

    def test_decode(self):
        for type, type_name in Message.TYPE:
            msg = Message.decode({'t': type, 'p': {'foo': 'bar'}})
            assert msg.type == type
            assert msg.payload == {'foo': 'bar'}

        with pytest.raises(ValueError, message='Invalid message'):
            Message.decode({'t': 'fake', 'p': {'foo': 'bar'}})
        with pytest.raises(ValueError, message='Invalid message'):
            Message.decode({'a': 'b', 'c': 'd'})
        with pytest.raises(ValueError, message='Invalid message'):
            Message.decode(None)