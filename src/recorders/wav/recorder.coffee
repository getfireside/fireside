WORKER_PATH = '/audio/recorderWorker.js'

class WAVAudioRecorder
	constructor: (source, cfg) ->
		@config = cfg or {}
		@recording = false

		bufferLen = config.bufferLen or 4096
		@context = source.context
		if not @context.createScriptProcessor
			@node = @context.createJavaScriptNode(bufferLen, 2, 2)
		else
			@node = @context.createScriptProcessor(bufferLen, 2, 2)

		@node.onaudioprocess = (e) ->
			if not @recording
				return
			worker.postMessage
				command: 'record'
				buffer: [
					e.inputBuffer.getChannelData(0),
					e.inputBuffer.getChannelData(1)
				]

		source.connect

		worker = new Worker(@config.workerPath || WORKER_PATH)
		worker.postMessage
			command: 'init'
			config: 
				sampleRate: @context.sampleRate

		worker.onmessage = (e) ->
			if @_currCallback
				@_currCallback(e.data)

		

		

	configure = (cfg) ->
		_.extend(@config, cfg)

	start: ->
		@clear()
		@recording = true

	stop: ->
		@recording = false

	clear: ->
		worker.postMessage({ command: 'clear' })

	getBuffers: (cb) ->
		@_currCallback = cb or config.callback;
		worker.postMessage({ command: 'getBuffers' })

	exportWAV: (cb, type) ->
		@_currCallback = cb or config.callback;
		type = type or config.type or 'audio/wav';
		if not @_currCallback
			throw new Error('Callback not set')
		worker.postMessage
			command: 'exportWAV',
			type: type

	




		