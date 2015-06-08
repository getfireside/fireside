WORKER_PATH = '/dist/wav-recorder-worker.js'
writeWAVHeader = require './writeheader.coffee'
webrtc = require 'webrtcsupport'

class WAVAudioRecorder
	constructor: (stream, cfg) ->
		audioContext = new webrtc.AudioContext()
		source = audioContext.createMediaStreamSource stream
		@config = cfg or {}
		@recording = false

		bufferLen = @config.bufferLen or 4096
		@context = source.context
		if not @context.createScriptProcessor
			@node = @context.createJavaScriptNode(bufferLen, 2, 2)
		else
			@node = @context.createScriptProcessor(bufferLen, 2, 2)

		@node.onaudioprocess = (e) =>
			if not @recording
				return
			e.inputBuffer.getChannelData(1)
			@worker.postMessage
				command: 'record'
				buffer: [
					e.inputBuffer.getChannelData(0),
					e.inputBuffer.getChannelData(1)
				]

		source.connect @node
		@node.connect @context.destination

		@worker = new Worker(@config.workerPath || WORKER_PATH)
		@worker.postMessage
			command: 'init'
			config: 
				sampleRate: @context.sampleRate
				timeslice: @config.timeslice or 1000

		@worker.onmessage = (e) =>
			if @ondataavailable?
				@ondataavailable(e)

	configure = (cfg) ->
		_.extend(@config, cfg)

	start: ->
		@clear()
		@recording = true
		if @onstart?
			@onstart()

	stop: ->
		@worker.postMessage({ command: 'stop' })
		@recording = false
		if @onstop?
			@onstop()

	fixWaveFile: (recording, cb) ->
		# read the sample rate
		recording.getBlob (err, file) ->
			if not err
				header = file.slice(0, 44)
				FilerUtil.fileToArrayBuffer header, (buf) ->
					view = new DataView(buf)
					sampleRate = view.getUint32 24, true
					recording.overwriteHeader(writeWAVHeader(sampleRate, file.size - 44), cb)

	clear: ->
		@worker.postMessage({ command: 'clear' })

module.exports = WAVAudioRecorder



		