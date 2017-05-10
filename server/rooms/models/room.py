import uuid
import json
import random

from django.db import models
from django.core.urlresolvers import reverse
from django.utils.timezone import now

from channels import Group, Channel
from model_utils import Choices

from fireside import redis_conn

from .message import Message
from .. import serializers
import recordings.serializers


class RoomManager(models.Manager):
    @classmethod
    def generate_id(cls):
        return ''.join(random.choice(
            'ABCDEFGHIJKLMNPQRSTUVWXYZ'
            'abcdefghijkmnopqrstuvwxyz'
            '0123456789'
        ) for x in range(6))

    def create_with_owner(self, owner):
        room = self.create(owner=owner)
        RoomMembership.objects.create(
            room=room,
            participant=owner,
            role='o',
            joined=room.created,
            name=owner.name or 'anonymous',
        )
        return room


class Room(models.Model):
    ACTION_TYPES = [
        'start_recording',
        'stop_recording',
        'kick'
    ]

    id = models.CharField(
        max_length=6,
        primary_key=True,
        default=RoomManager.generate_id
    )
    owner = models.ForeignKey('Participant', related_name='owned_rooms')
    members = models.ManyToManyField('Participant',
        through='RoomMembership',
        related_name='rooms'
    )
    created = models.DateTimeField(auto_now_add=True)

    objects = RoomManager()

    @property
    def owner_membership(self):
        return self.memberships.get(participant=self.owner)

    def is_admin(self, participant):
        return participant == self.owner

    def can_access(self, participant):
        return self.memberships.filter(participant=participant).exists()

    def is_valid_action(self, action_name):
        return action_name in self.ACTION_TYPES

    def message(self, type, payload, timestamp=None, participant_id=None,
                peer_id=None, id=None):
        return Message(
            type=type,
            payload=payload,
            timestamp=timestamp or now(),
            participant_id=participant_id,
            peer_id=peer_id,
            id=id,
            room=self
        )

    @classmethod
    def encode_message_dict(cls, message_dict):
        out = {
            k: message_dict[v]
            for k, v in Message.ENCODING_KEY_MAP.items()
            if v in message_dict
        }
        if not out.get('t') or not out.get('p'):
            raise ValueError("Invalid message")
        return json.dumps(out)

    def encode_message(self, message):
        data = serializers.MessageSerializer(message).data
        if 'uid' in data:
            # rename.
            # TODO: do in a nicer way?
            data['participant_id'] = data['uid']
            del data['uid']
        return self.encode_message_dict(data)

    def decode_message(self, message_dict):
        return self.message(**self.decode_message_dict(message_dict))

    def receive_event(self, message):
        # TODO TEST ME TEST ME TEST ME
        assert message.type == Message.TYPE.event
        event = message.payload
        if event['type'] == 'update_status':
            # TODO refactor this bit - maybe serializer?
            if 'disk_usage' in event['data']:
                self.set_peer_data(
                    message.peer_id,
                    'disk_usage',
                    event['data']['disk_usage']
                )
            elif 'resources' in event['data']:
                self.set_peer_data(
                    message.peer_id,
                    'resources',
                    event['data']['resources']
                )
            elif 'recorder_status' in event['data']:
                self.set_peer_data(
                    message.peer_id,
                    'recorder_status',
                    event['data']['recorder_status']
                )

        if event['type'] == 'stop_recording':
            update = recordings.serializers.RecordingSerializer(data=event['data'], partial=True)
            if update.is_valid():
                if self.recordings.filter(
                    id=event['data']['id'],
                    participant=message.participant
                ).exists():
                    self.recordings.filter(id=event['data']['id']).update(**update.validated_data)

        self.send(message)

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

    @property
    def group_name(self):
        return 'room.' + self.id

    @property
    def connected_memberships(self):
        participant_ids = redis_conn.hvals(f'rooms:{self.id}:peers')
        return self.memberships.filter(participant__in=participant_ids)

    def get_memberships_with_peer_ids(self):
        participant_peers = {
            int(v): k
            for k, v in redis_conn.hgetall(f'rooms:{self.id}:peers').items()
        }
        memberships = []
        for mem in self.memberships.filter(
            participant__in=participant_peers.keys()
        ):
            mem._peer_id = participant_peers[mem.participant_id]
            memberships.append(mem)
        for mem in self.memberships.exclude(
            participant__in=participant_peers.keys()
        ):
            mem._peer_id = None
            memberships.append(mem)
        return memberships

    def get_peer_id(self, participant):
        return redis_conn.get(f'rooms:{self.id}:participants:'
                              f'{participant.id}:peer_id')

    def set_peer_id(self, participant):
        peer_id = uuid.uuid4().hex
        redis_conn.set(
            f'rooms:{self.id}:participants:{participant.id}:peer_id',
            peer_id)
        return peer_id

    def get_peer_ids(self):
        return redis_conn.hkeys(f'rooms:{self.id}:peers')

    def connect_peer(self, peer_id, channel_name, participant):
        redis_conn.hset(
            f'rooms:{self.id}:peers',
            peer_id,
            participant.id
        )
        self.set_peer_data(peer_id, 'channel', channel_name)

    def disconnect_peer(self, peer_id):
        redis_conn.hdel(f'rooms:{self.id}:peers', peer_id)
        redis_conn.delete(f'rooms:{self.id}:peers:{peer_id}')

    def set_peer_data(self, peer_id, key, data):
        redis_conn.hset(
            f'rooms:{self.id}:peers:{peer_id}',
            key,
            json.dumps(data)
        )

    def channel_for_peer(self, peer_id):
        return Channel(self.get_peer_data(peer_id, 'channel'))

    def get_peer_data(self, peer_id, key):
        res = redis_conn.hget(
            f'rooms:{self.id}:peers:{peer_id}',
            key
        )
        if res is not None:
            return json.loads(res)
        else:
            return res

    def get_initial_data(self):
        return serializers.InitialRoomDataSerializer(self).data

    def send(self, message, to_peer=None, save=None, immediately=True):
        if to_peer is None:
            to = Group(self.group_name)
        else:
            to = self.channel_for_peer(to_peer)
        if save is None and to_peer is None:
            save = self.should_save_message(message)
        if save:
            self.add_message(message)
        to.send(
            {'text': self.encode_message(message)},
            immediately=immediately
        )

    def send_action_event(self, name, target_peer_id, from_peer_id,
                          from_participant, data=None):
        if data is None:
            data = {}
        self.send(self.message(
            type=Message.TYPE.event,
            payload={
                'type': name,
                'data': {
                    'target': target_peer_id,
                    **data
                },
            },
            peer_id=from_peer_id,
            participant_id=from_participant.id
        ))

    def start_recording(self, *args, **kwargs):
        # FIXME: probably should check if peer is recording before actually
        # transmitting
        return self.send_action_event('request_start_recording',
            *args, **kwargs
        )

    def stop_recording(self, *args, **kwargs):
        # FIXME: probably should check if peer is recording before actually
        # transmitting
        return self.send_action_event('request_stop_recording',
            *args, **kwargs
        )

    def kick(self, peer_id, from_peer_id):
        # TODO: implement kick
        raise NotImplementedError

    def announce(self, peer_id, participant):
        mem = self.memberships.get(participant=participant)
        mem._peer_id = peer_id
        self.send(self.message(
            type=Message.TYPE.announce,
            payload={
                'peer': serializers.MembershipSerializer(mem).data
            },
            participant_id=participant.id,
            peer_id=peer_id
        ))

    def leave(self, peer_id, participant):
        self.disconnect_peer(peer_id)
        self.send(self.message(
            type=Message.TYPE.leave,
            payload={
                'id': peer_id
            },
            participant_id=participant.id,
            peer_id=peer_id
        ))

    def join(self, participant, channel_name):
        # TODO fix tests
        if not self.members.filter(id=participant.id).exists():
            raise RoomMembership.DoesNotExist

        peer_id = self.get_peer_id(participant)
        if peer_id is None:
            peer_id = self.set_peer_id(participant)

        self.connect_peer(peer_id, channel_name, participant)
        self.announce(peer_id, participant)
        return peer_id

    def create_recording(self, **kwargs):
        rec = self.recordings.create(**kwargs)
        rec.peer_id = self.get_peer_id(rec.participant)
        self.send(self.message(
            type=Message.TYPE.event,
            payload={
                'type': 'start_recording',
                'data': recordings.serializers.RecordingSerializer(rec).data,
            },
            participant_id=rec.participant.id,
            peer_id=rec.peer_id
        ))
        return rec

    def add_message(self, message):
        if message.id is not None:
            raise ValueError("This message was already added.")
        message.room = self
        message.save()

    def should_save_message(self, message):
        if message.type in (Message.TYPE.leave, Message.TYPE.announce):
            return True
        if message.type in (
            Message.TYPE.join,
            Message.TYPE.signalling,
            Message.TYPE.action
        ):
            return False
        if message.type == Message.TYPE.event:
            event_type = message.payload['type']
            if event_type in (
                'update_recording',
                'update_meter',
                'upload_progress',
            ):
                return False
            else:
                if event_type == 'update_status':
                    if 'disk_usage' in message.payload['data']:
                        return False
                    if 'resources' in message.payload['data']:
                        return False
            return True

    def get_socket_url(self):
        return self.get_absolute_url() + "socket"

    def get_full_socket_url(self):
        return "ws://localhost:8000" + self.get_socket_url()

    def get_absolute_url(self):
        return reverse('rooms:room', kwargs={'room_id': self.id})

    def get_join_url(self):
        return reverse('rooms:join', kwargs={'room_id': self.id})

    def get_messages_url(self):
        return reverse('rooms:messages', kwargs={'room_id': self.id})

    def get_recordings_url(self):
        return reverse('rooms:recordings', kwargs={'room_id': self.id})


