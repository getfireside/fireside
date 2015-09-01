WildEmitter = require 'wildemitter'
moment = require 'moment'
WAVAudioRecorder = require './recorders/wav/recorder.coffee'
LoggingController = require './logger.coffee'
Tock = require 'tocktimer'

class RecordingController extends WildEmitter
	constructor: (@room, @collection, config={}) ->
		super
		defaults = 
			recordingPeriod: 1000
		@config = _.extend {}, defaults, config
		@logger = config.logger ? new LoggingController
		@fs = @room.app.fs

	setupMediaRecorder: (stream, type) ->
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

	addStream: (stream, type) =>
		if @mediaRecorder? and @status == 'recording' or @status == 'stopping'
			# tear down
			@mediaRecorder.stop()
			@once 'stopped', ->
				@status = null
				@setupMediaRecorder(stream, type)

		p = @fs.open()
		p.then =>
			@setupMediaRecorder(stream, type)
			

		p.catch (error) =>
			# let's let everyone know this happened.
			@logger.l('fs').error 'Failed to open FS!'
			@logger.l('fs').error error.message
			@emit 'error', {message: error.userMessage or "Couldn't open filesystem to write to disk", details: error.message, err: error}

	onStart: (e) =>
		@currentRecording.set 'started', new Date
		@logger.info 'Recording started.'
		@timer.start()
		@emit 'started', @currentRecording

	onTick: =>
		@emit 'tick', @currentRecording, @currentRecording.duration()

	onDataAvailable: (e) =>
		console.log "got blob,", e.data.size
		@logger.info "Wrote #{e.data.size} bytes."
		@currentRecording.appendBlob e.data, (err) =>
			if err
				@logger.error err
				@emit 'error', {message: err.userMessage or err.name, details: err.message, err: err}
				@stop()

	onStop: (e) =>
		@timer.stop()
		if @mediaRecorder instanceof WAVAudioRecorder
			@mediaRecorder.fixWaveFile @currentRecording, (err) =>
				if not err
					@logger.log "fixed wave file!"
					@emit 'stopped', @currentRecording
				else
					@logger.error "problem writing wavefile header"
					@emit 'error', {message: "Problem writing wavefile header", details: err.message, err: err}
					@emit 'stopped', @currentRecording
		else
			@emit 'stopped', @currentRecording
		@currentRecording.set 'stopped', new Date
		@logger.info "Recording completed - length: #{@currentRecording.duration()} secs; size: #{@currentRecording.get 'filesize'} bytes"
		@status = 'ready'
		@emit 'ready'

	start: ->
		if @status == 'ready'
			@timer = new Tock
				callback: @onTick
				interval: 10
			@currentRecording = @collection.create
				roomId: @room.id
				type: if @mediaRecorder instanceof WAVAudioRecorder then 'audio/wav' else 'video/webm'
			@mediaRecorder.start(@config.recordingPeriod)
			@status = 'started'
		else
			@logger.warn "Not ready to start."

	stop: ->
		if @status == 'started'
			@emit 'stopping'
			@status = 'stopping'
			@mediaRecorder.stop()
		else
			@logger.warn "Not started!"


module.exports = RecordingController