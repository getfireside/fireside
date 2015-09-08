LoggingController = require './logger.coffee'
moment = require 'moment'
EtaTracker = require('./utils.coffee').EtaTracker

putBlob = (url, blob, progressFn=$.noop, cb) ->
	blob = new Blob([blob])
	xhr = new XMLHttpRequest
	xhr.open "PUT", url, true
	lastProg = [moment(), 0] 
	tracker = new EtaTracker(0, blob.size)
	
	onprogress = (prog) ->
		tracker.update(prog.loaded, prog.total)
		progressFn 
			loaded: prog.loaded
			total: prog.total
			speed: tracker.currentSpeed
			avSpeed: tracker.averageSpeed
			percent: (prog.loaded / prog.total)
		return true
	xhr.upload.onprogress = onprogress

	xhr.addEventListener 'error', ((e)-> cb(e, null))
	xhr.addEventListener 'load', ((e)-> 
		if e.target.status != 200
			cb(e)
		else
			cb(null, e)
	)
	
	xhr.send blob

$.postJSON = (url, data, success, error) -> 
	$.ajax
		async: true
		processData: false
		type: 'POST'
		url: url
		data: JSON.stringify data
		success: success
		error: error
		contentType: "application/json"
		dataType: 'json'

class S3UploadSession
	constructor: (@uploader, opts) ->
		@recId = opts.recId
		@awsUploadId = opts.awsUploadId
		@blob = opts.blob
		@logger = opts.logger ? (new LoggingController).l('s3')
		@progressCb = opts.progressCb ? $.noop

		@parts = {}
		numParts = Math.ceil(@blob.size / @uploader.config.partSize)
		for n in [1..numParts]
			if n == numParts
				@parts[n] = {size: @blob.size % @uploader.config.partSize}
			else
				@parts[n] = {size: @uploader.config.partSize}

		@etaTracker = new EtaTracker(0, opts.blob.size)

		completedParts = _.mapObject opts.completedParts ? {}, (data, partNo) -> _.extend {}, data, 
			progress: 
				loaded: 0
				total: data.size
				speed: 0
				avSpeed: 0
				eta: null
		# sum up all the completed bytes...
		_.extend @parts, completedParts

		@status = 'ready'

	getNthBlob: (n) -> @blob.slice (n-1) * @uploader.config.partSize, Math.min(n*@uploader.config.partSize, @blob.size), @blob.type

	getUploadProgress: ->
		# slightly silly and inefficient, fix later
		loaded = 0
		speed = 0
		avSpeed = 0 
		for partNo, info of @parts
			loaded += info.progress?.loaded ? 0
			speed += info.progress?.speed ? 0
			avSpeed += info.progress?.avSpeed ? 0

		eta = @etaTracker.update(loaded)

		return {
			loaded: loaded
			total: @blob.size
			eta: eta
			speed: speed
			avSpeed: @etaTracker.averageSpeed
		}

	uploadPart: (number, blob, cb, progressCb) ->
		@logger.log "Attempting to upload part #{number}..."
		# first sign the req.
		size = blob.size
		data = 
			awsUploadId: @awsUploadId
			partNumber: number

		onProgress = (prog) =>
			@parts[number].progress = prog
			progressCb(@getUploadProgress())

		req = $.postJSON(@uploader.config.signUploadUrl.replace(':recId', @recId), data)
		req.done (data) =>
			@logger.log "Part #{number} req signed."
			# do a put request to the URL.
			# cb = (err, data) ->
			# 	debugger	
			putReq = putBlob data.url, blob, onProgress, (err, evt) =>
				if err
					cb(err, number)
				else
					@logger.log "#{number} uploaded."
					# add the resulting part, etag and size to our @parts hash.
					@parts[number] = 
						etag: evt.target.getResponseHeader('ETag')
						size: size
						progress: 
							loaded: size
							total: size
							eta: null
							speed: 0
					cb(null, number)

		req.fail (xhr, status, error) ->
			cb(error, xhr)

	markAsComplete: (cb) ->
		data = 
			parts: _.mapObject @parts, (data, partNo) -> data.etag
			awsUploadId: @awsUploadId
		req = $.postJSON @uploader.config.completeUrl.replace(':recId', @recId), data
		req.done (data) -> cb(null, data.url)
		req.fail (xhr, status, error) ->
			cb(error, xhr)

	doUpload: (cb, progressCb) ->
		if @status != 'ready'
			return
		@status = 'started'
		@queue = []
		@inProgress = {}
		for num, info of @parts 
			if not info.etag 
				@queue.push num
		@logger.log ['Starting upload. Queue is:', @queue]

		onBlobUpload = (err, num) =>
			if (err)
				# retry
				@logger.log ["Error uploading blob ##{num}:", err]
				@logger.log "Retrying..."
				blob = @getNthBlob(num)
				@uploadPart(num, blob, onBlobUpload, progressCb)
				return

			@logger.log "Event received from #{num} - removing from inProgress."
			delete @inProgress[num]
			if @status == 'started'
				if @queue.length == 0
					if _.keys(@inProgress).length == 0
						@status = 'finished'
						@markAsComplete(cb)
				else
					num = @queue.shift()
					blob = @getNthBlob(num)

					@logger.log "Adding #{num} to inProgress."
					@inProgress[num] = 1
					@uploadPart(num, blob, onBlobUpload, progressCb)

		parallelUploads = Math.min(@uploader.config.numConnections, @queue.length)
		for i in [1..parallelUploads]
			num = @queue.shift()
			blob = @getNthBlob(num)

			@logger.log "Adding #{num} to inProgress."
			@inProgress[num] = 1
			@uploadPart(num, blob, onBlobUpload, progressCb)

class S3Uploader
	constructor: (config) ->
		defaults = 
			startUploadUrl: window.location.href + '/uploads/'
			signUploadUrl: window.location.href + '/uploads/:recId/sign/'
			uploadStatusUrl: window.location.href + '/uploads/:recId/status/'
			completeUrl: window.location.href + '/uploads/:recId/complete/'
			numConnections: 4
			partSize: 1024*1024*5 # 5MB
		@config = _.extend {}, defaults, config
		@config.logger ?= new LoggingController

	startUploadSession: (recId, blob, cb) ->
		req = $.postJSON(@config.startUploadUrl, {id: recId, type: blob.type})
		req.done (data) => 
			session = new S3UploadSession @, 
				recId: recId
				awsUploadId: data.awsUploadId
				blob: blob
				logger: @config.logger
			cb(null, session)
		req.fail (xhr, status, statusText) ->
			cb(new Error(statusText)) # TODO better error objects? this will just give the status text.
		#TODO: if it already exists, check its status.

	continueUploadSession: (recId, awsUploadId, blob, cb) ->
		req = $.get @config.uploadStatusUrl.replace(':recId', recId), awsUploadId: uploadId
		req.done (data) =>
			session = new S3UploadSession @, 
				recId: recId
				awsUploadId: data.awsUploadId
				blob: blob
				completedParts: data.parts
				logger: @config.logger
			cb(null, session)
		req.fail (xhr, status, error) ->
			cb(error)

module.exports = S3Uploader