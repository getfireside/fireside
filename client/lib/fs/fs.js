class FSError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FSError'
    }

    static wrap(err) {
        let e = new this(err.message, err.stack);
        e.wrapped = err;
        return e;
    }
}

class DiskSpaceError extends FSError;
class LookupError extends FSError;

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