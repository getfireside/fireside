import uuid
import json
import random

from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.postgres.fields import JSONField
from channels import Group, Channel
from model_utils import Choices

from fireside import redis_conn
from accounts.models import User


def generate_id():
    return ''.join(random.choice(
        'ABCDEFGHIJKLMNPQRSTUVWXYZ'
        'abcdefghijkmnopqrstuvwxyz'
        '0123456789'
    ) for x in range(6))


class RoomManager(models.Manager):
    def create_with_owner(self, owner):
        room = self.create(owner=owner)
        RoomMembership.objects.create(
            room=room,
            participant=owner,
            role='o',
            joined=room.created,
        )
        return room


class Room(models.Model):
    MESSAGE_TYPE_MAP = {
        's': 'signalling',
        'm': 'message',
        'l': 'leave',
        'j': 'join-room',
        'a': 'announce',
        'e': 'event'
    }
    MESSAGE_TYPE_MAP_INVERSE = dict(
        (v, k) for k, v in MESSAGE_TYPE_MAP.items()
    )

    id = models.CharField(max_length=6, primary_key=True, default=generate_id)
    owner = models.ForeignKey('Participant', related_name='owned_rooms')
    members = models.ManyToManyField('Participant', through='RoomMembership', related_name='rooms')
    created = models.DateTimeField(auto_now_add=True)

    objects = RoomManager()

    @classmethod
    def encode_message(self, message):
        return json.dumps({
            't': self.MESSAGE_TYPE_MAP_INVERSE[message['type']],
            'p': message['payload']
        })

    @classmethod
    def message(self, type, payload):
        return {
            'type': type,
            'payload': payload
        }

    @property
    def group_name(self):
        return 'room.' + self.id

    def get_peer_id(self, participant):
        return redis_conn.get('rooms:{}:participants:{}:peer_id'.format(
            self.id,
            participant.id,
        ))

    def set_peer_id(self, participant):
        peer_id = uuid.uuid4().hex
        redis_conn.set('rooms:{}:participants:{}:peer_id'.format(
            self.id,
            participant.id,
        ), peer_id)
        return peer_id

    def connect_peer(self, peer_id, channel_name):
        redis_conn.sadd('rooms:{}:peers'.format(self.id), peer_id)
        self.set_peer_data(peer_id, 'channel', channel_name)

    def disconnect_peer(self, peer_id):
        redis_conn.srem('rooms:{}:peers'.format(self.id), peer_id)
        redis_conn.delete('rooms:{}:peers:{}'.format(self.id, peer_id))

    def set_peer_data(self, peer_id, key, data):
        redis_conn.hset(
            'rooms:{}:peers:{}'.format(self.id, peer_id),
            key,
            json.dumps(data)
        )

    def channel_for_peer(self, peer_id):
        return Channel(self.get_peer_data(peer_id, 'channel'))

    def get_peer_data(self, peer_id, key):
        return json.loads(redis_conn.hget(
            'rooms:{}:peers:{}'.format(self.id, peer_id),
            key
        ))

    def send(self, message, peer_id=None):
        if peer_id is None:
            to = Group(self.group_name)
        else:
            to = self.channel_for_peer(peer_id)
        return to.send({'text': self.encode_message(message)})

    def announce(self, peer_id, participant):
        from .serializers import PeerSerializer
        mem = self.memberships.get(participant=participant)
        self.send(self.message('announce', {
           'peer': PeerSerializer({
                'id': peer_id,
                'uid': mem.id,
                'info': {
                    'name': mem.get_display_name(),
                    'recordings': self.recordings.filter(
                        participant=participant
                    ),
                    'role': mem.role,
                }
            }).data
        }))

    def join(self, participant, channel_name):
        if not self.members.filter(id=participant.id).exists():
            self.memberships.create(participant=participant)

        peer_id = self.get_peer_id(participant)
        if peer_id is None:
            peer_id = self.set_peer_id(participant)

        self.connect_peer(peer_id, channel_name)
        self.announce(peer_id, participant)
        return peer_id

    def add_message(self, type, data, from_participant, timestamp):
        self.messages.create(
            type=type,
            data=data,
            participant=from_participant,
            timestamp=timestamp,
        )


class RoomMembership(models.Model):
    ROLE = Choices(
        ('g', 'guest', 'Guest'),
        ('o', 'owner', 'Owner'),
    )
    participant = models.ForeignKey('Participant', related_name='memberships')
    room = models.ForeignKey('Room', related_name='memberships')
    name = models.CharField(max_length=64, blank=True, null=True)
    role = models.CharField(max_length=1, choices=ROLE, default=ROLE.guest)
    joined = models.DateTimeField(auto_now_add=True)

    def get_display_name():
        return self.name if self.name is not None else self.participant.name


class Message(models.Model):
    room = models.ForeignKey('Room')
    participant = models.ForeignKey('Participant', blank=True, null=True)
    type = models.CharField(max_length=16)
    data = JSONField()
    timestamp = models.DateTimeField(auto_now_add=True)


class Participant(models.Model):
    user = models.OneToOneField('accounts.User', blank=True, null=True,
                                related_name='participant')
    session_key = models.CharField(max_length=32, blank=True, null=True)
    name = models.CharField(max_length=64, blank=True, null=True)


@receiver(post_save, sender=User)
def create_participant_for_user(sender, instance, created, **kwargs):
    if created:
        Participant.objects.create(
            user=instance,
            name=instance.get_short_name()
        )
