IDBWriter = require '../writers/idbwriter.coffee' 
S3Uploader = require '../s3uploader.coffee'
s3 = new S3Uploader

class Recording extends Backbone.Model
	getBlob: (cb) ->
		writer = new IDBWriter 'filesys'
		writer.open().then =>
			f = writer.getFile @id
			f.read().then (blob) =>
				cb(null, blob)

	getBlobUrl: (cb) ->
		@getBlob (err, blob) ->
			cb(err, URL.createObjectURL blob)

	upload: (cb, progressCb) ->
		if @uploadSession != undefined
			return

		@getBlob (err, blob) =>
			# get rid of the type - firefox CORS workaround.
			blob = blob.slice(0, blob.size)
			
			@uploadSession = null

			handler = (err, session) =>
				if err
					return cb(err, null)
				else
					@set 'uploadId', session.awsUploadId
					@save()
					@uploadSession = session
					@uploadSession.doUpload cb, progressCb

			if @get('uploadId')?
				s3.continueUploadSession @id, @get('uploadId'), blob, handler
			else
				s3.startUploadSession @id, blob, handler


	
module.exports = Recording
