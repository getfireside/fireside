import * as humps from 'humps';
import WildEmitter from 'wildemitter';

export function eventListenerToPromise(object, name) {
        return new Promise(function(resolve) {
                object.addEventListener(name, resolve);
        });
}

export function eventToPromise(object, name) {
        return new Promise(function(resolve) {
                object.on(name, resolve);
        });
}

let padCache = [
    '',
    ' ',
    '  ',
    '   ',
    '    ',
    '     ',
    '      ',
    '       ',
    '        ',
    '         '
];

export function pad(str, len, ch) {
        // convert `str` to `string`
        str = str + '';
        // `len` is the `pad`'s length now
        len = len - str.length;
        // doesn't need to pad
        if (len <= 0) return str;
        // `ch` defaults to `' '`
        if (!ch && ch !== 0) ch = ' ';
        // convert `ch` to `string`
        ch = ch + '';
        // cache common use cases
        if (ch === ' ' && len < 10) return padCache[len] + str;
        // `pad` starts with an empty string
        var pad = '';
        // loop
        while (true) {
            // add `ch` to `pad` if `len` is odd
            if (len & 1) pad += ch;
            // divide `len` by 2, ditch the remainder
            len >>= 1;
            // "double" the `ch` so this operation count grows logarithmically on `len`
            // each time `ch` is "doubled", the `len` would need to be "doubled" too
            // similar to finding a value in binary search tree, hence O(log(n))
            if (len) ch += ch;
            // `len` is 0, exit the loop
            else break;
        }
        // pad `str`!
        return pad + str;
}

export function blobToString(blob) {
        return new Promise( (resolve, reject) => {
                let reader = new FileReader();
                reader.addEventListener("loadend", () => resolve(reader.result));
                reader.addEventListener('error', (err) => reject(err));
                reader.readAsText(blob);
        });
}

export class ExtendableError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        } else {
            this.stack = (new Error(message)).stack;
        }
    }
}

export const getCookie = (name) => {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i += 1) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (`${name}=`)) {
                cookieValue = decodeURIComponent(
                    cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
};

export const fetchPost = async (url, data, method = 'POST') => {
    let response = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        credentials: 'same-origin',
        body: JSON.stringify(data),
    });
    let contentType = response.headers.get('content-type');
    let responseIsJSON =
        contentType &&
        contentType.indexOf('application/json') !== -1;

    if (responseIsJSON) {
        let responseData = await response.json();
        if (response.ok) {
            return responseData;
        }
        else {
            throw new Error(responseData);
        }
    }
    else {
        throw new Error(response.statusText);
    }
};

export const fetchJSON = async (url, data) => {
    let response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
    });
    let contentType = response.headers.get('content-type');
    let responseIsJSON =
        contentType &&
        contentType.indexOf('application/json') !== -1;
    if (responseIsJSON) {
        let responseData = await response.json();
        if (response.ok) {
            return responseData;
        }
        else {
            throw new Error(responseData);
        }
    }
    else {
        throw new Error(response.statusText);
    }
};

export const decamelize = (s) => humps.decamelize(s, {split: /(?=[A-Z0-9])/});
export const decamelizeKeys = (s) => humps.decamelizeKeys(s, {split: /(?=[A-Z0-9])/});
export const camelize = humps.camelize;
export const camelizeKeys = humps.camelizeKeys;

export function isVideo(stream) {
    return stream.getVideoTracks().length > 0;
}

export function formatDuration(d) {
    var mins = Math.floor(d / 60);
    var secs = Math.round(d % 60);
    return `${mins}m ${secs}s`;
}

export class Clock extends WildEmitter {
    constructor(period) {
        super();
        this.period = period;
        this.numberTicks = 0;
    }
    start() {
        setInterval(this.tick.bind(this), this.period);
    }
    tick() {
        this.numberTicks++;
        this.emit('tick');
    }
}

export const clock = new Clock(1000);