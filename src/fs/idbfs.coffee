{FSError, LookupError, DiskSpaceError, FSFile, FS} = require './fs.coffee'

translateError = (err) ->
    return switch err.name
        when 'QuotaExceededError'
            new DiskSpaceError().wrap(err)
        when 'NotFoundError'
            new LookupError().wrap(err)
        else
            new FSError().wrap(err)


class IDBFile extends FSFile
    constructor: (@path, @writer) ->

    append: (blob) ->
        return new Promise (fulfil, reject) =>
            req = @writer._getObjectStore().add
                filename: @path,
                blob: blob
            req.onsuccess = (e) ->
                result = e.target.result
                fulfil(result)
            req.onerror = (e) ->
                reject(translateError(e.target))

    write: (blob, pos) ->
        # IMPLEMENT ME PROPERLY!
        # for now, this only works for pos=0 and we assume that we're just replacing the header blob.
        # _OBVIOUSLY_ need to fix for other use-cases.
        return new Promise (fulfil, reject) =>
            if pos == 0
                index = @writer._getObjectStore(true).index('filename')
                @_getCursor false, (evt) ->
                    cur = evt.target.result
                    if cur
                        o = cur.value
                        if o.blob.size < blob.size
                            reject(new Error("Not implemented yet! must be smaller than existing blob..."))
                            return
                        o.blob = new Blob([blob, o.blob.slice(blob.size)], {type: blob.type})
                        cur.update(o)
                        fulfil()
                    else
                        reject(new FSError(("Cursor is false.")))

            else
                reject(new FSError("Not implemented yet!"))

    remove: ->
        return new Promise (fulfil, reject) =>
            @_getCursor false, (e) =>
                cur = e.target.result
                if cur 
                    cur.delete()
                    cur.continue()
                else
                    @writer.logger.info('Deleted recording!')
                    fulfil()
            , reject

    readEach: (f, done, onerror) ->
        @_getCursor true, (e) ->
            cur = e.target.result
            if cur
                f(cur.value.blob)
                cur.continue()
            else
                done()
        , onerror

    read: ->
        blobs = []
        return new Promise (fulfil, reject) =>
            @readEach(
                (b) -> blobs.push(b), 
                -> fulfil(new Blob(blobs, {type: blobs[0].type})),
                reject
            )

    _getCursor: (ro=false, onsuccess, onerr) ->
        console.log 'Getting cursor', ro
        return new Promise (fulfil, reject) =>
            index = @writer._getObjectStore(ro).index("filename")
            curReq = index.openCursor(IDBKeyRange.only(@path))
            curReq.onsuccess = onsuccess
            curReq.onerror = (e) -> onerr(translateError(e.target))


class IDBFS extends FS
    constructor: (opts) ->
        @dbname = opts.dbname
        @logger = opts.logger
    open: ->
        return new Promise (fulfil, reject) =>
            if @db
                fulfil(@)

            openRequest = indexedDB.open(@dbname, 1)

            openRequest.onupgradeneeded = (event) ->
                db = event.target.result

                if db.objectStoreNames.contains "chunks"
                    db.deleteObjectStore "chunks"

                sto = db.createObjectStore "chunks",
                    autoIncrement: 1
                    keyPath: "id"

                sto.createIndex "filename", "filename", {unique: false}

            openRequest.onsuccess = (event) =>
                @db = event.target.result
                fulfil(@)

            openRequest.onerror = (evt) -> reject(translateError(e.target))

    _getObjectStore: (ro=false) -> 
        transaction = @db.transaction ["chunks"], (if ro then "readonly" else "readwrite")
        return transaction.objectStore "chunks"

    getFile: (path, opts) -> 
        return new Promise (fulfil, reject) => 
            fulfil(new IDBFile(path, @))
            return

module.exports = IDBFS
