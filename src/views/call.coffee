attachMediaStream = require('attachmediastream')

class CallView extends Thorax.View 
	template: Handlebars.templates['call']

	constructor: (@roomView) ->
		controlsViews = 
			host: new Thorax.View
				template: Handlebars.templates['host-controls']
			interviewee: new Thorax.View
				template: Handlebars.templates['interviewee-controls']
			peer: new Thorax.View
				template: Handlebars.templates['peer-controls']
		remoteVideo = new Thorax.View
			template: Handlebars.compile('<video id="remoteVideo"></video>')
		remoteVideo.retain()
		super 
			controls: controlsViews[@roomView.model.self.get('role') ? controlsViews.peer]
			remoteVideo: remoteVideo
			controlsViews: controlsViews

		@roomView.model.on 'setRole', (role) =>
			@controls = @controlsViews[role]
			@render()

	getVideoEl: ->
		return @$('div.video-local video')

	handleRemoteVideoStart: (peer) =>
		@callConnected = true
		@render()
		attachMediaStream(peer.stream, @$('video#remoteVideo')[0])

	handleRemoteVideoEnd: (peer) =>
		@callConnected = false
		@render()


module.exports = CallView