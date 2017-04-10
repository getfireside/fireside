from channels.routing import route
from rooms.consumers import RoomConsumer

channel_routing = [
    RoomConsumer.as_route(path=r'/rooms/(?P<id>\w+)/socket')
]