import uuid
import json
import random

from django.db import models
from django.core.urlresolvers import reverse
from django.utils.timezone import now
from django.contrib.postgres.fields import JSONField
from django.conf import settings

from channels import Group, Channel
from model_utils import Choices

from fireside import redis_conn
import recordings.serializers

from .message import Message
from .. import serializers
from ..peers import PeerManager


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
        return room


class Room(models.Model):
    ACTION_TYPES = [
        'start_recording',
        'stop_recording',
        'kick',
        'update_config',
    ]

    ROOM_TYPES = ['audio', 'video']

    event_handlers = {}

    #: For now, all room IDs are 6-character randomly generated strings.
    id = models.CharField(
        max_length=6,
        primary_key=True,
        default=RoomManager.generate_id
    )

    #: The owner is the Participant who created the room.
    owner = models.ForeignKey('Participant', related_name='owned_rooms')

    members = models.ManyToManyField('Participant',
        through='RoomMembership',
        related_name='rooms'
    )
    created = models.DateTimeField(auto_now_add=True)

    #: Field for storing the room config.
    #: See RoomConfigSerializer for docs.
    config = JSONField(blank=True, null=True, default=dict)

    objects = RoomManager()

    # def get_config_json(self):
    #     return json.dumps(serializers.RoomConfigSerializer(self.config).data)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.peers = PeerManager(redis_conn, self)

    @property
    def owner_membership(self):
        """
        The membership belonging to the owner, or None if it doesn't exist yet
        """
        return self.memberships.filter(participant=self.owner).first()

    @property
    def connected_memberships(self):
        return self.memberships.filter(participant__in=self.peers.participant_ids)

    @property
    def group_name(self):
        return 'room.' + self.id

    def is_admin(self, participant):
        """Checks whether `participant` has admin rights for this room."""
        return participant == self.owner

    def is_member(self, participant):
        """Checks whether `participant` is a member of this room."""
        return self.memberships.filter(participant=participant).exists()

    def is_valid_action(self, action_name):
        """Checks whether `action_name` is a valid action."""
        return action_name in self.ACTION_TYPES

    def message(self, type, payload, timestamp=None, participant_id=None,
                peer_id=None, id=None):
        """Convenience method to initialize a message for this room."""
        return Message(
            type=type,
            payload=payload,
            timestamp=timestamp or now(),
            participant_id=participant_id,
            peer_id=peer_id,
            id=id,
            room=self
        )

    def receive_event(self, message):
        """
        Receive an event, represented by `message`, and perform action
        on it if necessary, before sending it to the room.
        """
        # TODO add a test
        assert message.type == Message.TYPE.event
        event = message.payload

        if event['type'] in self.event_handlers:
            self.event_handlers[event['type']](
                event=event,
                message=message,
                room=self,
            )

        self.send(message)

    def get_initial_data(self):
        return serializers.InitialRoomDataSerializer(self).data

    def send(self, message, to_peer_id=None, save=None):
        """
        Send `message` to the room (or, if `to_peer_id` is set, then just
        to that peer).
        By default, the message is saved depending on its type. This can
        be manually overridden by setting `save` to either True or
        False.
        """
        if to_peer_id is None:
            to = Group(self.group_name)
        else:
            to = self.peers[to_peer_id].channel
        if save is None and to_peer_id is None:
            save = self.should_save_message(message)
        if save:
            self.add_message(message)
        to.send({'text': message.encode()})

    def set_config(self, new_config):
        """Update the room config, and send an update_config event"""
        self.config = new_config
        self.save()
        self.send(self.message(
            type=Message.TYPE.event,
            payload={
                'type': 'update_config',
                'data': new_config
            }
        ))

    def get_config(self):
        """Get the room config."""
        self.refresh_from_db(fields=['config'])
        return serializers.RoomConfigSerializer(self.config).data

    def _send_action_event(self, name, target_peer_id, from_peer_id,
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
        return self._send_action_event('request_start_recording',
            *args, **kwargs
        )

    def stop_recording(self, *args, **kwargs):
        # FIXME: probably should check if peer is recording before actually
        # transmitting
        return self._send_action_event('request_stop_recording',
            *args, **kwargs
        )

    def kick(self, peer_id, from_peer_id):
        # TODO: implement kick
        raise NotImplementedError

    def change_member_name(self, participant, name):
        self.memberships.filter(participant=participant).update(name=name)
        self.send(self.message(
            type=Message.TYPE.event,
            payload={
                'type': 'update_status',
                'data': {
                    'name': name,
                },
            },
            participant_id=participant.id,
        ))

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
        self.peers[peer_id].disconnect()
        self.send(self.message(
            type=Message.TYPE.leave,
            payload={
                'id': peer_id
            },
            participant_id=participant.id,
            peer_id=peer_id
        ))

    def connect(self, participant, channel_name):
        """
        Connect an existing participant `participant`, connected on
        channel `channel_name`, to the room.
        """
        # TODO fix tests
        if not self.members.filter(id=participant.id).exists():
            raise RoomMembership.DoesNotExist

        peer = self.peers.for_participant(participant)
        if peer is None:
            return self.peers.connect(participant, channel_name).id
        else:
            return peer.id

    def create_recording(self, **kwargs):
        """
        Create a recording for this room, with data set by **kwargs, and
        send an event.
        """
        rec = self.recordings.create(**kwargs)
        self.send(self.message(
            type=Message.TYPE.event,
            payload={
                'type': 'start_recording',
                'data': recordings.serializers.RecordingSerializer(rec).data,
            },
            participant_id=rec.participant.id,
            peer_id=self.peers.for_participant(rec.participant).id
        ))
        return rec

    def update_recordings(self, recordings, participant):
        from recordings.models import Recording
        from recordings.serializers import RecordingSerializer
        existing = {
            r.id: r
            for r in self.recordings.filter(participant=participant)
        }
        for recording_data in recordings:
            rec = existing.get(recording_data['id'])
            if rec is not None:
                for field, val in recording_data.items():
                    if field not in ('room_id', 'participant_id'):
                        setattr(rec, field, val)
                rec.save()
            else:
                rec = Recording(**recording_data)
                rec.room = self
                rec.participant = participant
                rec.save()

            self.send(self.message(
                type=Message.TYPE.event,
                payload={
                    'type': 'update_recording',
                    'data': RecordingSerializer(rec).data,
                },
                participant_id=rec.participant_id,
                peer_id=self.peers.for_participant(rec.participant).id
            ))

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
                'update_upload_progress',
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
        return "wss://" + settings.HOSTNAME + self.get_socket_url()

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
    onboarding_complete = models.BooleanField(default=False)

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
            peer = self.room.peers.for_participant(self.participant)
            return peer.id if peer else None

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
            return self.room.peers[self.peer_id]['disk_usage']
        else:
            return None

    @property
    def resources(self):
        if self.peer_id:
            return self.room.peers[self.peer_id]['resources']
        else:
            return None

    @property
    def recorder_status(self):
        if self.peer_id:
            return self.room.peers[self.peer_id]['recorder_status']
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
