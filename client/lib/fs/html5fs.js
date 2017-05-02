import { FSError, LookupError, DiskSpaceError, FSFile, FS } from './fs';
import { Logger } from 'lib/logger';
import {requestStorageQuota, getStorageUsage} from './quota';

let translateError = err => {
    switch (err.name) {
        case 'QuotaExceededError':
            return DiskSpaceError.wrap(err);
        case 'NotFoundError':
            return LookupError.wrap(err);
        default:
            return FSError.wrap(err);
    }
};

let requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;

export class HTML5FSFile extends FSFile {
    constructor(path, fs) {
        super()
        this.path = path;
        this.fs = fs;
    }

    append(blob) {
        return new Promise((fulfil, reject) => {
            let opts =
                {append: true};

            return this.fs.write(this.path, blob, opts)
                .then(fulfil)
                .catch(reject);
        });
    }

    write(blob, pos) {
        return new Promise((fulfil, reject) => {
            let opts =
                {pos, create:false};
            return this.fs.write(this.path, blob, opts)
                .then(fulfil)
                .catch(reject);
        });
    }


    readEach(f) {
        return new Promise((fulfil, reject) => {
            this.fs.openFile(this.path)
                .then((file) => {
                    f(file);
                    fulfil();
                })
                .catch(reject);
        });
    }

    async read() {
        let blobs = [];
        await this.readEach(b => blobs.push(b));
        return new Blob(blobs, {type: blobs[0].type});
    }

    async remove() {
        let res = await this.fs.removeFile(this.path);
        return res;
    }
}


export default class HTML5FS extends FS {
    constructor(opts) {
        super();
        opts = opts || {};
        this.logger = opts.logger != null ? opts.logger : new Logger(null, 'HTML5FS');
    }

    open() {
        return new Promise((fulfil, reject) => {
            let init = (fs) => {
                this.fs = fs;
                this.watchDiskUsage();
                fulfil(this);
            };

            let handleErr = e => reject(translateError(e));

            if (!this.fs) {
                this.emit('promptOpen');
                requestStorageQuota().then((size) => {
                    this.logger.log(`We got a quota of ${size} bytes`);
                    requestFileSystem(window.PERSISTENT, size, init, handleErr);
                    this.emit('promptClosed');
                });
            }
            else {
                fulfil(this);
            }
        });
    }

    getDiskUsage() {
        return getStorageUsage();
    }

    ensurePath(path) {
        // ensures that the filepath has directories that can be written to
        return this._createDirs(path.split('/').slice(0, -1));
    }

    _createDirs(folders, parent) {
        if (parent == null) {
            parent = this.fs.root;
        }
        return new Promise((fulfil, reject) => {
            if (folders[0] === '.' || folders[0] === '') {
                folders = folders.slice(1);
            }
            return parent.getDirectory(
                folders[0],
                {create:true},
                (entry) => {
                    if (folders.length) {
                        return this._createDirs(folders.slice(1), entry).then(fulfil).catch(reject);
                    } else {
                        return fulfil();
                    }
                },
                (err) => reject(translateError(err))
            );
        });
    }

    removeFile(path) {
        return new Promise((fulfil, reject) => {
            let done = () => {
                this.logger.info('Deleted file!');
                fulfil();
            };
            this.fs.root.getFile(path, null, (entry) => {
                entry.remove(done, (err) => reject(translateError(err)));
            }, (err) => reject(translateError(err)));
        });
    }

    write(path, blob, opts) {
        if (opts == null) {
            opts = {};
        }
        if (opts.create == null) {
            opts.create = true;
        }
        return new Promise((fulfil, reject) => {
            let handleErr = err => reject(translateError(err instanceof ProgressEvent ? err.currentTarget.error : err));
            let _write = entry =>
                entry.createWriter(function(writer) {
                    writer.onerror = handleErr;
                    if (opts.append) {
                        writer.seek(writer.length);
                    }
                    let truncated = false;
                    writer.onwriteend = function(e) {
                        if (!truncated && !opts.append && (opts.pos == null)) {
                            truncated = true;
                            this.truncate(this.position);
                        }
                        return fulfil(entry, this);
                    };

                    return writer.write(blob);
                }, handleErr);

            this.fs.root.getFile(path, {create:opts.create, exclusive:false}, _write, handleErr);
        });
    }

    openFile(path) {
        return new Promise((fulfil, reject) => {
            let handleErr = err => reject(translateError(err));
            return this.fs.root.getFile(
                path,
                null,
                (entry) => { entry.file((f => fulfil(f)), handleErr) },
                handleErr
            );
        });
    }

    getFile(path, opts) {
        return new Promise((fulfil, reject) => {
            let res = this.ensurePath(path);
            res.then(() => fulfil(new HTML5FSFile(path, this)));
            res.catch(reject);
        });
    }

    clear() {
        return new Promise((fulfil, reject) => {
            if (this.fs == null) {
                fulfil();
            }
            let directoryReader = this.fs.root.createReader();
            directoryReader.readEntries(
                (entries) => {
                    let promises = _.map(entries, (entry) => {
                        return new Promise((fulfil, reject) =>
                            entry.removeRecursively(fulfil, (err) => reject(translateError(err)))
                        )
                    });
                    this.logger.info('Cleared FS.');
                    Promise.all(promises).then(fulfil, reject);
                },
                (err) => reject(translateError(err))
            )
        })
    }
}

export {HTML5FS, LookupError, DiskSpaceError, FSError};
