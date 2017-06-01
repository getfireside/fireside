import uuid
import json
from .models import Participant
from channels import Channel

class Peer():
    def __init__(self, manager, id):
        self.id = id
        self.manager = manager
        self._participant = None

    def disconnect(self):
        return self.manager.disconnect_peer(self.id)

    def __setitem__(self, key, value):
        return self.manager.set_peer_data(self.id, key, value)

    def __getitem__(self, key):
        return self.manager.get_peer_data(self.id, key)

    @property
    def participant(self):
        if self._participant is None:
            self._participant = Participant.objects.get(
                id=self.manager.get_participant_id(self.id)
            )
        return self._participant

    @property
    def channel(self):
        return Channel(self['channel'])


class PeerManager:
    def __init__(self, redis_conn, room):
        self.redis_conn = redis_conn
        self.room = room

    @property
    def _prefix(self):
        return f'rooms:{self.room.id}'

    def for_participant(self, participant):
        peer_id = self.redis_conn.get(
            f'{self._prefix}:participants:{participant.id}:peer_id',
        )
        if peer_id:
            return Peer(self, peer_id)
        return None

    def get_participant_id(self, peer_id):
        return int(self.redis_conn.hget(f'{self._prefix}:peers', peer_id))

    @property
    def ids(self):
        return self.redis_conn.hkeys(f'{self._prefix}:peers')

    @property
    def participant_ids(self):
        return [int(x) for x in self.redis_conn.hvals(f'{self._prefix}:peers')]

    def connect(self, participant, channel_name):
        peer_id = uuid.uuid4().hex
        self.redis_conn.set(
            f'{self._prefix}:participants:{participant.id}:peer_id',
            peer_id
        )
        self.redis_conn.hset(
            f'{self._prefix}:peers',
            peer_id,
            participant.id
        )
        self.set_peer_data(peer_id, 'channel', channel_name)
        return Peer(self, peer_id)

    def disconnect_peer(self, peer_id):
        participant_id = self.redis_conn.hget(
            f'{self._prefix}:peers',
            peer_id,
        )
        self.redis_conn.hdel(f'{self._prefix}:peers', peer_id)
        self.redis_conn.delete(f'{self._prefix}:peers:{peer_id}')
        self.redis_conn.delete(f'{self._prefix}:participants:{participant_id}:peer_id')

    def set_peer_data(self, peer_id, key, data):
        self.redis_conn.hset(f'{self._prefix}:peers:{peer_id}',
            key,
            json.dumps(data)
        )

    def get_peer_data(self, peer_id, key):
        res = self.redis_conn.hget(
            f'{self._prefix}:peers:{peer_id}',
            key
        )
        if res is not None:
            return json.loads(res)
        else:
            return res

    def __getitem__(self, peer_id):
        if self.redis_conn.hexists(f'{self._prefix}:peers', peer_id):
            return Peer(self, peer_id)
        else:
            raise KeyError("Peer does not exist")

    def get_memberships_with_peer_ids(self):
        participant_peers = {
            int(v): k
            for k, v in self.redis_conn.hgetall(f'{self._prefix}:peers').items()
        }
        memberships = []
        for mem in self.room.memberships.filter(
            participant__in=participant_peers.keys()
        ):
            mem._peer_id = participant_peers[mem.participant_id]
            memberships.append(mem)
        for mem in self.room.memberships.exclude(
            participant__in=participant_peers.keys()
        ):
            mem._peer_id = None
            memberships.append(mem)
        return memberships

    def __iter__(self):
        for peer_id in self.ids:
            yield Peer(self, peer_id)