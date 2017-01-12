export default class PostJSONAppender {
    constructor(opts) {
        this.url = opts.url;
    }
    write(log) {
        return $.postJSON(this.url, log);
    }
}