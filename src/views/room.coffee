View = require '../view.coffee'
CallView = require './call.coffee'
LogView = require './log.coffee'
UsersView = require './users.coffee'
cookies = require 'cookies-js'

class RoomView extends Marionette.LayoutView
	el: 'body' 
	template: false
	regions: 
		call: '#callPanel'
		log: '#logPanel'
		users: '#usersPanel'

	onRender: ->
		@callView = new CallView @
		@logView = new LogView @
		@usersView = new UsersView @
		@showChildView 'call', @callView
		@showChildView 'log', @logView
		@showChildView 'users', @usersView

		@model.roomController.on 'videoAdded', @callView.handleRemoteVideoStart
		@model.roomController.on 'videoRemoved', @callView.handleRemoteVideoEnd
		@model.roomController.on 'joinedRoom', (role) =>
			if role != 'peer'
				@model.roomController.startLocalVideo(@callView.getVideoEl())

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