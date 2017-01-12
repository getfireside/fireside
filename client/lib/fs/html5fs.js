import { FSError, LookupError, DiskSpaceError, FSFile, FS } from './fs.coffee';

let translateError = err =>
    switch (err.name) {
        case 'QUOTA_EXCEEDED_ERR':
            return DiskSpaceError.wrap(err);
        case 'NOT_FOUND_ERR':
            return LookupError.wrap(err);
        default:
            return FSError.wrap(err);
    }
;

let requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;

class HTML5FSFile extends FSFile {
    constructor(path, fs) {
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
                {pos};
            return this.fs.write(this.path, blob, opts)
                .then(fulfil)
                .catch(reject);
        });
    }


    readEach(f, done, onerror) {
        return this.fs.openFile(this.path)
            .then((file) => {
                f(file);
                done();
            })
            .catch(onerror);
    }

    read() {
        let blobs = [];
        return new Promise((fulfil, reject) => {
            this.readEach(
                b => blobs.push(b), 
                () => fulfil(new Blob(blobs, {type: blobs[0].type})),
                reject
            );
        });
    }

    remove() { this.fs.removeFile(this.path); }
}


class HTML5FS extends FS {
    constructor(opts) {
        this.logger = opts.logger;
    }

    open() {
        return new Promise((fulfil, reject) => {
            let init = (fs) => { 
                this.fs = fs;
                fulfil(this);
            };

            let handleErr = e => reject(translateError(e));

            if (!this.fs) {
                let size = 1000*1024*1024;
                navigator.persistentStorage.requestQuota(size, grantedBytes => requestFileSystem(PERSISTENT, grantedBytes, init, handleErr)
                , handleErr);
            }
            else {
                fulfil(this);
            }
        });
    }

    ensurePath(path) {
        // ensures that the filepath has directories that can be written to
        return this.createDirs(path.split('/').slice(0, -2 + 1 || undefined));
    }

    createDirs(folders, parent, handleErr) {
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
                        return this.createDirs(folders.slice(1), entry).then(fulfil).catch(reject);
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
            let handleErr = err => reject(translateError(err));
            let done = () => {
                this.logger.info('Deleted recording!');
                fulfil();
            };
            this.fs.root.getFile(path, null, entry => entry.remove(done, handleErr));
        });
    }

    write(path, blob, opts) {
        if (opts == null) { opts = {}; }
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

            this.fs.root.getFile(path, {create:true, exclusive:false}, _write, handleErr);
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

    getSpaceInfo() {
        return new Promise((fulfil, reject) => {
            let f = function(used, total) {
                let free = total - used;
                fulfil({used, free, total});
            };
            navigator.persistentStorage.queryUsageAndQuota(f, reject);
        });
    }
}

export default HTML5FS;
