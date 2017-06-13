import HTML5FS from './html5fs.js';
import IDBFS from './idbfs.js';

export default function initFs(opts) {
    if (window.webkitRequestFileSystem != null) {
        return new HTML5FS(opts);
    } else {
        return new IDBFS(opts);
    }
}