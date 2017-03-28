import {observable, computed} from "mobx";
import _ from 'lodash';

const fileMixin = Base => class extends Base {
    @observable filename;
    @observable filesize = null;

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
            this.filesize = blob.size;
        }
        return blob;
    }

    async deleteFile() {
        let f = await this.fs.getFile(this.filename);
        await f.remove();
        this._fileSizeDirty = true;
        this.filesize = null;
    }

    async getFileBlobURL() {
        let blob = await this.getFileBlob();
        return URL.createObjectURL(blob);
    }

    async appendBlobToFile(blob) {
        let f = await this.fs.getFile(this.filename);
        await f.append(blob);
        this._fileSizeDirty = true;
        if (this.filesize == null) {
            this.filesize = 0;
        }
        this.filesize += blob.size;
    }

    async writeBlobToFile(blob, pos=0) {
        // for now only pos = 0 supported, for rewriting wav headers
        let f = await this.fs.getFile(this.filename);
        await f.write(blob, pos);
        return;
    }
}

export default fileMixin;