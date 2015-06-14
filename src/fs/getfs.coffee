module.exports = (opts) ->
	if window.webkitRequestFileSystem?
		return new (require '../fs/html5fs.coffee')(opts)
	else
		opts.dbname = 'fireside-filesys'
		return new (require '../fs/idbfs.coffee')(opts)