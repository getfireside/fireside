const WORKER_PATH = '/dist/wav-recorder-worker.js';

import writeWAVHeader from './writeheader.js';
import webrtc from 'webrtcsupport';

export default class WAVAudioRecorder {
	constructor(stream, cfg) {
		let audioContext = new webrtc.AudioContext();
		let source = audioContext.createMediaStreamSource(stream);
		let bufferLen = this.config.bufferLen || 4096;
		
		this.config = cfg || {};
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
				this.ondataavailable(e);
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
		if (this.onstop != null) {
			this.onstop();
		}
	}

	fixWaveFile(recording, cb) {
		// read the sample rate
		recording.getBlob(function(err, file) {
			if (!err) {
				let header = file.slice(0, 44);
				return FilerUtil.fileToArrayBuffer(header, function(buf) {
					let view = new DataView(buf);
					let sampleRate = view.getUint32(24, true);
					recording.overwriteHeader(writeWAVHeader(sampleRate, file.size - 44), cb);
				});
			}
		});
	}

	clear() {
		return this.worker.postMessage({ command: 'clear' });
	}
}
WAVAudioRecorder.initClass();

export default WAVAudioRecorder;



		