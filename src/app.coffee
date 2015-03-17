RoomView = require('./views/room.coffee')
#LogView = require('./views/log').LogView
#UsersView = require('./views/users').UsersView
Room = require('./models/room.coffee')

attachMediaStream = require('attachmediastream');

class App extends Marionette.Application
	initialize: ->
		@room = new Room 'MJ123kADIQo123P'

		@rootView = new RoomView
			model: @room

		@rootView.render()

$(document).ready ->
	Handlebars.registerHelper 'formatTime', (m, s) -> m.format s
	Handlebars.registerHelper 'equals', (a, b) -> a == b
	window.yakk = new App()