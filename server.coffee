express = require 'express'
uuid = require 'node-uuid'
crypto = require 'crypto'
redis = require 'redis'
http = require 'http'
randomstring = require 'randomstring'
_ = require 'lodash'
async = require 'async'
session = require 'express-session'
RedisSessionStore = (require 'connect-redis')(session)
cookieParser = (require 'cookie-parser')()
cons = require 'consolidate'
AWS = require 'aws-sdk'
bodyParser = require 'body-parser'
require 'coffee-script/register'
config = require './config.coffee'


AWS.config.update
	accessKeyId: config.awsAccessKeyId
	secretAccessKey: config.awsSecretAccessKey
	region: config.awsRegion

s3UploadsBucket = new AWS.S3
	params: 
		Bucket: config.uploadsBucketName


class RoomController
	constructor: ->
		@client = redis.createClient()
		@prefix = '/yakk/rooms/'

	roomExists: (roomId, cb) => 
		console.log "checking if", @prefix + roomId, 'exists...'
		@client.exists @prefix + roomId, cb

	createRoom: (cb) =>
		key = randomstring.generate 9
		@client.set @prefix + key, 1, (err, res) ->
			cb(err, key, res)

	getClients: (roomId, cb) =>
		clients = {}
		for id of io.nsps['/'].adapter.rooms[roomId]
			otherClient = io.sockets.connected[id]
			clients[id] = 
				resources: otherClient.resources
				info: otherClient.info
				sid: otherClient.sid
				role: otherClient.role
				recordingStatus: otherClient.recordingStatus or null
		cb(null, clients)

	getHost: (roomId, cb) => @client.get @prefix + roomId + '/host', cb
	setHost: (roomId, clientId, cb) => @client.set @prefix + roomId + '/host', clientId, cb

	getInterviewees: (roomId, cb) => @client.smembers @prefix + roomId + '/interviewees', cb
	addInterviewee: (roomId, clientId, cb) => @client.sadd @prefix + roomId + '/interviewees', clientId, cb

	determineRole: (roomId, clientId, cb) =>
		console.log 'determining role for', clientId, 'in', roomId, '...'
		errorIfRoomNotExists = (cb) => async.waterfall [
			((cb) => @roomExists roomId, cb),
			((exists, cb) => 
				if not exists
					cb('Room does not exist.')
				else
					cb(null)
			)
		], cb

		checkIfHost = (cb) => async.waterfall [
			((cb) => errorIfRoomNotExists cb)
			((cb) => @getHost roomId, cb)
			((result, cb) => 
				console.log('host:', result)
				if result == null
					@setHost roomId, clientId, cb
				else
					cb(null, null)
			),
			((result, cb) => @getHost(roomId, cb)),
			((hostId, cb) => cb(null, hostId == clientId))
		], cb

		checkIfInterviewee = (cb) => async.waterfall [
			(cb) => errorIfRoomNotExists cb
			(cb) => @getInterviewees roomId, cb
			(interviewees, cb) =>
				if interviewees.length == 0
					@addInterviewee roomId, clientId, cb
				else
					cb(null, null)
			(result, cb) => @getInterviewees roomId, cb
			(interviewees, cb) => 
				cb(null, _.contains interviewees, clientId)
		], cb

		checkIfHost (err, isHost) ->
			if isHost
				cb(null, 'host')
				return
			checkIfInterviewee (err, isInterviewee) ->
				cb(null, if isInterviewee then 'interviewee' else 'peer')

	getRoomInfo: (roomId, cb) =>
		@roomExists roomId, (err, exists) =>
			console.log 'roomId...', roomId, err, exists
			if err
				cb(err)
			else
				if not exists
					cb('Room does not exist')
				else
					async.parallel [
						(cb) => @getHost roomId, cb
						(cb) => @getInterviewees roomId, cb
						(cb) => @getClients roomId, cb
					], (err, results) -> cb(null, {host: results[0], interviewees: results[1], clients: results[2]})



safeCb = (cb) -> if typeof cb == 'function' then cb else (() -> null)

roomController = new RoomController


app = express()
app.use cookieParser
sessionStore = session 
	store: new RedisSessionStore 
	resave: false
	secret: 'NASTY PRECIOUS SECRET'
	key: 'express.sid'
	cookie: 
		maxAge: 60*24*60*60*1000 # 60 days
app.use sessionStore

jsonParser = bodyParser.json()

app.use '/dist', express.static('dist')
app.use '/bower_components', express.static('bower_components')

# assign the swig engine to .html files 
app.engine('html', cons.handlebars)
 
# set .html as the default extension 
app.set('view engine', 'html')
app.set('views', __dirname + '/views')

app.get '/', (req, res) -> res.render('index') 

app.post '/rooms/new', (req, res) -> 
	roomController.createRoom (err, id) ->
		res.redirect('/rooms/' + id)

doIfRoomExists = (id, req, res, cbIfExists) ->
	roomController.roomExists id, (err, exists) ->
		if exists
			cbIfExists(null, id, req, res)
		else
			res.sendStatus 404

