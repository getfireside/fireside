import {ExtendableError} from 'lib/util';

class FSError extends ExtendableError {
    constructor(message) {
        super(message);
        this.name = 'FSError'
    }

    static wrap(err, message) {
        if (message != null) {
            message = message + ': ' + err.message;
        }
        else {
            message = err.message;
        }
        let e = new this(message, err.stack);
        e.cause = err;
        return e;
    }
}

class DiskSpaceError extends FSError {}
class LookupError extends FSError {}

class FSFile {
    constructor(path, fs) {
        this.path = path;
        this.fs = fs;
    }

    append(blob) {}

    write(blob, pos) {}

    readEach(f, done, onerr) {}

    read() {}
}


class FS {
    constructor(opts) {}

    getFile(path, opts) {}
}

export { FS, FSFile, FSError, DiskSpaceError, LookupError };