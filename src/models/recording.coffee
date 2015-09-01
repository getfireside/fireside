mimesMap =
	'audio/wav': 'wav'
	'video/webm': 'webm'
	'audio/ogg': 'ogg'

class Recording extends Backbone.Model
	initialize: (attrs, opts) ->
		@app = opts.app
	getBlob: (cb) ->
		fireside.fs.getFile(@getFilename()).then (f) ->
			p = f.read()
			p.then (blob) -> cb(null, blob)
			p.catch (err) -> cb(err)

	deleteBlob: (cb) ->
		fireside.fs.getFile(@getFilename()).then (f) ->
			p = f.remove()
			p.then -> cb(null)
			p.catch (err) -> cb(err)


	getBlobUrl: (cb) ->
		@getBlob (err, blob) ->
			cb(err, URL.createObjectURL blob)

	duration: =>
		s = @get 'stopped'
		return ((if s then new Date(s) else new Date()) - new Date(@get('started'))) / 1000

	appendBlob: (blob, cb) ->
		fireside.fs.getFile(@getFilename())
			.then (f) =>
				f.append(blob)
					.then (e) => 
						@set 'filesize', (@get('filesize') or 0) + blob.size
						@save() 
						cb(null, e)
					.catch (e) =>
						cb(e)
			.catch (e) ->
				throw e

	overwriteHeader: (blob, cb) ->
		fireside.fs.getFile(@getFilename()).then (f) ->
			p = f.write(blob, 0)
			p.then -> cb(null)
			p.catch (e) -> 
				console.error e
				cb(e)

	getFileExt: -> mimesMap[@get 'type']

	getFilename: -> "fireside/rooms/#{@get "roomId"}/#{@id}.#{@getFileExt()}"

	getNiceFilename: -> "Recording of #{@get username} on #{@get started}"

	upload: (cb=$.noop, progressCb=$.noop, deleteOnUpload=true) ->
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
					if deleteOnUpload
						@deleteBlob (err) =>
							if err
								console.error err
								throw err
							else
								console.log "DELETED LOCAL COPY!"

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
