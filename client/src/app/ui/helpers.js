import _ from 'lodash';

export function formatBytes(bytes, opts) {
    opts = _.extend({sf: 3}, opts);
    if (bytes == 0) return '0 bytes';
    if (bytes == 1) return '1 byte';
    let k = 1000,
        sizes = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
        i = Math.floor(Math.log(bytes) / Math.log(k));
    if (opts.relativeTo) {
        i = Math.floor(Math.log(opts.relativeTo) / Math.log(k));
    }
    let num = (bytes / Math.pow(k, i));
    if (opts.sf == 0) {
        num = num.toFixed(0);
    }
    else {
        num = num.toPrecision(opts.sf);
    }
    if (opts.relativeTo) {
        return parseFloat(num);
    }
    return parseFloat(num) + ' ' + sizes[i];
}

export function runDownload(url, filename) {
    let a = document.createElement('a');
    a.style.display = 'none';
    document.body.appendChild(a);
    a.download = filename;
    a.href = url;
    a.click();
    document.body.removeChild(a);
}