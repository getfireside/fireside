RoomView = require('./views/room.coffee')
#LogView = require('./views/log').LogView
#UsersView = require('./views/users').UsersView
Room = require('./models/room.coffee')

attachMediaStream = require('attachmediastream');

class App extends Thorax.LayoutView
	initialize: ->
		@room = new Room 'MJ123kADIQo123P'

		@roomView = new RoomView
			model: @room
		@setView @roomView
		@appendTo 'body'

$(document).ready ->
	Handlebars.registerHelper 'formatTime', (m, s) -> m.format s
	Handlebars.registerHelper 'equals', (a, b) -> a == b
	window.yakk = new App()