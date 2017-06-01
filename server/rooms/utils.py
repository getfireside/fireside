import re

def prioritize_h264(data):
    '''Intercept sdp from signalling and prioritize H264'''
    sdp = data['payload'].get('sdp', None)
    if sdp is None:
        return data
    m = re.search(r'a=rtpmap\:(\d+)\sH264\/\d+', sdp)
    if m:
        h264 = m.group(1)
    else:
        return data

    m = re.search(r'm=video\s(\d+)\s[A-Z\/]+\s([0-9\ ]+)', sdp)
    if not m:
        return data

    candidates = m.group(2).split(' ')
    if h264 not in candidates:
        return data

    print(data['payload']['sdp'])
    print('REPLACING')
    candidates = [h264] + [c for c in candidates if c != h264]
    m_prioritized = m.group(0).replace(m[2], " ".join(candidates))
    data['payload']['sdp'] = sdp.replace(m.group(0), m_prioritized)
    print(data['payload']['sdp'])
    return data

def register_room_event_handler(f):
    from .models.room import Room
    """Decorator to register function `f` as an event handler"""
    Room.event_handlers[f.__name__] = f
    return f