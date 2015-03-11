class File
    constructor: (@path, @writer) ->

    writeBlob: (blob) ->

    readEach: (f, done, onerror) ->

    read: ->


class Writer
    getFile: (path, opts) -> return File(path, @)

exports = {File, Writer}