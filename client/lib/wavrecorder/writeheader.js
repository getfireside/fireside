export default function(sampleRate, chunkLength) {
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
