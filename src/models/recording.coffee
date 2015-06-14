mimesMap =
	'audio/wav': 'wav'
	'video/webm': 'webm'
	'audio/ogg': 'ogg'

class Recording extends Backbone.Model
	initialize: (attrs, opts) ->
		@app = opts.app
	getBlob: (cb) ->
		yakk.fs.getFile(@getFilename()).then (f) ->
			p = f.read()
			p.then (blob) -> cb(null, blob)
			p.catch (err) -> cb(err)

	getBlobUrl: (cb) ->
		@getBlob (err, blob) ->
			cb(err, URL.createObjectURL blob)

	duration: -> (new Date(@get('stopped')) - new Date(@get('started'))) / 1000

	appendBlob: (blob, cb) ->
		yakk.fs.getFile(@getFilename()).then (f) =>
			p = f.append(blob)
			p.then (e) => 
				@set 'filesize', (@get('filesize') or 0) + blob.size
				@save() 
				cb(null, e)
			p.catch (e) =>
				cb(e)

	overwriteHeader: (blob, cb) ->
		yakk.fs.getFile(@getFilename()).then (f) ->
			p = f.write(blob, 0)
			p.then -> cb(null)
			p.catch (e) -> 
				console.error e
				cb(e)

	getFileExt: -> mimesMap[@get 'type']

	getFilename: -> "fireside/rooms/#{@get "roomId"}/#{@id}.#{@getFileExt()}"

	getNiceFilename: -> "Recording of #{@get username} on #{@get started}"

	upload: (cb=$.noop, progressCb=$.noop) ->
		if @uploadSession != undefined
			return

		@getBlob (err, blob) =>
			@uploadSession = null

			handler = (err, session) =>
				@trigger 'uploadStarted', @

				onProgress = (v) =>
					@trigger 'uploadProgress', @, v
					progressCb(v)

				onComplete = (err, url) =>
					if not err
						@trigger 'uploadComplete', @, url
					cb(err, url)

				if err
					return cb(err, null)
				else
					@set 'uploadId', session.awsUploadId
					@save()
					@uploadSession = session
					@uploadSession.doUpload onComplete, onProgress

			if @get('uploadId')?
				@collection.s3.continueUploadSession @id, @get('uploadId'), blob, handler
			else
				@collection.s3.startUploadSession @id, blob, handler
	
module.exports = Recording
