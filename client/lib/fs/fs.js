import {ExtendableError} from 'lib/util';
import WildEmitter from 'WildEmitter';
import _ from 'lodash';

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


class FS extends WildEmitter {
    constructor(opts) {
        super()
    }

    getFile(path, opts) {}

    watchDiskUsage() {
        this._lastDiskUsage = null;
        this._diskUsageTimer = setInterval( async () => {
            let res = await this.getDiskUsage();
            if (!_.isEqual(this._lastDiskUsage, res)) {
                this._lastDiskUsage = res;
                this.emit('diskUsageUpdate', res);
                this.logger.log(
                    `Disk usage update. Quota: ${res.quota}, Usage: ${res.usage}`
                );
            }
        }, 1000);
    }
}

export { FS, FSFile, FSError, DiskSpaceError, LookupError };