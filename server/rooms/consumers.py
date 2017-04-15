from channels.generic.websockets import JsonWebsocketConsumer
from channels.generic import BaseConsumer
from channels import Channel, Group
from .models import Room, Participant
import functools


class RoomSocketConsumer(JsonWebsocketConsumer):
    http_user = True

    def get_participant(self, user, session):
        return Participant.objects.from_user_or_session(user, session)

    def connect(self, message, **kwargs):
        self.message.channel_session['participant_id'] = self.get_participant(
            self.message.user, self.message.http_session
        ).id
        self.message.channel_session.save()
        Channel('room.join').send({
            'reply_channel': message.content['reply_channel'],
            'room_id': self.kwargs['id'],
            'participant_id': self.message.channel_session['participant_id']
        })
        message.reply_channel.send({'accept': True})

    def disconnect(self, message, **kwargs):
        Channel('room.leave').send({
            'reply_channel': message.content['reply_channel'],
            'room_id': self.kwargs['id'],
            'participant_id': self.message.channel_session['participant_id']
        })

    def receive(self, text, **kwargs):
        decoded = Room.decode_message(text)
        decoded['reply_channel'] = self.message.content['reply_channel']
        decoded['room_id'] = self.kwargs['id']
        decoded['participant_id'] = \
            self.message.channel_session['participant_id']
        Channel('room.receive').send(decoded)


class RoomConsumer(BaseConsumer):
    channel_session = True
    method_mapping = {
        'room.join': 'join',
        'room.leave': 'leave',
        'room.receive': 'receive'
    }

    @classmethod
    @functools.lru_cache(maxsize=None)
    def get_room(cls, id):
        return Room.objects.get(id=id)

    @classmethod
    @functools.lru_cache(maxsize=None)
    def get_participant(cls, id):
        return Participant.objects.get(id=id)

    def dispatch(self, message, **kwargs):
        self.room = self.get_room(message.content['room_id'])
        self.participant = self.get_participant(
            message.content['participant_id']
        )
        return super().dispatch(message, **kwargs)

    def receive(self, message, **kwargs):
        if message.content['type'] in self.room.MESSAGE_TYPE_MAP.values():
            return getattr(self, message.content['type'])(
                **message.content['payload']
            )

    def event(self, type, data):
        self.room.send(self.room.message('event', {
            'type': type,
            'data': data,
            'from': self.message.channel_session['peer_id']
        }))

    def join(self, message, **kwargs):
        initial_data = self.room.get_initial_data()
        self.message.channel_session['peer_id'] = self.room.join(
            self.participant,
            channel_name=self.message.reply_channel.name
        )
        self.room.send(
            self.room.message('join', initial_data),
            to_peer=self.message.channel_session['peer_id']
        )
        Group(self.room.group_name).add(self.message.reply_channel)

    def leave(self, message, **kwargs):
        self.room.leave(self.message.channel_session['peer_id'])
        Group(self.room.group_name).discard(self.message.reply_channel)

    def signalling(self, **data):
        data['from'] = self.message.channel_session['peer_id']
        self.room.send(self.room.message('signalling', data), data['to'])
