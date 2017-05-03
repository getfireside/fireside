import {ExtendableError} from 'lib/util';
import WildEmitter from 'WildEmitter';

class FSError extends ExtendableError {
    constructor(message) {
        super(message);
        this.name = 'FSError';
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

    append(blob) {

    }

    write(blob, pos) {

    }

    readEach(f, done, onerr) {

    }

    read() {}
}


class FS extends WildEmitter {
    constructor(opts) {
        super()
    }

    getFile(path, opts) {

    }

    watchDiskUsage() {
        this._lastDiskUsage = null;
        clearInterval(this._diskUsageTimer);
        let fn = async () => {
            let res = await this.getDiskUsage();
            if (
                this._lastDiskUsage == null
                || this._lastDiskUsage.quota != res.quota
                || this._lastDiskUsage.usage != res.usage
            ) {
                this._lastDiskUsage = res;
                this.emit('diskUsageUpdate', res);
            }
        };
        fn();
        this._diskUsageTimer = setInterval(fn, 1000);
    }
}

export { FS, FSFile, FSError, DiskSpaceError, LookupError };