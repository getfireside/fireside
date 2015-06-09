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
    constructor: (@dbname) ->
    open: ->
        return new Promise (fulfil, reject) =>
            @filer = new Filer()
            opts = 
                persistent: true
                size: 650*1024*1024
            @filer.init opts, fulfil, reject

    getFile: (path, opts) -> 
        return new Promise (fulfil, reject) =>
            @filer.mkdir path.split('/').slice(0, -1).join('/'), false, (=> fulfil(new HTML5FSFile(path, @))), reject

module.exports = HTML5FS
