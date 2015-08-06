RoomView = require('./views/room.coffee')
#LogView = require('./views/log').LogView
#UsersView = require('./views/users').UsersView
Room = require('./models/room.coffee')
S3Uploader = require('./s3uploader.coffee')
getFS = require './fs/getfs.coffee'
attachMediaStream = require('attachmediastream')
logger = require('./logger.coffee')

class App extends Marionette.Application
	initialize: ->
		@logger = new logger.LoggingController
			appenders:
				[
					new logger.MemListAppender,
					new logger.ConsoleAppender,
					new logger.HttpAppender window.location.href + '/debuglogs'
				]
		@s3 = new S3Uploader
			logger: @logger.l('s3uploader')
		@fs = new getFS
			logger: @logger.l 'recordingcontroller:fs'
		@room = new Room $('body').attr('data-room-id'), @

		@rootView = new RoomView
			model: @room

		@rootView.render()

		$(window).on 'error', (e) =>
			@logger.l('app').error(e.originalEvent.error)

$(document).ready ->
	filesize = require 'filesize'
	Handlebars.registerHelper 'formatBytes', (b) -> filesize(b or 0)
	Handlebars.registerHelper 'formatRate', (b) -> filesize(b or 0) + '/s'
	Handlebars.registerHelper 'formatTime', (m, s) -> m.format s
	Handlebars.registerHelper 'timeUntil', (m) -> m and m.fromNow()
	Handlebars.registerHelper 'equals', (a, b) -> a == b
	Handlebars.registerHelper 'percent', (v) -> v * 100
	Handlebars.registerHelper 'nicePercentage', (v) -> ~~(v*100) + '%'
	Handlebars.registerHelper 'replace', (r1, r2, s) -> s.replace(r1, r2)
	window.fireside = new App()
