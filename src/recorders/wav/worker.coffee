recLength = 0
recBuffersL = []
recBuffersR = []
sampleRate = undefined

init = (config) ->
	sampleRate = config.sampleRate
	return

record = (inputBuffer) ->
	recBuffersL.push inputBuffer[0]
	recBuffersR.push inputBuffer[1]
	recLength += inputBuffer[0].length
	return

exportWAV = (type) ->
	bufferL = mergeBuffers(recBuffersL, recLength)
	bufferR = mergeBuffers(recBuffersR, recLength)
	interleaved = interleave(bufferL, bufferR)
	dataview = encodeWAV(interleaved)
	audioBlob = new Blob([ dataview ], type: type)
	@postMessage audioBlob
	return

getBuffers = ->
	buffers = []
	buffers.push mergeBuffers(recBuffersL, recLength)
	buffers.push mergeBuffers(recBuffersR, recLength)
	@postMessage buffers
	return

clear = ->
	recLength = 0
	recBuffersL = []
	recBuffersR = []
	return

mergeBuffers = (recBuffers, recLength) ->
	result = new Float32Array(recLength)
	offset = 0
	i = 0
	while i < recBuffers.length
		result.set recBuffers[i], offset
		offset += recBuffers[i].length
		i++
	return result

interleave = (inputL, inputR) ->
	length = inputL.length + inputR.length
	result = new Float32Array(length)
	index = 0
	inputIndex = 0
	while index < length
		result[index++] = inputL[inputIndex]
		result[index++] = inputR[inputIndex]
		inputIndex++
	return result

floatTo16BitPCM = (output, offset, input) ->
	i = 0
	while i < input.length
		s = Math.max(-1, Math.min(1, input[i]))
		output.setInt16 offset, if s < 0 then s * 0x8000 else s * 0x7FFF, true
		i++
		offset += 2
	return

writeString = (view, offset, string) ->
	i = 0
	while i < string.length
		view.setUint8 offset + i, string.charCodeAt(i)
		i++
	return

encodeWAV = (samples, mono) ->
	buffer = new ArrayBuffer(44 + samples.length * 2)
	view = new DataView(buffer)

	### RIFF identifier ###
	writeString view, 0, 'RIFF'

	### file length ###
	view.setUint32 4, 32 + samples.length * 2, true

	### RIFF type ###
	writeString view, 8, 'WAVE'

	### format chunk identifier ###
	writeString view, 12, 'fmt '

	### format chunk length ###
	view.setUint32 16, 16, true

	### sample format (raw) ###
	view.setUint16 20, 1, true

	### channel count ###
	view.setUint16 22, if mono then 1 else 2, true

	### sample rate ###
	view.setUint32 24, sampleRate, true

	### byte rate (sample rate * block align) ###
	view.setUint32 28, sampleRate * 4, true

	### block align (channel count * bytes per sample) ###
	view.setUint16 32, 4, true

	### bits per sample ###
	view.setUint16 34, 16, true

	### data chunk identifier ###
	writeString view, 36, 'data'

	### data chunk length ###
	view.setUint32 40, samples.length * 2, true
	floatTo16BitPCM view, 44, samples
	return view

@onmessage = (e) ->
	switch e.data.command
		when 'init'
			init e.data.config
		when 'record'
			record e.data.buffer
		when 'exportWAV'
			exportWAV e.data.type
		when 'exportMonoWAV'
			exportMonoWAV e.data.type
		when 'getBuffers'
			getBuffers()
		when 'clear'
			clear()
	return