from .utils import register_room_event_handler
import recordings.serializers

@register_room_event_handler
def update_status(event, message, room):
    # TODO refactor this bit - serializer to make sure these are valid
    if 'disk_usage' in event['data']:
        room.peers[message.peer_id]['disk_usage'] = event['data']['disk_usage']
    if 'resources' in event['data']:
        room.peers[message.peer_id]['resources'] = event['data']['resources']
    if 'recorder_status' in event['data']:
        room.peers[message.peer_id]['recorder_status'] = event['data']['recorder_status']
    if 'onboarding_complete' in event['data']:
        room.memberships.filter(
            participant=message.participant
        ).update(
            onboarding_complete=event['data']['onboarding_complete']
        )

@register_room_event_handler
def stop_recording(event, message, room):
    update = recordings.serializers.RecordingSerializer(data=event['data'], partial=True)
    if update.is_valid():
        if room.recordings.filter(
            id=event['data']['id'],
            participant=message.participant
        ).exists():
            room.recordings.filter(id=event['data']['id']).update(**update.validated_data)