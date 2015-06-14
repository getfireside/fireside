WildEmitter = require 'wildemitter'
moment = require 'moment'
WAVAudioRecorder = require './recorders/wav/recorder.coffee'
LoggingController = require './logger.coffee'

class RecordingController extends WildEmitter
	constructor: (@room, @collection, config={}) ->
		super
		defaults = 
			recordingPeriod: 1000
		@config = _.extend {}, defaults, config
		@logger = config.logger ? new LoggingController
		@fs = @room.app.fs

	addStream: (stream, type) -> 
		p = @fs.open()
		p.then =>
			@logger.l('fs').log('Opened filesystem successfully.')
			if @fs.getSpaceInfo?
				@fs.getSpaceInfo().then (res) =>
					@logger.l('fs').info("Disk usage: #{res.used} used, #{res.free} free, #{res.total} total")
			if type == 'video' and MediaRecorder?
				@mediaRecorder = new MediaRecorder stream
			else
				@mediaRecorder = new WAVAudioRecorder stream,
					logger: @logger

			@mediaRecorder.ondataavailable = @onDataAvailable
			@mediaRecorder.onstart = @onStart
			@mediaRecorder.onstop = @onStop
			@status = 'ready'
			@emit 'ready'
			@logger.info 'Stream added- ready to record!'

		p.catch =>
			@logger.l('fs').error 'Failed to open FS!'
			@logger.l('fs').error arguments

	onStart: (e) =>
		@currentRecording.set 'started', new Date
		@logger.info 'Recording started.'
		@emit 'started', @currentRecording

	onDataAvailable: (e) =>
		console.log "got blob,", e.data.size
		@logger.info "Wrote #{e.data.size} bytes."
		@currentRecording.appendBlob e.data, (err) ->
			if err
				console.error(err)

	onStop: (e) =>
		if @mediaRecorder instanceof WAVAudioRecorder
			@mediaRecorder.fixWaveFile @currentRecording, (err) =>
				if not err
					@logger.log "fixed wave file!"
					@emit 'stopped', @currentRecording
				else
					@logger.error ["error with wave file", err]
					@emit 'stopped', @currentRecording
		else
			@emit 'stopped', @currentRecording
		@currentRecording.set 'stopped', new Date
		@status = 'ready'

	start: ->
		if @status != 'started'
			@currentRecording = @collection.create
				roomId: @room.id
				type: if @mediaRecorder instanceof WAVAudioRecorder then 'audio/wav' else 'video/webm'
			@mediaRecorder.start(@config.recordingPeriod)
			@status = 'started'

	stop: ->
		@mediaRecorder.stop()
		@status = 'stopping'


module.exports = RecordingController