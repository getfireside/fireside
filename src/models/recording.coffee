IDBWriter = require '../writers/idbwriter.coffee' 

class Recording extends Backbone.Model
	getBlob: (cb) ->
		writer = new IDBWriter 'filesys'
		writer.open().then =>
			f = writer.getFile @id
			f.read().then (blob) =>
				cb(blob)

	getBlobUrl: (cb) ->
		@getBlob (blob) ->
			cb(URL.createObjectURL blob)
	
module.exports = Recording
