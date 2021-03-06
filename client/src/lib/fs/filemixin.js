import {observable, computed, action, runInAction} from "mobx";
import _ from 'lodash';

const fileMixin = Base => class extends Base {
    @observable filename;
    @observable filesize = null;
    @observable deleted = false;

    constructor(...args) {
        super(...args);
        setTimeout(async() => {
            try {
                await this.getFileBlob();
            }
            catch (err) {

            }
        }, 0);
    }

    async getFileBlob() {
        let f = await this.fs.getFile(this.filename);
        this._fileSizeDirty = false;
        let blob = await f.read();
        if (!this._fileSizeDirty) {
            runInAction( () => {
                this.filesize = blob.size;
            });
        }
        return blob;
    }

    async deleteFile() {
        let f = await this.fs.getFile(this.filename);
        await f.remove();
        runInAction( () => {
            this.deleted = true;
        })

    }

    async getFileBlobURL() {
        let blob = await this.getFileBlob();
        return URL.createObjectURL(blob);
    }

    async appendBlobToFile(blob) {
        let f = await this.fs.getFile(this.filename);
        await f.append(blob);
        this._fileSizeDirty = true;
        runInAction( () => {
            if (this.filesize == null) {
                this.filesize = 0;
            }
            this.filesize += blob.size;
            this._fileSizeDirty = false;
        });
    }

    async writeBlobToFile(blob, pos=0) {
        // for now only pos = 0 supported, for rewriting wav headers
        let f = await this.fs.getFile(this.filename);
        await f.write(blob, pos);
        return;
    }

    async readFileAt(pos, length) {
        // naive for now
        let f = await this.getFileBlob();
        return f.slice(pos, pos+length);
    }
};

export default fileMixin;