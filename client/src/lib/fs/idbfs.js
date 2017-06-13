import { FSError, LookupError, DiskSpaceError, FSFile, FS } from './fs';
import { Logger } from 'lib/logger';
import { getStorageUsage } from './quota';

function translateError(err) {
    switch (err.name) {
        case 'QuotaExceededError':
            return DiskSpaceError.wrap(err);
        case 'NotFoundError':
            return LookupError.wrap(err);
        case 'DiskSpaceError':
            return DiskSpaceError.wrap(err);
        default:
            return FSError.wrap(err);
    };
}


export class IDBFile extends FSFile {
    append(blob) {
        return new Promise((fulfil, reject) => {
            let store = this.fs._getObjectStore();

            store.add({
                filename: this.path,
                blob: blob
            });
            store.transaction.oncomplete = () => {
                fulfil();
            };
            store.transaction.onerror = (e) => {
                reject(translateError(e.target.error));
            };
            store.transaction.onabort = (e) => {
                reject(translateError(e.target.error));
            };
        });
    }

    write(blob, pos=0) {
        // IMPLEMENT ME PROPERLY!
        // for now, this only works for pos=0 and we assume that we're just replacing the header blob.
        return new Promise((fulfil, reject) => {
            if (pos === 0) {
                this.fs._getObjectStore(true).index('filename');
                this._getCursor(false, (evt) => {
                    let cur = evt.target.result;
                    if (cur) {
                        let o = cur.value;
                        if (o.blob.size < blob.size) {
                            reject(new Error("Not implemented yet! must be smaller than existing blob..."));
                            return;
                        }
                        o.blob = new Blob([blob, o.blob.slice(blob.size)], {type: blob.type});
                        let req = cur.update(o);
                        req.onsuccess = () => fulfil();
                        req.onerror = (e) => reject(translateError(e.target.error));
                    } else {
                        reject(new LookupError("No chunk exists here to write to."));
                    }
                });

            } else {
                return reject(new FSError("Not implemented yet!"));
            }
        });
    }

    remove() {
        return new Promise((fulfil, reject) => {
            let deletedCount = 0;
            let onSuccess = (e) => {
                let cur = e.target.result;
                if (cur) {
                    cur.delete();
                    deletedCount++;
                    cur.continue();
                } else {
                    if (deletedCount) {
                        this.fs.logger.info(`Deleted recording! (chunk count: ${deletedCount})`);
                        fulfil();
                    }
                    else {
                        reject(new LookupError(`No chunks exist for ${this.path}.`));
                    }
                }
            };
            this._getCursor(false, onSuccess, reject);
        });
    }

    readEach(f) {
        return new Promise((fulfil, reject) => {
            let called = false;
            this._getCursor(true, function(e) {
                let cur = e.target.result;
                if (cur) {
                    called = true;
                    f(cur.value.blob);
                    cur.continue();
                }
                else {
                    if (called) {
                        fulfil();
                    }
                    else {
                        reject(new LookupError(`No chunks exist for ${this.path}.`));
                    }
                }
            }, reject);
        });
    }

    async read() {
        let blobs = [];
        await this.readEach(b => blobs.push(b));
        return new Blob(blobs, {type: blobs[0].type});
    }

    _getCursor(ro = false, onsuccess, onerr) {
        this.fs.logger.log(`Getting cursor (readonly = ${ro})`);
        let index = this.fs._getObjectStore(ro).index("filename");
        let curReq = index.openCursor(IDBKeyRange.only(this.path));
        curReq.onsuccess = onsuccess;
        curReq.onerror = (e) => onerr(translateError(e.target.error));
    }
}


export default class IDBFS extends FS {
    constructor(opts) {
        super();
        this.dbname = opts.dbname;
        this.logger = this.logger = new Logger(opts.logger, 'HTML5FS');
    }
    clear() {
        return new Promise((fulfil, reject) => {
            this.close();
            let req = indexedDB.deleteDatabase(this.dbname);
            req.onblocked = () => reject(new Error("DB couldn't be deleted as it's blocked"));
            req.onerror = (e) => reject(e.target.error);
            req.onsuccess = () => fulfil();
        });
    }
    open() {
        return new Promise((fulfil, reject) => {
            if (this.db) {
                fulfil(this);
                return;
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
                this.logger.info('FS opened.');
                this.db.onerror = (e) => console.error(e.target.error);
                this.db.onabort = (e) => console.error(e.target.error);
                this.db.onversionchange = (e) => {
                    e.target.close();
                };
                this.watchDiskUsage();
                fulfil(this);
            };

            openRequest.onerror = evt => reject(translateError(evt.target.error));
        });
    }

    close() {
        clearInterval(this._diskUsageTimer);
        if (this.db) {
            this.db.close();
        }
        this.db = null;
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

    getDiskUsage() {
        return getStorageUsage();
    }
}

export {IDBFS, FSError, LookupError, DiskSpaceError};