app.get '/rooms/:roomID', (req, res) -> 
	doIfRoomExists req.params.roomID, req, res, (err, id, req, res) ->
		res.render 'room', 
			roomID: id

doIfHasRole = (id, allowedRoles, req, res, next, cb) ->
	sid = req.session.id
	roomController.determineRole id, sid, (err, role) ->
		if err == 'Room does not exist'
			res.sendStatus 404
			return
		if not _.contains allowedRoles, role
			res.sendStatus 403
			return
		if err
			return next(err)
		return cb(id, role, req, res, next)




app.post '/rooms/:roomID/upload/start/', (req, res, next) ->
	id = req.params.roomID
	sid = req.session.id
	# ensure that the user is already in the room!
	doIfHasRole id, ['host', 'interviewee'], req, res, next, (id, role, req, res, next) ->
		key = ([id, sid, randomstring.generate 5].join '/') + '.webm'
		params = 
			Key: key
			ACL: 'public-read'
			ContentType: req.query['content-type'] ? 'video/webm'
		s3UploadsBucket.createMultipartUpload params, (err, data) ->
			res.json
				key: key
				uploadId: data.UploadId

app.post '/rooms/:roomID/upload/sign/', jsonParser, (req, res, next) ->
	# sign request with uploadId, key, contentLength set as required.
	if !req.body 
		return res.sendStatus(400)
	sid = req.session.id
	# we should probably validate the incoming JSON first.. let's just run with it for now.
	doIfHasRole req.params.roomID, ['host', 'interviewee'], req, res, next, (id, role, req, res, next) ->
		key = req.body.key
		if key.indexOf(id + '/' + sid) != 0
			return res.sendStatus 400
		params = 
			UploadId: req.body.uploadId
			Key: key
			PartNumber: req.body.partNumber
		s3UploadsBucket.getSignedUrl 'uploadPart', params, (err, url) ->
			if err
				return next(err)
			res.json
				url: url
			









		

			

server = http.Server(app)
io = require('socket.io')(server)

io.use (socket, next) ->
	req = socket.handshake
	res = {}
	cookieParser req, res, (err) ->
		if (err)
			return next(err)
		sessionStore(req, res, next)


io.sockets.on 'connection', (client) ->
	client.resources = 
		video: false
		audio: false

	client.sid = client.handshake.sessionID

	client.on 'event', (data) ->
		if client.room
			client.broadcast.to(client.room).emit 'event', 
				type: data.type
				data: data.data
				from: client.id

			# this probably shouldn't be here, bit hackish - refactor later...
			statusMap = 
				ready: 'ready'
				started: 'recording'
				stopped: 'ready'

			if data.type == 'recording'
				client.recordingStatus = statusMap[data.data.subtype]

	client.on 'signalling', (details) ->
		if !details 
			return
		otherClient = io.sockets.in(client.room).connected[details.to]
		if !otherClient
			return

		details.from = client.id

		otherClient.emit('signalling', details)

	generateIntervieweeCommand = (msg) ->
		(peerId) ->
			if client.room and client.role == 'host'
				details = 
					host: client.id
				peer = io.sockets.in(client.room).connected[peerId]
				if peer.role == 'interviewee'
					peer.emit msg, details



	client.on 'startRecordingRequest', generateIntervieweeCommand 'startRecordingRequest'
	client.on 'stopRecordingRequest', generateIntervieweeCommand 'stopRecordingRequest'

	client.on 'updateResources', (newResources) ->
		client.resources = newResources
		if client.room
			client.broadcast.to(client.room).emit 'updateResources',
				id: client.id
				newResources: newResources

	dc = ->
		console.log "leave", client.id
		if client.room
			client.broadcast.to(client.room).emit 'remove',
				id: client.id

		client.leave(client.room)
		client.room = undefined

	client.on 'disconnect', -> dc()

	client.on 'leave', -> dc()

	join = (data, cb) ->
		roomId = data?.room
		console.log "join", roomId
		if typeof roomId != 'string'
			return
		roomController.getRoomInfo roomId, (err, roomInfo) ->
			console.log 'got room info', roomInfo
			if err
				cb(err)
			else
				roomController.determineRole roomId, client.sid, (err, role) ->
					console.log err, role
					if err
						cb(err)
					roomInfo.role = role
					safeCb(cb)(null, roomInfo)
					console.log 'client', client.id, 'got info', roomInfo
					client.role = role
					client.join(roomId)
					client.room = roomId
					client.info = data?.info
					client.resources = data.resources
					client.broadcast.to(client.room).emit 'announce', 
						id: client.id
						sid: client.sid
						info: client.info
						resources: client.resources
						role: client.role


	client.on 'join', join

	client.on 'getPeerInfo', (id, cb) ->
		console.log "looking for info about", id
		console.log cb
		client = io.sockets.in(client.room).connected[id]
		cn = safeCb(cb)
		if not client?
			cb({})
		else
			cb(client.info)


	client.emit('stunservers', config.stunservers or [])
	client.emit('turnservers', config.turnservers or [])

app.use (err, req, res, next) ->
  console.error(err.stack)
  res.status(500).send('Something broke!')

server.listen(8001)