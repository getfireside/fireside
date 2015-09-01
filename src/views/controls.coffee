moment = require 'moment'
attachMediaStream = require 'attachmediastream'
formatDuration = (require '../utils.coffee').formatDuration
pad = (num, size) ->
    s = num + ""
    while (s.length < size) 
        s = "0" + s
    return s
#View = require '../view.coffee'

formatDiff = (a, b) -> moment.utc(b - a).format("HH:mm:ss")


class ControlsPane extends Marionette.LayoutView
	regions: 
		'self': '#self'
		'controls': '#controls'
	template: Handlebars.templates['controls-pane']
	constructor: (@roomView, opts) ->
		super opts

	onRender: ->
		@selfView = new SelfView @roomView, {model: @roomView.model.self}
		@controlsView = new ControlsView @roomView

		@showChildView 'self', @selfView
		@showChildView 'controls', @controlsView

	getLocalVideoEl: -> @selfView.$('video')

class SelfView extends Marionette.ItemView
	template: Handlebars.templates['self']
	constructor: (@roomView, opts) ->
		super opts
		@roomView.model.on 'localStreamUpdated', (type, stream) =>
			if type == 'video'
				el = @$('video')[0]
				@$('video').show()
				@$('img').hide()
			else
				el = @$('audio')[0]
			attachMediaStream stream, el, 
				muted: true
				mirror: true
		opts.model.on 'change', => @render()

	render: ->
		if not @isRendered
			super()
		else
			@triggerMethod 'before:render', @
			data = @serializeData()
			@$('div.name em').text(data.name)
			@triggerMethod 'render', @
		return @






class ControlsView extends Marionette.ItemView
	template: => 
		if @roomView and @roomView.model.self.get('role') == 'host' 
			return Handlebars.templates['host-controls']
		else
			return Handlebars.templates['nonhost-controls']

	updateStreamStatus: =>
		isStarted = @roomView.model.roomController.localMediaStatus == 'started'
		type = @roomView.model.get 'mode'
		@$('button.stream').toggleClass('start', isStarted)
		@$('button.stream span.toggle').html(if isStarted then 'off' else 'on')
		@$('button.stream span.type').html(type)

	constructor: (@roomView, opts) ->
		super opts
		timer = null
		@recordingController = @roomView.model.recordingController
		@roomController = @roomView.model.roomController

		@roomController.localMedia.on ev, @updateStreamStatus for ev in ['audioOn', 'audioOff', 'videoOn', 'videoOff', 'localStreamStopped']
		@roomController.on 'requestLocalMediaAccepted', @updateStreamStatus

		@recordingController.on 'ready', =>
			@$('button.recorder').removeAttr 'disabled'
			@$('button.recorder').removeClass 'stop'
			@$('button.recorder span.text').text('Record')
			@$('button.recorder time').html('')

		@recordingController.on 'stopping', =>
			@$('button.recorder').attr 'disabled', 'disabled'
			@$('button.recorder span.text').text('Stopping...')

		@recordingController.on 'started', (recording) =>
			@$('button.recorder span.text').text('Stop')
			@$('button.recorder').addClass 'stop'
			# timer = setInterval((=> @$('button.recorder time').html(formatDiff(new Date(recording.get('started')), new Date()))), 1000) replace with tick!

		@recordingController.on 'tick', (recording, duration) =>
			@$('button.recorder time').html(formatDuration(duration))


		@recordingController.on 'stopped', =>
			# nothing to do here

		@roomView.model.self.on 'change:role', => 
			@render()

		@onRender = @updateStreamStatus
		


	onRecordButtonClick: ->
		if @recordingController.status == 'ready'
			@recordingController.start()
			@roomController.startIntervieweeRecording()
		else if @recordingController.status == 'started'
			@recordingController.stop()
			@roomController.stopIntervieweeRecording()

	onStreamButtonClick: ->
		if @roomController.localMediaStatus != 'started'
			@roomController.startLocalMedia()
			@roomController.changeRoomStatus 'live'
		else
			@roomController.stopLocalMedia()
			@roomController.changeRoomStatus 'waiting'

	events:
		'click button.recorder': 'onRecordButtonClick'
		'click button.stream': 'onStreamButtonClick'


module.exports = ControlsPane