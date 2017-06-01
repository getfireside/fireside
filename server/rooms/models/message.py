from django.db import models
from django.contrib.postgres.fields import JSONField
from django.utils import timezone

from model_utils import Choices
import json

class Message(models.Model):
    TYPE = Choices(
        ('s', 'signalling', 'signalling'),
        ('e', 'event', 'event'),
        ('j', 'join', 'join'),
        ('a', 'announce', 'announce'),
        ('A', 'action', 'action'),
        ('l', 'leave', 'leave'),
    )
    ENCODING_KEY_MAP = {
        't': 'type',
        'T': 'timestamp',
        'p': 'payload',
        'P': 'peer_id',
        'u': 'participant_id',
        'i': 'id'
    }
    room = models.ForeignKey('Room', related_name='messages')
    participant = models.ForeignKey('Participant', blank=True, null=True)
    peer_id = models.UUIDField(blank=True, null=True)
    type = models.CharField(max_length=1, choices=TYPE)
    payload = JSONField()
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-timestamp']
        get_latest_by = 'timestamp'

    @classmethod
    def encode_message_dict(cls, message_dict):
        out = {
            k: message_dict[v]
            for k, v in cls.ENCODING_KEY_MAP.items()
            if v in message_dict
        }
        if not out.get('t') or not out.get('p'):
            raise ValueError("Invalid message")
        return json.dumps(out)

    def encode(self):
        from ..serializers import MessageSerializer
        data = MessageSerializer(self).data
        if 'uid' in data:
            # rename.
            # TODO: do in a nicer way?
            data['participant_id'] = data['uid']
            del data['uid']
        return self.encode_message_dict(data)


    @classmethod
    def decode(cls, message_dict):
        return cls(**cls.decode_message_dict(message_dict))

    @classmethod
    def decode_message_dict(cls, message_dict):
        try:
            decoded = {
                v: message_dict[k]
                for k, v in Message.ENCODING_KEY_MAP.items()
                if k in message_dict
            }
        except TypeError:
            raise ValueError("Invalid message")
        if (
            'type' not in decoded or
            'payload' not in decoded or
            decoded['type'] not in Message.TYPE
        ):
            print(message_dict)
            raise ValueError("Invalid message")
        return decoded
