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
		@$('a#changeVidRes').on 'click', ->
			$('#ffVideoResModal').modal 'show'
			if not window.yakkFFExtension
				window.location.href = $('#ffVideoResModal p.ffextn-not-installed a').attr('href')
			else
				$('#ffVideoResModal p.ffextn-not-installed').hide()
				$('#ffVideoResModal .btn.save').removeAttr('disabled')
				window.yakkFFGetRes (err, w, h) ->
					if w
						$('#ffVideoResModal input[name=width]').val(w)
					if h
						$('#ffVideoResModal input[name=height]').val(h)

		$('#ffVideoResModal .btn.save').on 'click', =>
			width = $('#ffVideoResModal input[name=width]').val()
			height = $('#ffVideoResModal input[name=height]').val()
			if window.yakkFFExtension
				window.yakkFFSetRes(width, height)
				setTimeout((-> window.location.reload()), 500)

	getVideoEl: ->
		return @$('div.video-local video')

	handleStreamStart: (peer) =>
		@$('div.video').show()
		@$('div.waiting').hide()
		attachMediaStream(peer.stream, @$('video#remoteVideo')[0])

	handleStreamEnd: (peer) =>
		@$('div.waiting').show()


module.exports = CallView