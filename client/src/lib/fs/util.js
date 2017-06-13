export function fileToArrayBuffer(blob) {
    return new Promise((fulfil, reject) => {
        let reader = new FileReader();
        reader.onload = function(e) {
            fulfil(e.target.result);
        };
        reader.onerror = function(e) {
            reject(e);
        };
        reader.readAsArrayBuffer(blob);
    });
}

export function stringToArrayBuffer(str) {
    return new TextEncoder("utf-8").encode(str);
}

export function estimateFreeSpace() {
    return navigator.storage.estimate();
}