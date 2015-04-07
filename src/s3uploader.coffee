putBlob = (url, blob, progressFn=$.noop) ->
	$.ajax
		type: 'PUT'
		url: url
		data: blob
		processData: false
		contentType: false
		cache: false
		xhr: ->
			x = $.ajaxSettings.xhr();
			if x.upload and progressFn
				x.upload.addEventListener 'progress', ((prog) ->
					value = (prog.loaded / prog.total)
					progressFn(prog, value)
				), false
			return x
		complete: (res) -> console.log arguments

class S3UploadSession
	constructor: (@uploader, @awsUploadId, @partSizes, @getNthBlob, completedParts={}) ->
		# data: received data from server
		# uploader: the parent uploader class
		# parts: a map of the form {partNo: size}
		parts = _.mapObject @partSizes, (size, partNo) -> {size: size}
		_.extend parts, completedParts

		status = 'ready'

	uploadPart: (number, blob, cb, progressCb) ->
		# first sign the req.
		data = JSON.stringify
			awsUploadId: @awsUploadId,
			partNumber: number
		req = $.post(@config.signUploadUrl.replace(':recID', @recID), data)
		req.done (data) ->
			# do a put request to the URL.
			putReq = putBlob(data.url, blob, progressCb)
			putReq.done (data, status, xhr) -> 
				# add the resulting part, etag and size to our @parts hash.
				@parts[number] = 
					etag: data.getResponseHeader('ETag')
					size: size
				cb(null)
			putReq.fail (xhr, status, error) -> cb(error, xhr)

		req.fail (xhr, status, error) ->
			cb(error, xhr)

	markAsComplete: (cb) ->
		data = JSON.stringify
			parts: _.mapObject @parts, (data, partNo) -> data.etag
			awsUploadId: @awsUploadId
		req = $.post @config.completeUrl.replace(':recID', @recID), data
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

		onBlobUpload = (err, num, data) =>
			if (err)
				# retry
				console.log "Error uploading blob ##{num}:", err
				console.log "Retrying..."
				@uploadPart(num, blob, ((err, data) => onBlobUpload(err, num, data)), progressCb)
				return

			delete inProgress[num]
			if @status != 'started'
				if queue.length == 0
					if _.keys(inProgress).length == 0
						@status = 'finished'
						@markAsComplete(cb)
				else
					num = queue.shift()
					blob = @getNthBlob(num)
					@inProgress[num] = 1
					@uploadPart(num, blob, ((err, data) => onBlobUpload(err, num, data)), progressCb)


		for i in [1, Math.min(uploader.config.numConnections, @queue.length)]
			num = queue.shift()
			blob = @getNthBlob(num)

			@inProgress[num] = 1
			@uploadPart(num, blob, ((err, data) => onBlobUpload(err, num, data)), progressCb)

class S3Uploader
	constructor: (config) ->
		defaults = 
			startUploadUrl: 'uploads/'
			signUploadUrl: 'uploads/:recID/sign/'
			uploadStatusUrl: 'uploads/:recID/status/'
			completeUrl: 'uploads/:recID/complete/'
			numConnections: 1
		@config = _.extend {}, defaults, config

	startUpload: (recId, partSizes, getNthBlob, cb) ->
		req = $.post(@config.startUploadUrl)
		req.done (data) => 
			cb(null, new S3UploadSession(@, data.awsUploadId, partSizes, getNthBlob))
		req.fail (xhr, status, error) ->
			cb(error)
		#TODO: if it already exists, check its status.

	continueUpload: (recId, awsUploadId, partSizes, getNthBlob, cb) ->
		req = $.get @config.uploadStatusUrl.replace(':recID', recId), awsUploadId: uploadId
		req.done (data) =>
			cb(null, new S3UploadSession(@, awsUploadId, partSizes, getNthBlob, data.parts))
		req.fail (xhr, status, error) ->
			cb(error)

module.exports = S3Uploader







s3 = new S3Uploader

