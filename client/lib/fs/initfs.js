HTML5FS = import './html5fs.js';
IDBFS = import './idbfs.js';

export default function initFs(opts) {
    if (window.webkitRequestFileSystem != null) {
        return new HTML5FS(opts);
    } else {
        opts.dbname = 'fireside-filesys';
        return new IDBFS(opts);
    }
}