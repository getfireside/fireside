let recLength = 0;
let recBuffersL = [];
let recBuffersR = [];
let sampleRate = undefined;
let sliceLength = 44100;
let dataBuffer = [];

function writeHeader(sampleRate, chunkLength) {
    function writeString(view, offset, string) {
        let i = 0;
        while (i < string.length) {
            view.setUint8(offset + i, string.charCodeAt(i));
            i++;
        }
    };

    let buffer = new ArrayBuffer(44);
    let view = new DataView(buffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');

    /* file length */
    view.setUint32(4, 32 + chunkLength, true);

    /* RIFF type */
    writeString(view, 8, 'WAVE');

    /* format chunk identifier */
    writeString(view, 12, 'fmt ');

    /* format chunk length */
    view.setUint32(16, 16, true);

    /* sample format (raw) */
    view.setUint16(20, 1, true);

    /* channel count */
    view.setUint16(22, 2, true);

    /* sample rate */
    view.setUint32(24, sampleRate, true);

    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * 4, true);

    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 4, true);

    /* bits per sample */
    view.setUint16(34, 16, true);

    /* data chunk identifier */
    writeString(view, 36, 'data');

    /* data chunk length */
    view.setUint32(40, chunkLength, true);
    return new Blob([view], {'type': 'audio/wav'});
};


let init = function(config) {
    sampleRate = config.sampleRate;
    sliceLength = (config.timeslice * sampleRate) / 1000;
    dataBuffer.push(writeHeader(sampleRate, 0));
};

let record = function(inputBuffer) {
    recBuffersL.push(inputBuffer[0]);
    recBuffersR.push(inputBuffer[1]);
    recLength += inputBuffer[0].length;

    // check if we need to write back buffers
    if (recLength > sliceLength) {
        return writeData();
    }
};

var writeData = function(isLast = false) {
    let bufferL = mergeBuffers(recBuffersL, recLength);
    let bufferR = mergeBuffers(recBuffersR, recLength);
    let interleaved = interleave(bufferL, bufferR);
    let buffer = new ArrayBuffer(interleaved.length * 2);
    let view = new DataView(buffer);
    floatTo16BitPCM(view, 0, interleaved);
    let audioBlob = new Blob([view], {type: 'audio/wav'});
    dataBuffer.push(audioBlob);
    clear();
    return self.postMessage({
        data: new Blob(dataBuffer.splice(0, dataBuffer.length), {type: 'audio/wav'}),
        isLast: isLast
    });
};

var clear = function() {
    recLength = 0;
    recBuffersL = [];
    recBuffersR = [];
};

let totalClear = function() {
    clear();
    dataBuffer = [];
    dataBuffer.push(writeHeader(sampleRate, 0));
};

var mergeBuffers = function(recBuffers, recLength) {
    let result = new Float32Array(recLength);
    let offset = 0;
    let i = 0;
    while (i < recBuffers.length) {
        result.set(recBuffers[i], offset);
        offset += recBuffers[i].length;
        i++;
    }
    return result;
};

var interleave = function(inputL, inputR) {
    let length = inputL.length + inputR.length;
    let result = new Float32Array(length);
    let index = 0;
    let inputIndex = 0;
    while (index < length) {
        result[index++] = inputL[inputIndex];
        result[index++] = inputR[inputIndex];
        inputIndex++;
    }
    return result;
};

var floatTo16BitPCM = function(output, offset, input) {
    let i = 0;
    while (i < input.length) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, (s < 0 ? s * 0x8000 : s * 0x7FFF), true);
        i++;
        offset += 2;
    }
};

self.onmessage = function(e) {
    switch (e.data.command) {
        case 'init':
            init(e.data.config);
            break;
        case 'record':
            record(e.data.buffer);
            break;
        case 'stop':
            writeData(true); // isLast = true;
            break;
        case 'clear':
            totalClear();
            break;
    }
}