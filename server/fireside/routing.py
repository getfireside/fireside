from rooms.consumers import RoomSocketConsumer, RoomConsumer

channel_routing = [
    RoomSocketConsumer.as_route(path=r'^/rooms/(?P<id>\w+)/socket$'),
    RoomConsumer.as_route()
]
