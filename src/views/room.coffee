CallView = require('./call.coffee')
LogView = require('./log.coffee')
UsersView = require('./users.coffee')
cookies = require('cookies-js')

class RoomView extends Thorax.View 
	template: Handlebars.templates['room']
	constructor: (data) ->
		super data
		@call = new CallView(@)
		@log = new LogView(@)
		@users = new UsersView(@)
		@on 'rendered', =>
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

		@model.roomController.on 'videoAdded', @call.handleRemoteVideoStart
		@model.roomController.on 'videoRemoved', @call.handleRemoteVideoEnd
		@model.roomController.on 'joinedRoom', (role) =>
			if role != 'peer'
				@model.roomController.startLocalVideo(@call.getVideoEl())
	getUserCollection: -> @model.getUserCollection()
	getLogCollection: -> @model.getLogCollection()
	sendMsg: (msg) ->
		@model.sendMsg msg



module.exports = RoomView