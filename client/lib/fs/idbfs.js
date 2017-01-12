import { FSError, LookupError, DiskSpaceError, FSFile, FS } from './fs.coffee';

function translateError(err) =>
    switch (err.name) {
        case 'QuotaExceededError':
            return new DiskSpaceError().wrap(err);
        case 'NotFoundError':
            return new LookupError().wrap(err);
        default:
            return new FSError().wrap(err);
    };


class IDBFile extends FSFile {
    constructor(path, writer) {
        this.path = path;
        this.writer = writer;
    }

    append(blob) {
        return new Promise((fulfil, reject) => {
            let req = this.writer._getObjectStore().add({
                filename: this.path,
                blob: blob
            });
            req.onsuccess = (e) => {
                let result = e.target.result;
                fulfil(result);
            };
            req.onerror = (e) => reject(translateError(e.target));
        });
    }

    write(blob, pos) {
        // IMPLEMENT ME PROPERLY!
        // for now, this only works for pos=0 and we assume that we're just replacing the header blob.
        // _OBVIOUSLY_ need to fix for other use-cases.
        return new Promise((fulfil, reject) => {
            if (pos === 0) {
                let index = this.writer._getObjectStore(true).index('filename');
                this._getCursor(false, (evt) => {
                    let cur = evt.target.result;
                    if (cur) {
                        let o = cur.value;
                        if (o.blob.size < blob.size) {
                            reject(new Error("Not implemented yet! must be smaller than existing blob..."));
                            return;
                        }
                        o.blob = new Blob([blob, o.blob.slice(blob.size)], {type: blob.type});
                        cur.update(o);
                        fulfil();
                    } else {
                        reject(new FSError(("Cursor is false.")));
                    }
                });

            } else {
                return reject(new FSError("Not implemented yet!"));
            }
        });
    }

    remove() {
        return new Promise((fulfil, reject) => {
            let onSuccess = (e) => {
                let cur = e.target.result;
                if (cur) { 
                    cur.delete();
                    return cur.continue();
                } else {
                    this.writer.logger.info('Deleted recording!');
                    return fulfil();
                }
            };
            this._getCursor(false, onSuccess, reject);
        });
    }

    readEach(f, done, onerror) {
        return this._getCursor(true, function(e) {
            let cur = e.target.result;
            if (cur) {
                f(cur.value.blob);
                cur.continue();
            } 
            else {
                done();
            }
        }, onerror);
    }

    read() {
        let blobs = [];
        return new Promise((fulfil, reject) => {
            this.readEach(
                (b) => blobs.push(b), 
                () => fulfil(new Blob(blobs, {type: blobs[0].type})),
                reject
            );
        });
    }

    _getCursor(ro = false, onsuccess, onerr) {
        console.log('Getting cursor', ro);
        return new Promise((fulfil, reject) => {
            let index = this.writer._getObjectStore(ro).index("filename");
            let curReq = index.openCursor(IDBKeyRange.only(this.path));
            curReq.onsuccess = onsuccess;
            curReq.onerror = (e) => onerr(translateError(e.target));
        });
    }
}


class IDBFS extends FS {
    constructor(opts) {
        this.dbname = opts.dbname;
        this.logger = opts.logger;
    }
    open() {
        return new Promise((fulfil, reject) => {
            if (this.db) {
                fulfil(this);
            }

            let openRequest = indexedDB.open(this.dbname, 1);

            openRequest.onupgradeneeded = function(event) {
                let db = event.target.result;

                if (db.objectStoreNames.contains("chunks")) {
                    db.deleteObjectStore("chunks");
                }

                let sto = db.createObjectStore("chunks", {
                    autoIncrement: 1,
                    keyPath: "id"
                });

                sto.createIndex("filename", "filename", {unique: false});
            };

            openRequest.onsuccess = event => {
                this.db = event.target.result;
                fulfil(this);
            };

            return openRequest.onerror = evt => reject(translateError(e.target));
        });
    }

    _getObjectStore(ro = false) { 
        let transaction = this.db.transaction(["chunks"], (ro ? "readonly" : "readwrite"));
        return transaction.objectStore("chunks");
    }

    getFile(path, opts) { 
        return new Promise((fulfil, reject) => { 
            fulfil(new IDBFile(path, this));
        });
    }
}

export default IDBFS;
