class FSError
    constructor: (message) ->
        if not @userMessage
            @userMessage = @message
        @name = @constructor.name
        @message = message
        @stack = (new Error).stack

    @wrap: (err) ->
        e = new @ err.message, err.stack
        e.wrapped = err
        return e

    @:: = new Error
    @::constructor = @

class DiskSpaceError extends FSError
    userMessage: "No disk space left"

class LookupError extends FSError
    userMessage: "Missing file"

class FSFile
    constructor: (@path, @fs) ->

    append: (blob) ->

    write: (blob, pos) ->

    readEach: (f, done, onerr) ->

    read: ->


class FS 
    constructor: (opts) ->

    getFile: (path, opts) ->

module.exports = {FS, FSFile, FSError, DiskSpaceError, LookupError}