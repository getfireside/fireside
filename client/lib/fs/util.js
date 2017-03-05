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
    })
}
