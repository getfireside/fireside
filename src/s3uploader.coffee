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
					value = ~~((prog.loaded / prog.total) * 100)
					progressFn(prog,value)
				), false
			return x
		complete: (res) -> console.log arguments

class S3UploadSession
	constructor: (@data, @uploader, @partSizes) ->
		# data: received data from server
		# uploader: the parent uploader class
		# parts: a map of the form {partNo: size}
		parts = _.mapObject @partSizes, (size, partNo) -> {size: size}

	uploadPart: (number, blob) ->
		# do a put request...
		# add the resulting part, etag and size to our @parts hash.
		# if everything is done, send a complete request.






class S3Uploader
	constructor: (config) ->
		defaults = 
			startUploadUrl: '/uploads/'
		@config = _.extend {}, defaults, config

	startUpload: (recId, cb) ->
		req = $.post(@config.startUploadUrl)
		req.done (data) => 
			cb(null, new S3UploadSession(data, @))
		req.fail (xhr, status, error) ->
			cb(error)
		#TODO: if it already exists, check its status.






s3 = new S3Uploader

