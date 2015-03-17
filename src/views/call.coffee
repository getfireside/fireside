attachMediaStream = require('attachmediastream')
moment = require 'moment'
#View = require '../view.coffee'

formatDiff = (a, b) -> moment.utc(b - a).format("HH:mm:ss")


class ControlsView extends Marionette.ItemView
	constructor: (@callView, opts) ->
		super opts
		timer = null
		@recordingController = @callView.roomView.model.recordingController
		@roomController = @callView.roomView.model.roomController

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


	onButtonClick: ->
		if @recordingController.status == 'ready'
			@recordingController.start()
			@roomController.startIntervieweeRecording()
		else if @recordingController.status == 'started'
			@recordingController.stop()
			@roomController.stopIntervieweeRecording()

	events:
		'click button.recorder': 'onButtonClick'

	template: Handlebars.templates['peer-controls']


class CallView extends Marionette.LayoutView 
	template: Handlebars.templates['call']
	regions:
		controls: 'div.controls'

	constructor: (@roomView, opts) ->
		super opts
		
		@roomView.model.on 'setRole', (role) =>
			@controls.show new ControlsView @,
				template: Handlebars.templates["#{role}-controls"]
			

	onRender: ->
		@controls.show new ControlsView @

	getVideoEl: ->
		return @$('div.video-local video')

	handleRemoteVideoStart: (peer) =>
		@$('div.video').show()
		@$('div.waiting').hide()
		attachMediaStream(peer.stream, @$('video#remoteVideo')[0])

	handleRemoteVideoEnd: (peer) =>
		@$('div.waiting').show()


module.exports = CallView