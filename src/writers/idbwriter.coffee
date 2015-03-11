class IDBFile
    constructor: (@path, @writer) ->

    writeBlob: (blob) ->
        return new Promise (fulfil, reject) =>
            req = @writer._getObjectStore().add
                filename: @path,
                blob: blob
            req.onsuccess = (e) ->
                console.log('successfully added blob to db')
                result = e.target.result
                fulfil(result)
            req.onerror = (e) ->
                console.log 'error adding', e 
                reject(e)

    readEach: (f, done, onerror) ->
        index = @writer._getObjectStore(true).index("filename")
        cur = index.openCursor(IDBKeyRange.only(@path))
        cur.onsuccess = (event) ->
            cur = event.target.result
            if cur
                f(cur.value.blob)
                cur.continue()
            else
                done()
        cur.onerror = onerror

    read: ->
        blobs = []
        return new Promise (fulfil, reject) =>
            @readEach(
                (b) -> blobs.push(b), 
                -> fulfil(blobs),
                reject
            )


class IDBWriter
    constructor: (@dbname) ->
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

            openRequest.onerror = reject

    _getObjectStore: (ro=false) -> 
        transaction = @db.transaction ["chunks"], (if ro then "readonly" else "readwrite")
        return transaction.objectStore "chunks"

    getFile: (path, opts) -> return new IDBFile(path, @)

module.exports = IDBWriter
