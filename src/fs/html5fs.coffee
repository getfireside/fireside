class HTML5FSFile
    constructor: (@path, @fs) ->

    append: (blob) ->
        return new Promise (fulfil, reject) =>
            opts = 
                data: blob
                type: blob.type
                append: true,
            @fs.filer.write @path, opts, fulfil, reject

    write: (blob, pos) ->
        return new Promise (fulfil, reject) =>
            opts = 
                data: blob
                type: blob.type
                pos: pos
            @fs.filer.write @path, opts, fulfil, reject

    readEach: (f, done, onerror) ->
        @fs.filer.open @path, (file) ->
            f(file)
            done()

    read: ->
        blobs = []
        return new Promise (fulfil, reject) =>
            @readEach(
                (b) -> blobs.push(b), 
                -> fulfil(new Blob(blobs, {type: blobs[0].type})),
                reject
            )


class HTML5FS
    constructor: (opts) ->
        @logger = opts.logger
    open: ->
        return new Promise (fulfil, reject) =>
            if not @filer 
                @filer = new Filer()
                opts = 
                    persistent: true
                    size: 650*1024*1024
                @filer.init opts, fulfil, reject
            else
                fulfil()

    getFile: (path, opts) -> 
        return new Promise (fulfil, reject) =>
            @filer.mkdir path.split('/').slice(0, -1).join('/'), false, (=> fulfil(new HTML5FSFile(path, @))), reject

    getSpaceInfo: ->
        return new Promise (fulfil, reject) =>
            f = (used, free, total) ->
                fulfil({used: used, free: free, total:total})
            @filer.df(f, reject)

module.exports = HTML5FS
