import HTML5FS from './html5fs.js';
import IDBFS from './idbfs.js';

export default function initFs(opts) {
    if (window.webkitRequestFileSystem != null) {
        return new HTML5FS(opts);
    } else {
        opts.dbname = 'fireside-filesys';
        return new IDBFS(opts);
    }
}