View = require '../view.coffee'
UsersView = require './users.coffee'
LogView = require './log.coffee'
statusViews = require './status.coffee'
ControlsPane = require './controls.coffee'
cookies = require 'cookies-js'

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

		@showChildView 'main', @usersView
		@showChildView 'secondary', @logView
		@showChildView 'controls', @controlsPane

		# @model.roomController.on 'streamAdded', @callView.handleRemoteStreamStart
		# @model.roomController.on 'streamRemoved', @callView.handleRemoteStreamEnd

		@model.roomController.connection.on 'disconnect', =>
			if not @connectionStatusView?
				@connectionStatusView = new statusViews.ConnectionStatusView
					model: new Backbone.Model
						error: true
				@connectionStatusView.on 'retry', => @model.roomController.connection.socket.reconnect()
				@showChildView 'status', @connectionStatusView

		@model.roomController.connection.on 'reconnect_failed', =>
			if @connectionStatusView?
				@connectionStatusView.model.set 
					reconnecting: false

		@model.roomController.connection.on 'reconnecting', =>
			@connectionStatusView.model.set 'reconnecting', true

		@model.roomController.connection.on 'reconnect', =>
			if @connectionStatusView?
				@connectionStatusView.model.set
					error: false
				@connectionStatusView.render()
				setTimeout((=> 
					@status.reset()
					delete @connectionStatusView
				), 1000)


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