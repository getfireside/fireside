{FSError, LookupError, DiskSpaceError, FSFile, FS} = require './fs.coffee'

translateError = (err) ->
    return switch err.name
        when 'QUOTA_EXCEEDED_ERR'
            DiskSpaceError.wrap(err)
        when 'NOT_FOUND_ERR'
            LookupError.wrap(err)
        else
            FSError.wrap(err)

requestFileSystem = window.requestFileSystem or window.webkitRequestFileSystem

class HTML5FSFile extends FSFile
    constructor: (@path, @fs) ->

    append: (blob) ->
        return new Promise (fulfil, reject) =>
            opts = 
                append: true

            @fs.write @path, blob, opts
                .then fulfil
                .catch reject

    write: (blob, pos) ->
        return new Promise (fulfil, reject) =>
            opts = 
                pos: pos
            @fs.write @path, blob, opts
                .then fulfil
                .catch reject


    readEach: (f, done, onerror) ->
        @fs.openFile(@path)
            .then (file) ->
                f(file)
                done()
            .catch onerror

    read: ->
        blobs = []
        return new Promise (fulfil, reject) =>
            @readEach(
                (b) -> blobs.push(b), 
                -> fulfil(new Blob(blobs, {type: blobs[0].type})),
                reject
            )


class HTML5FS extends FS
    constructor: (opts) ->
        @logger = opts.logger

    open: ->
        return new Promise (fulfil, reject) =>
            init = (fs) => 
                @fs = fs
                fulfil(@)

            handleErr = (e) -> reject(translateError(e))

            if not @fs
                size = 5*1024*1024
                navigator.persistentStorage.requestQuota size, (grantedBytes) ->
                    requestFileSystem PERSISTENT, grantedBytes, init, handleErr
                , handleErr
            else
                fulfil(@)

    ensurePath: (path) ->
        # ensures that the filepath has directories that can be written to
        return @createDirs(path.split('/')[..-2])

    createDirs: (folders, parent=@fs.root, handleErr) ->
        return new Promise (fulfil, reject) =>
            if folders[0] == '.' or folders[0] == ''
                folders = folders.slice(1)
            parent.getDirectory folders[0], {create:true}, (entry) =>
                if folders.length
                    @createDirs(folders[1..], entry).then(fulfil).catch(reject)
                else
                    fulfil()
            , (err) ->
                reject(translateError(err))

    write: (path, blob, opts={}) ->
        return new Promise (fulfil, reject) =>
            handleErr = (err) -> reject(translateError(if err instanceof ProgressEvent then err.currentTarget.error else err))
            _write = (entry) ->
                entry.createWriter (writer) ->
                    writer.onerror = handleErr
                    if opts.append
                        writer.seek(writer.length)
                    truncated = false
                    writer.onwriteend = (e) ->
                        if !truncated and not opts.append and not opts.pos?
                            truncated = true
                            @truncate(@position)
                        fulfil(entry, @)

                    writer.write(blob)
                , handleErr

            @fs.root.getFile path, {create:true, exclusive:false}, _write, handleErr

    openFile: (path) ->
        return new Promise (fulfil, reject) =>
            handleErr = (err) -> reject(translateError(err))
            @fs.root.getFile path, null, (entry) ->
                entry.file ((f) -> fulfil(f)), handleErr
            , handleErr

    getFile: (path, opts) -> 
        return new Promise (fulfil, reject) =>
            res = @ensurePath(path)
            res.then => fulfil(new HTML5FSFile(path, @))
            res.catch reject

    getSpaceInfo: ->
        return new Promise (fulfil, reject) =>
            f = (used, total) ->
                free = total - used
                fulfil({used: used, free: free, total:total})
            navigator.persistentStorage.queryUsageAndQuota f, reject

module.exports = HTML5FS
