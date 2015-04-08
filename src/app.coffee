RoomView = require('./views/room.coffee')
#LogView = require('./views/log').LogView
#UsersView = require('./views/users').UsersView
Room = require('./models/room.coffee')
S3Uploader = require('./s3uploader.coffee')

attachMediaStream = require('attachmediastream')

class App extends Marionette.Application
	initialize: ->
		@room = new Room $('body').attr('data-room-id')

		@rootView = new RoomView
			model: @room

		@rootView.render()

$(document).ready ->
	Handlebars.registerHelper 'formatTime', (m, s) -> m.format s
	Handlebars.registerHelper 'equals', (a, b) -> a == b
	Handlebars.registerHelper 'percent', (v) -> v * 100
	Handlebars.registerHelper 'nicePercentage', (v) -> ~~(v*100) + '%'
	window.yakk = new App()