class RoomMembership(models.Model):
    ROLE = Choices(
        ('g', 'guest', 'Guest'),
        ('o', 'owner', 'Owner'),
    )
    STATUS = Choices(
        (0, 'disconnected', 'Disconnected'),
        (1, 'connected', 'Connected'),
    )
    participant = models.ForeignKey('Participant', related_name='memberships')
    room = models.ForeignKey('Room', related_name='memberships')
    name = models.CharField(max_length=64, blank=True, null=True)
    role = models.CharField(max_length=1, choices=ROLE, default=ROLE.guest)
    joined = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('room', 'participant')

    @property
    def status(self):
        if self.peer_id:
            return self.STATUS.connected
        else:
            return self.STATUS.disconnected

    @property
    def peer_id(self):
        if hasattr(self, '_peer_id'):
            return self._peer_id
        else:
            return self.room.get_peer_id(self.participant)

    @property
    def current_recording_id(self):
        return (
            self.recordings.latest().values_list('id', flat=True) or
            [None]
        )[0]

    @property
    def current_recording(self):
        return self.recordings.latest()

    @property
    def disk_usage(self):
        if self.peer_id:
            return self.room.get_peer_data(self.peer_id, 'disk_usage')
        else:
            return None

    @property
    def resources(self):
        if self.peer_id:
            return self.room.get_peer_data(self.peer_id, 'resources')
        else:
            return None

    @property
    def recorder_status(self):
        if self.peer_id:
            return self.room.get_peer_data(self.peer_id, 'recorder_status')
        else:
            return None

    @property
    def recordings(self):
        return self.participant.recordings.all().filter(room=self.room)

    def get_display_name(self):
        if self.name is not None:
            return self.name
        else:
            return self.participant.get_display_name()
