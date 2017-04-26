export function formatBytes(bytes,decimals) {
    if (bytes == 0) return '0 bytes';
    if (bytes == 1) return '1 byte';
    let k = 1000,
        dm = decimals || 2,
        sizes = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
        i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
