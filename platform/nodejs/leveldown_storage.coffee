# try
leveldown = require('leveldown')
# catch
#   return


{writeUInt64BE, readUInt64BE} = require('int53')
{encode, decode} = require('./msgpack')
{DbError} = require('../../src/errors')
{ObjectRef, JobQueue} = require('../../src/util')


class LevelDBStorage
  constructor: (options) ->
    @db = leveldown(options.path)
    @options = options.leveldown or {}
    @ready = false
    @uid = 1
    @metadataCache = {}
    @objectCache = {}
    @pending = []
    @flushThreshold = options.flushThreshold or 10000
    @queue = new JobQueue()


  get: (key, cb) ->
    encodeCb = (err, encoded) =>
      k = Buffer.concat([new Buffer([0]), encoded])
      @getItem(@metadataCache, key, k, cb)

    encode(key, null, encodeCb)


  set: (key, obj, cb) ->
    encodeCb = (err, encoded) =>
      k = Buffer.concat([new Buffer([0]), encoded])
      @setItem(@metadataCache, key, k, obj, cb)

    encode(key, null, encodeCb)


  saveObject: (val, cb) ->
    setCb = (err) =>
      if err then return cb(err)
      cb(null, ref)

    ref = new ObjectRef(@uid++)
    key = new Buffer(9)
    key[0] = 1
    writeUInt64BE(ref.valueOf(), key, 1)
    @setItem(@objectCache, ref.valueOf(), key, val, setCb)


  getObject: (ref, cb) ->
    key = new Buffer(9)
    key[0] = 1
    writeUInt64BE(ref.valueOf(), key, 1)
    @getItem(@objectCache, ref.valueOf(), key, cb)


  saveIndexNode: @::saveObject


  getIndexNode: @::getObject


  saveIndexData: @::saveObject


  getIndexData: @::getObject


  flush: (cb) ->
    flushCb = null

    flushJob = (jobCb) =>
      if not @pending.length then return jobCb(null)
      flushCb = jobCb
      @db.batch(@pending, sync: true, batchCb)

    batchCb = (err) =>
      if err then return flushCb(err)
      @pending = []
      @metadataCache = {}
      @objectCache = {}
      flushCb(null)

    @queue.add(cb, flushJob)


  open: (cb) ->
    iterator = null

    openCb = (err) =>
      if err then return cb(err)
      # fetch the biggest uid in the database
      opts = reverse: true, end: new Buffer([1]), limit: 1
      iterator = @db.iterator(opts)
      iterator.next(iterateCb)

    iterateCb = (err, key, value) =>
      if err
        iterator.end(-> )
        return cb(err)
      @ready = true
      if not arguments.length
        return iterator.end(cb)
      @uid = readUInt64BE(key, 1)
      iterator.end(cb)

    if @ready
      throw new DbError('already open')

    @queue.add(openCb, (openCb) => @db.open(@options, openCb))


  close: (cb) ->
    flushCb = (err) =>
      @db.close(cb)

    if not @ready
      throw new DbError('already closed')

    @ready = false
    @flush(flushCb)


  getItem: (cache, cacheKey, key, cb) ->
    getCb = (err, buffer) =>
      if err
        if /notfound/i.test(err.message)
          return cb()
        return cb(err)
      decode(buffer, null, decodeCb)

    decodeCb = (err, decoded) =>
      if err then return cb(err)
      cb(null, decoded)

    if not @ready
      throw new DbError('storage closed')

    if hasProp(cache, cacheKey)
      return decode(cache[cacheKey].value, null, decodeCb)

    @queue.add(getCb, (getCb) => @db.get(key, asBuffer: true, getCb))


  setItem: (cache, cacheKey, key, val, cb) ->
    encodeCb = (err, encoded) =>
      if err then return cb(err)
      cache[cacheKey] = index: @pending.length, value: encoded
      @pending.push(type: 'put', key: key, value: encoded)
      if @pending.length == @flushThreshold
        return @flush(cb)
      cb(null)

    if not @ready
      throw new DbError('storage closed')

    if hasProp(cache, cacheKey)
      # update unflushed data, remove it from the pending operations
      @pending.splice(cache[cacheKey].index, 1)

    encode(val, null, encodeCb)


registerStorage('leveldb', LevelDBStorage)
