putBlob = (url, blob, progressFn=$.noop) ->
	# xhr = new XMLHttpRequest

	# xhr.addEventListener 'progress', ((prog) ->
	# 	value = (prog.loaded / prog.total)
	# 	progressFn(value)
	# ), false
	# xhr.addEventListener 'error', ((e)-> cb(e, null))
	# xhr.addEventListener 'load', ((e)-> cb(null, e))
	
	# xhr.open "PUT", url, true
	# xhr.send blob

	$.ajax
		type: 'PUT'
		url: url
		data: blob
		processData: false
		contentType: false
		cache: false
		xhr: ->
			x = $.ajaxSettings.xhr()
			if x.upload and progressFn
				x.upload.addEventListener 'progress', ((prog) ->
					value = (prog.loaded / prog.total)
					progressFn(value)
				), false
			return x
		complete: (res) -> console.log arguments

$.postJSON = (url, data, success) -> 
	$.ajax
	    type: 'POST',
	    url: url,
	    data: JSON.stringify data
	    success: success
	    contentType: "application/json",
	    dataType: 'json'

class S3UploadSession
	constructor: (@uploader, opts) ->
		@recId = opts.recId
		@awsUploadId = opts.awsUploadId
		@partSizes = opts.partSizes
		@getNthBlob = opts.getNthBlob
		completedParts = opts.completedParts ? {}
		# data: received data from server
		# uploader: the parent uploader class
		# parts: a map of the form {partNo: size}
		@parts = _.mapObject @partSizes, (size, partNo) -> {size: size}
		_.extend @parts, completedParts

		@status = 'ready'

	uploadPart: (number, blob, cb, progressCb) ->
		console.log "Attempting to upload part #{number}..."
		# first sign the req.
		data = 
			awsUploadId: @awsUploadId
			partNumber: number
		req = $.postJSON(@uploader.config.signUploadUrl.replace(':recId', @recId), data)
		req.done (data) =>
			console.log "Part #{number} req signed."
			# do a put request to the URL.
			# cb = (err, data) ->
			# 	debugger	
			putReq = putBlob(data.url, blob, progressCb)
			putReq.done (data, status, xhr) => 
				console.log "#{number} uploaded."
				# add the resulting part, etag and size to our @parts hash.
				@parts[number] = 
					etag: xhr.getResponseHeader('ETag')
					size: blob.size
				cb(null, number)
			putReq.fail (xhr, status, error) -> cb(error, xhr)

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
		console.log 'Starting upload. Queue is:', @queue

		onBlobUpload = (err, num) =>
			if (err)
				# retry
				console.log "Error uploading blob ##{num}:", err
				console.log "Retrying..."
				@uploadPart(num, blob, onBlobUpload, progressCb)
				return

			console.log "Event received from #{num} - removing from inProgress."
			delete @inProgress[num]
			if @status == 'started'
				if @queue.length == 0
					if _.keys(@inProgress).length == 0
						@status = 'finished'
						@markAsComplete(cb)
				else
					num = @queue.shift()
					blob = @getNthBlob(num)

					console.log "Adding #{num} to inProgress."
					@inProgress[num] = 1
					@uploadPart(num, blob, onBlobUpload, progressCb)

		parallelUploads = Math.min(@uploader.config.numConnections, @queue.length)
		for i in [1..parallelUploads]
			num = @queue.shift()
			blob = @getNthBlob(num)

			console.log "Adding #{num} to inProgress."
			@inProgress[num] = 1
			@uploadPart(num, blob, onBlobUpload, progressCb)

class S3Uploader
	constructor: (config) ->
		defaults = 
			startUploadUrl: window.location.href + '/uploads/'
			signUploadUrl: window.location.href + '/uploads/:recId/sign/'
			uploadStatusUrl: window.location.href + '/uploads/:recId/status/'
			completeUrl: window.location.href + '/uploads/:recId/complete/'
			numConnections: 1
		@config = _.extend {}, defaults, config

	startUploadSession: (recId, partSizes, getNthBlob, cb) ->
		req = $.postJSON(@config.startUploadUrl, {id: recId})
		req.done (data) => 
			session = new S3UploadSession @, 
				recId: recId
				awsUploadId: data.awsUploadId
				partSizes: partSizes
				getNthBlob: getNthBlob
			cb(null, session)
		req.fail (xhr, status, error) ->
			cb(error)
		#TODO: if it already exists, check its status.

	continueUploadSession: (recId, awsUploadId, partSizes, getNthBlob, cb) ->
		req = $.get @config.uploadStatusUrl.replace(':recId', recId), awsUploadId: uploadId
		req.done (data) =>
			session = new S3UploadSession @, 
				recId: recId
				awsUploadId: data.awsUploadId
				partSizes: partSizes
				getNthBlob: getNthBlob
				completedParts: data.parts
			cb(null, session)
		req.fail (xhr, status, error) ->
			cb(error)

module.exports = S3Uploader







s3 = new S3Uploader

