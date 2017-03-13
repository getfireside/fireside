import {observable, computed} from "mobx";
import _ from 'lodash';

export default class FileMixin {
    @observable filename;
    @observable filesize;

    constructor(attrs, opts) {
        this.fs = opts && opts.fs;
    }

    async getFileBlob() {
        let f = await this.fs.getFile(this.filename);
        let blob = await f.read();
        return blob;
    }

    async deleteFile() {
        let f = await this.fs.getFile(this.filename);
        await f.remove();
        this.filesize = null;
    }

    async getFileBlobURL() {
        let blob = await this.getFileBlob();
        return URL.createObjectURL(blob);
    }

    async appendBlobToFile(blob) {
        let f = await this.fs.getFile(this.filename);
        await f.append(blob);
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