module.exports = ->
	if window.webkitRequestFileSystem?
		return new (require '../fs/html5fs.coffee')
	else
		return new (require '../fs/idbfs.coffee')('fireside-filesys')