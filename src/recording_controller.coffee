WildEmitter = require 'wildemitter'
moment = require 'moment'
WAVAudioRecorder = require './recorders/wav/recorder.coffee'

class RecordingController extends WildEmitter
	constructor: (@room, @collection, config={}) ->
		super
		defaults = 
			recordingPeriod: 1000
		@config = _.extend {}, defaults, config

	addStream: (stream, type) -> 
		if type == 'video' and MediaRecorder?
			@mediaRecorder = new MediaRecorder stream
		else
			@mediaRecorder = new WAVAudioRecorder stream

		@mediaRecorder.ondataavailable = @onDataAvailable
		@mediaRecorder.onstart = @onStart
		@mediaRecorder.onstop = @onStop
		@status = 'ready'
		@emit 'ready'

	onStart: (e) =>
		@currentRecording.set 'started', new Date
		@emit 'started', @currentRecording

	onDataAvailable: (e) =>
		console.log "got blob,", e.data.size
		@currentRecording.appendBlob e.data, (err) ->
			if err
				console.error(err)

	onStop: (e) =>
		if @mediaRecorder instanceof WAVAudioRecorder
			@mediaRecorder.fixWaveFile @currentRecording, (err) =>
				if not err
					console.log "fixed wave file!"
					@emit 'stopped', @currentRecording
				else
					@emit 'stopped', @currentRecording
		else
			@emit 'stopped', @currentRecording
		@currentRecording.set 'stopped', new Date
		@status = 'ready'

	start: ->
		if @status != 'started'
			@currentRecording = @collection.create
				roomId: @room.id
				type: if @mediaRecorder instanceof WAVAudioRecorder then 'audio/wav'  else 'video/webm'
			@mediaRecorder.start(@config.recordingPeriod)
			@status = 'started'

	stop: ->
		@mediaRecorder.stop()
		@status = 'stopping'


module.exports = RecordingController