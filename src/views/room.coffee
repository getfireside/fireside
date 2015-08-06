View = require '../view.coffee'
UsersView = require './users.coffee'
LogView = require './log.coffee'
statusViews = require './status.coffee'
ControlsPane = require './controls.coffee'
cookies = require 'cookies-js'

class StatusManager extends Marionette.CollectionView
	# one status allowed per type...
	tagName: 'ul'
	className: 'statuses'

	constructor: ->
		@currentStatuses = new Backbone.Collection()
		super {collection: @currentStatuses}

	getChildView: (item) -> statusViews.getFromType(item.id)

	setStatus: (type, data) ->
		data.id = type
		@currentStatuses.set [data]

	removeStatus: (type) -> @currentStatuses.remove type
	queueRemove: (type, time) -> setTimeout((=> @removeStatus(type)), time)

class RoomView extends Marionette.LayoutView
	el: 'body' 
	template: false
	regions: 
		main: '#mainPane'
		secondary: '#secondaryPane'
		controls: '#controlsPane'
		status: '#statusArea'

	onRender: ->
		@usersView = new UsersView @
		@logView = new LogView @
		@controlsPane = new ControlsPane @
		@statusManager = new StatusManager

		@showChildView 'main', @usersView
		@showChildView 'secondary', @logView
		@showChildView 'controls', @controlsPane
		@showChildView 'status', @statusManager

		# @model.roomController.on 'streamAdded', @callView.handleRemoteStreamStart
		# @model.roomController.on 'streamRemoved', @callView.handleRemoteStreamEnd

		@model.roomController.connection.on 'disconnect', =>
			@statusManager.setStatus 'connection', {error:true}
		@statusManager.on 'childview:retryConnection', => @model.roomController.connection.socket.reconnect()

		@model.roomController.connection.on 'reconnect_failed', => @statusManager.setStatus 'connection', {error:true, reconnecting: false}
		@model.roomController.connection.on 'reconnecting', => @statusManager.setStatus 'connection', {reconnecting: true}
		@model.roomController.connection.on 'reconnect', =>
			@statusManager.setStatus 'connection', {error:false}
			@statusManager.queueRemove 'connection', 2500

		@model.recordingController.on 'started', (rec) => @statusManager.setStatus 'recording', {duration:0, size:0}
		@model.recordingController.on 'tick', (rec) => @statusManager.setStatus 'recording', {duration: rec.duration, size: rec.get 'filesize'}
		@model.recordingController.on 'stopped', (rec) => @statusManager.removeStatus 'recording'

		@model.recordingCollection.on 'uploadStarted', (rec) => 
			@statusManager.setStatus 'upload', {complete:false, progress: '0%'}
		@model.recordingCollection.on 'uploadProgress', (rec, prog) => 
			@statusManager.setStatus 'upload', {complete:false, progress: (prog.loaded / prog.total)*100 + '%', eta: prog.eta, speed: prog.speed}
		@model.recordingCollection.on 'uploadComplete', (rec, url) => 
			@statusManager.setStatus 'upload', {complete:true, progress: '100%'}
			@statusManager.queueRemove 'upload', 2500

		is_firefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

		@model.roomController.on 'requestLocalMedia', =>
			if is_firefox
				@$('div#ffGUMInstructions').show()

		hideIfMoz = =>
			if is_firefox
				@$('div#ffGUMInstructions').hide()			

		@model.roomController.on 'requestLocalMediaAccepted', hideIfMoz 
		@model.roomController.on 'requestLocalMediaFailed', hideIfMoz 

		@$('#reportModal form').on 'submit', =>
			@$('#reportModal form textarea, #reportModal form button').attr('disabled', true)
			data = 
				logs: @model.app.logger.appenders[0].export()
				report: @$('#reportModal textarea').val()
				roomID: @model.id
				timestamp: (new Date)
			success = =>
				@$('#reportModal textarea').val('')
				@$('#reportModal').modal('hide')
				@$('#reportModal div.alert').remove()
			failure = =>
				if not @$('#reportModal div.alert').length
					@$('#reportModal textarea').before("""<div class="alert alert-danger" role="alert">There was a problem submitting. Please try again.</div>""")
				@$('#reportModal form textarea, #reportModal form button').attr('disabled', false)

			$.postJSON '/report-issue/', data, success, failure
			return false



		# really shouldn't be in the view but leave this here for now...
		join = (n) =>
			@model.roomController.setLocalName(n)
			@model.self.set 'name', n
			p = @model.roomController.joinRoom()
			p.catch (err) ->
				if err.type == 'already-connected'
					alert "You're already connected in another tab/window! Please close that one before opening a separate one."

		if not cookies.get 'name'
			@$('#nameModal').modal 'show'
			@$('#nameModal .btn.save').on 'click', =>
				name = $('#nameModal input').val() or $('#nameModal input').attr('placeholder')
				cookies.set 'name', name
				@$('#nameModal').modal 'hide'
				join(name)
		else
			join cookies.get 'name'

	getUserCollection: -> @model.getUserCollection()
	getLogCollection: -> @model.getLogCollection()
	sendMsg: (msg) ->
		@model.sendMsg msg



module.exports = RoomView