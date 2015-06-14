RoomView = require('./views/room.coffee')
#LogView = require('./views/log').LogView
#UsersView = require('./views/users').UsersView
Room = require('./models/room.coffee')
S3Uploader = require('./s3uploader.coffee')
getFS = require './fs/getfs.coffee'
attachMediaStream = require('attachmediastream')
LoggingController = require('./logger.coffee')

class App extends Marionette.Application
	initialize: ->
		@logger = new LoggingController
		@s3 = new S3Uploader
			logger: @logger.l('s3uploader')
		@fs = new getFS
			logger: @logger.l 'recordingcontroller:fs'
		@room = new Room $('body').attr('data-room-id'), @

		@rootView = new RoomView
			model: @room

		@rootView.render()

		$(window).on 'error', (e) =>
			@logger.l('app').error(e)

$(document).ready ->
	Handlebars.registerHelper 'formatTime', (m, s) -> m.format s
	Handlebars.registerHelper 'equals', (a, b) -> a == b
	Handlebars.registerHelper 'percent', (v) -> v * 100
	Handlebars.registerHelper 'nicePercentage', (v) -> ~~(v*100) + '%'
	Handlebars.registerHelper 'replace', (r1, r2, s) -> s.replace(r1, r2)
	window.yakk = new App()
