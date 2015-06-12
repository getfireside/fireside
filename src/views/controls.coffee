moment = require 'moment'
attachMediaStream = require 'attachmediastream'
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
			if type.video
				el = @$('video')[0]
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
	constructor: (@roomView, opts) ->
		super opts
		timer = null
		@recordingController = @roomView.model.recordingController
		@roomController = @roomView.model.roomController

		@recordingController.on 'ready', =>
			@$('button.recorder').removeAttr 'disabled'

		@recordingController.on 'started', (recording) =>
			@$('button.recorder span.text').text('Stop')
			@$('button.recorder').addClass 'stop'
			timer = setInterval((=> @$('button.recorder time').html(formatDiff(new Date(recording.get('started')), new Date()))), 1000)

		@recordingController.on 'stopped', =>
			clearInterval timer
			@$('button.recorder').removeClass 'stop'
			@$('button.recorder span.text').text('Record')
			@$('button.recorder time').html('')

		@roomView.model.self.on 'change:role', => 
			@render()


	onButtonClick: ->
		if @recordingController.status == 'ready'
			@recordingController.start()
			@roomController.startIntervieweeRecording()
		else if @recordingController.status == 'started'
			@recordingController.stop()
			@roomController.stopIntervieweeRecording()

	events:
		'click button.recorder': 'onButtonClick'

module.exports = ControlsPane