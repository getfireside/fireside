from channels.generic.websockets import JsonWebsocketConsumer
from .models import Room, Participant


class RoomConsumer(JsonWebsocketConsumer):
    _room_cache = {}
    _participant_cache = {}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        room_id = self.kwargs['id']
        self.room = self._room_cache.get(room_id)
        if self.room is None:
            self.room = Room.objects.get(id=room_id)
            self._room_cache[self.room.id] = self.room

    def connection_groups(self, **kwargs):
        return ['rooms.{}'.format(self.room.id)]

    def get_participant(self, user, session_key):
        if user:
            res = self._participant_cache.get((True, user))
            if res is None:
                res = Participant.objects.get(user=user)
                self._participant_cache[(True, user)] = res
        else:
            res = self._participant_cache.get((False, session_key))
            if res is None:
                res = Participant.objects.get(session_key=session_key)
                self._participant_cache[(False, session_key)] = res
        return res

    def connect(self, message, multiplexer, **kwargs):
        self.participant = self.get_participant(self.user, self.session_key)
        self.room.join(
            self.participant,
            channel_name=self.message.reply_channel.name
        )

    def disconnect(self, message, **kwargs):
        pass

    def receive(self, message, **kwargs):
        pass