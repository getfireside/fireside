View = require '../view.coffee'
UsersView = require './users.coffee'
LogView = require './log.coffee'
ControlsPane = require './controls.coffee'
cookies = require 'cookies-js'

class RoomView extends Marionette.LayoutView
	el: 'body' 
	template: false
	regions: 
		users: '#mainPane'
		secondary: '#secondaryPane'
		controls: '#controlsPane'

	onRender: ->
		@usersView = new UsersView @
		@logView = new LogView @
		@controlsPane = new ControlsPane @

		@showChildView 'users', @usersView
		@showChildView 'secondary', @logView
		@showChildView 'controls', @controlsPane

		# @model.roomController.on 'streamAdded', @callView.handleRemoteStreamStart
		# @model.roomController.on 'streamRemoved', @callView.handleRemoteStreamEnd

		# really shouldn't be in the view but leave this here for now...
		join = (n) =>
			@model.roomController.setLocalName(n)
			@model.self.set 'name', n
			@model.roomController.joinRoom()

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