import { FSError, LookupError, DiskSpaceError, FSFile, FS } from './fs';
import { Logger } from 'lib/logger';
import _ from 'lodash';

class MemFile extends FSFile {
    constructor(path, fs) {
        super()
        this.path = path;
        this.fs = fs;
    }

    append(blob) {
        return this.fs.appendToFile(this.path, blob);
    }

    write(blob, pos) {
        return this.fs.writeToFile(this.path, blob, pos);
    }

    remove() {
        return this.fs.removeFile(this.path);
    }

    readEach(f) {
        return this.fs.readEachFromFile(this.path, f);
    }

    read() {
        return this.fs.readFile(this.path);
    }
}


class MemFS extends FS {
    constructor(opts) {
        super()
        if (opts == null) {
            opts = {}
        }
        this.dbname = opts.dbname || 'testdb';
        this.logger = opts.logger || new Logger();
        this.db = {}
    }
    open() {
        return new Promise((fulfil, reject) => {
            fulfil(this);
        });
    }

    appendToFile(path, blob) {
        return new Promise((fulfil, reject) => {
            if (this.db[path] == null) {
                this.db[path] = [];
            }
            this.db[path].push(blob);
            fulfil()
        })
    }

    removeFile(path) {
        return new Promise((fulfil, reject) => {
            if (this.db[path] != null) {
                delete this.db[path];
                fulfil()
            }
            else {
                reject(new LookupError("File does not exist."));
            }
        })
    }

    writeToFile(path, blob, pos) {
        return new Promise((fulfil, reject) => {
            if (pos === 0) {
                if (this.db[path] == null) {
                    this.db[path] = [];
                }
                let bytesToOverwrite = Math.min(blob.size, new Blob(this.db[path]).size);
                console.info("Attempting to overwrite", bytesToOverwrite, "bytes")
                while (bytesToOverwrite > 0) {
                    if (bytesToOverwrite >= new Blob(this.db[path].slice(0, 1)).size) {
                        console.info("First blob has size", new Blob(this.db[path].slice(0, 1)).size, "bytes, so deleting")
                        let deleted = this.db[path].shift();
                        bytesToOverwrite -= deleted.size;
                        console.info(bytesToOverwrite, "bytes left to overwrite")
                    }
                    else {
                        console.log("Bytes to ovewrite is smaller than first blob size");
                        this.db[path][0] = this.db[path][0].slice(bytesToOverwrite);
                        bytesToOverwrite = 0;
                    }
                }
                this.db[path].unshift(blob);
                fulfil();
            }
            else {
                return reject(new FSError("Not implemented yet!"))
            }
        })
    }

    readEachFromFile(path, callback) {
        return new Promise((fulfil, reject) => {
            let blobs = this.db[path];
            if (blobs == null) {
                reject(new LookupError(`File ${path} does not exist!`))
            }
            _.map(blobs, callback);
            fulfil();
        })
    }

    readFile(path) {
        let blobs = [];
        return new Promise((fulfil, reject) => {
            this.readEachFromFile(path, (b) => blobs.push(b)).then(() => {
                fulfil(new Blob(blobs, {type: blobs[0].type}))
            }).catch(reject);
        })
    }

    getFile(path, opts) {
        return new Promise((fulfil, reject) => {
            fulfil(new MemFile(path, this));
        });
    }

    clear() {
        this.db = {};
    }
}

export default MemFS;
export {LookupError, FSError, DiskSpaceError};