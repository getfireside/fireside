WildEmitter = require 'WildEmitter'
IDBWriter = require './writers/idbwriter.coffee' 

class RecordingController extends WildEmitter
	constructor: (@room, @collection, config={}) ->
		super
		defaults = 
			recordingPeriod: 1000
		@config = _.extend {}, defaults, config
		@writer = config?.writer ? new IDBWriter 'filesys'
		@writer.open()

	addStream: (stream) -> 
		if MediaRecorder?
			@mediaRecorder = new MediaRecorder stream
			@mediaRecorder.ondataavailable = @onDataAvailable
			@mediaRecorder.onstart = @onStart
			@mediaRecorder.onstop = @onStop

	onStart: (e) =>
		@currentRecording.set 'started', new Date()
		@emit 'started', @currentRecording

	onDataAvailable: (e) =>
		console.log "got blob,", e.data.size
		f = @writer.getFile @currentRecording.id
		f.writeBlob(e.data).then ->
			console.log "wrote", e.data.size
		@currentRecording.set 'filesize', @currentRecording.get 'filesize' + e.data.size
		@currentRecording.save()

	onStop: (e) =>
		@currentRecording.set 'stopped', new Date()
		@emit 'stopped', @currentRecording

	start: ->
		#if not @mediaRecorder?
		#	throw new Error('No stream set up yet.')
		@currentRecording = @collection.create()
		if @status != 'started'
			@mediaRecorder.start(@config.recordingPeriod)
			@status = 'started'

	stop: ->
		@mediaRecorder.stop()
		@status = 'ready'

module.exports = RecordingController