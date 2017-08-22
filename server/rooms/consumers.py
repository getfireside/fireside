from django.utils.timezone import now
from channels.generic.websockets import JsonWebsocketConsumer
from channels.generic import BaseConsumer
from channels import Channel, Group
from .models import Room, Participant, Message
from .utils import prioritize_h264
import functools


class RoomSocketConsumer(JsonWebsocketConsumer):
    http_user = True

    def get_participant(self, user, session):
        return Participant.objects.from_user_or_session(user, session)

    def connect(self, message, **kwargs):
        participant = self.get_participant(
            self.message.user, self.message.http_session
        )
        room = RoomConsumer.get_room(self.kwargs['id'])

        if room.peers.for_participant(participant) is not None:
            message.reply_channel.send({'close': 4100, "bytes": b"{}"})

        else:
            message.channel_session['participant_id'] = participant.id
            message.channel_session.save()

            message.reply_channel.send({'accept': True})
            Channel('room.join').send({
                'reply_channel': message.content['reply_channel'],
                'room_id': self.kwargs['id'],
                'participant_id': self.message.channel_session['participant_id']
            })

    def disconnect(self, message, **kwargs):
        if 'participant_id' in message.channel_session:
            Channel('room.leave').send({
                'reply_channel': message.content['reply_channel'],
                'room_id': self.kwargs['id'],
                'participant_id': self.message.channel_session['participant_id']
            })

    def receive(self, text, **kwargs):
        decoded = Message.decode_message_dict(text)
        decoded['reply_channel'] = self.message.content['reply_channel']
        decoded['room_id'] = self.kwargs['id']
        decoded['participant_id'] = \
            self.message.channel_session['participant_id']
        print(decoded)
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
        if message.content['type'] in Message.TYPE:
            msg = self.room.message(
                type=message.content['type'],
                payload=message.content['payload'],
                participant_id=message.content['participant_id'],
                peer_id=message.channel_session.get('peer_id', None),
                timestamp=now(),
            )

            return getattr(self, msg.get_type_display())(
                msg,
                **msg.payload
            )

    def event(self, message, **kwargs):
        self.room.receive_event(message)

    def join(self, message, **kwargs):
        peer_id = self.message.channel_session['peer_id'] = self.room.connect(
            self.participant,
            channel_name=self.message.reply_channel.name
        )
        print(peer_id)
        mem = self.room.memberships.get(participant=self.participant)
        initial_data = self.room.get_initial_data()
        initial_data['self'] = {
            'peer_id': peer_id,
            'uid': mem.participant_id,
            'info': {
                'name': mem.get_display_name(),
                'role': mem.role,
            }
        }
        self.room.send(
            self.room.message(
                type=Message.TYPE.join,
                payload=initial_data
            ),
            to_peer_id=peer_id,
        )
        self.room.announce(peer_id, self.participant)
        Group(self.room.group_name).add(self.message.reply_channel)

    def leave(self, message, **kwargs):
        self.room.leave(
            self.message.channel_session['peer_id'],
            participant=self.participant
        )
        Group(self.room.group_name).discard(self.message.reply_channel)

    def signalling(self, message, to, **data):
        # message.payload = prioritize_h264(message.payload)
        try:
            self.room.send(message, to_peer_id=to)
        except KeyError:
            self.room.send(self.room.message(type=Message.TYPE.message, payload={
                'type': 'signalling_error',
                'data': {'message': f'Peer {to} does not exist'}
            }), to_peer_id=message.peer_id)
