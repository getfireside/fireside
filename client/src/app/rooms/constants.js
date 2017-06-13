import _ from 'lodash';

export const ROLES = {
    GUEST: 'g',
    OWNER: 'o',
};

export const ROLES_INVERSE = _.invert(ROLES);

export const MESSAGE_TYPES = {
    SIGNALLING: 's',
    EVENT: 'e',
    JOIN: 'j',
    ANNOUNCE: 'a',
    ACTION: 'A',
    LEAVE: 'l',
};

export const MESSAGE_TYPES_INVERSE = _.invert(MESSAGE_TYPES);

export const MESSAGE_ENCODING_KEYS = {
    't': 'type',
    'T': 'timestamp',
    'p': 'payload',
    'P': 'peerId',
    'u': 'uid',
};

export const MEMBER_STATUSES = {
    CONNECTED: 1,
    DISCONNECTED: 0,
};