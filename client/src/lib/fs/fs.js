import {ExtendableError} from 'lib/util';
import WildEmitter from 'wildemitter';
import {clock} from 'lib/util';
import { serverTimeNow } from 'lib/timesync';

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
        this._lastDiskUsageUpdateTime = null;
        let fn = async () => {
            let res = await this.getDiskUsage();
            if (
                this._lastDiskUsage == null
                || this._lastDiskUsage.quota != res.quota
                || this._lastDiskUsage.usage != res.usage
            ) {
                if (this._lastDiskUsage && this._lastDiskUsage.usage == res.usage) {
                    // in some cases the browser will constantly send quota updates,
                    // which we don't need that often - unless the change is large.
                    // let's see if it was a large change...
                    if (Math.abs(this._lastDiskUsage.quota - res.quota) < 25*1024*1024) {
                        // small change.
                        // if it's been more than 30s since the last update, then we'll go ahead anyway
                        if (serverTimeNow() - this._lastDiskUsageUpdateTime < 30000) {
                            return;
                        }
                    }
                }
                this._lastDiskUsage = res;
                this._lastDiskUsageUpdateTime = serverTimeNow();
                this.emit('diskUsageUpdate', res);
            }
        };
        fn();
        clock.on('tick', fn);
        this._diskUsageTimer = setInterval(fn, 1000);
    }
}

export { FS, FSFile, FSError, DiskSpaceError, LookupError };