const WORKER_PATH = '/dist/wav-recorder-worker.js';

import writeWAVHeader from './writeheader.js';
import webrtc from 'webrtcsupport';

import { fileToArrayBuffer } from 'lib/fs/util';

export default class WAVAudioRecorder {
    constructor(stream, cfg) {
        this.config = cfg || {};

        let bufferLen = this.config.bufferLen || 4096;
        let audioContext = new webrtc.AudioContext();
        let source = audioContext.createMediaStreamSource(stream);

        this.recording = false;
        this.context = source.context;

        if (!this.context.createScriptProcessor) {
            this.node = this.context.createJavaScriptNode(bufferLen, 2, 2);
        } else {
            this.node = this.context.createScriptProcessor(bufferLen, 2, 2);
        }

        this.node.onaudioprocess = (e) => {
            if (!this.recording) {
                return;
            }
            e.inputBuffer.getChannelData(1);
            this.worker.postMessage({
                command: 'record',
                buffer: [
                    e.inputBuffer.getChannelData(0),
                    e.inputBuffer.getChannelData(1)
                ]
            });
        };

        source.connect(this.node);
        this.node.connect(this.context.destination);

        this.worker = new Worker(this.config.workerPath || WORKER_PATH);
        this.worker.postMessage({
            command: 'init',
            config: {
                sampleRate: this.context.sampleRate,
                timeslice: this.config.timeslice || 1000
            }
        });

        this.worker.onmessage = e => {
            if (this.ondataavailable != null) {
                this.ondataavailable(e.data);
            }
            if (e.data.isLast && this.onstop != null) {
                this.onstop()
            }
        };
    }

    start() {
        this.clear();
        this.recording = true;
        if (this.onstart != null) {
            return this.onstart();
        }
    }

    stop() {
        this.worker.postMessage({ command: 'stop' });
        this.recording = false;
    }

    async fixWaveFile(recording) {
        // read the sample rate
        let blob = await recording.getFileBlob();
        let header = blob.slice(0, 44);
        let buf = await fileToArrayBuffer(header);
        let view = new DataView(buf);
        let sampleRate = view.getUint32(24, true);
        await recording.writeBlobToFile(writeWAVHeader(sampleRate, blob.size - 44), 0);
        return;
    }

    clear() {
        return this.worker.postMessage({ command: 'clear' });
    }

    async destroy() {
        if (this.context) {
            await this.context.close();
            console.log("Destroyed audioContext successfully")
        }
        if (this.worker) {
            this.worker.terminate()
        }
    }
}