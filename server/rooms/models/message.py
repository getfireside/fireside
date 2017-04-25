from django.db import models
from django.contrib.postgres.fields import JSONField

from model_utils import Choices


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
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
