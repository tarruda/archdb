{writeUInt64BE, readUInt64BE} = require('int53')

{ObjectRef, Emitter, ObjectType, typeOf} = require('../../../src/util')
{ObjectRef} = require('../../../src/util')
{CursorError} = require('../../../src/errors')
{DomainBase, CursorBase} = require('../../../src/domain_base')
{HistoryEntryType} = require('../../../src/domain_base')
BitArray = require('../../../src/bit_array')
{encode, decode} = require('../msgpack')
{HISTORY_ID, INDEX_PREFIX, VALUE_PREFIX} = require('./constants')


MAX_REV_ID = 0xffffffffffffffff


keyToBuffer = (type, key) ->
  bytes = key.getBytes()
  bytes.unshift(type)
  return new Buffer(bytes)


bufferToKey = (buffer) ->
  rv = new BitArray()

  for i in [1...buffer.length]
    rv.write(buffer[i], 8)

  return rv


valuePrefix = new Buffer([VALUE_PREFIX])


getOld = (leveldown, id, rev, key, cb) ->
  value = null

  nextCb = (err, key, val) =>
    if err then return cb(err)
    if not arguments.length then return cb()
    value = val
    decode(bufferToKey(key), null, decodeKeyCb)

  decodeKeyCb = (err, decoded) =>
    if err then return cb(err)
    key = decoded.normalize()
    if key[2] of rev.uncommitted
      return iterator.next(nextCb)
    decode(value, null, decodeValueCb)

  decodeValueCb = (err, decoded) =>
    if err then return cb(err)
    cb(null, decoded)

  cacheKey = keyToBuffer(REVISION_CACHE_PREFIX,
    new BitArray([@rev.id, @id, key]))
  @ld.get(cacheKey, getCacheCb)
  # search on the default index namespace, we want the entry with the
  # biggest committed transaction id
  opts =
    keys: false
    reverse: true
    start: key
  iterator = leveldown.iterator(opts)
  iterator.next(nextCb)


class LeveldownDomain extends DomainBase
  constructor: (@id, @db, @rev, @ld, @queue, @uidGenerator) ->


  find: (query) -> new LeveldownCursor(@id, @db, @rev, @ld, @queue,
    query)



  getIndex: (key, cb) ->
    iterator = error = value = null

    getCacheCb = (err, val) =>
      if err and not /notfound/i.test(err.message) then return cb(err)
      # search on the default index namespace, we want the entry with the
      # biggest committed transaction id
      k = keyToBuffer(INDEX_PREFIX, new BitArray([id, key, MAX_REV_ID]))
      opts =
        keys: false
        reverse: true
        start: k
      iterator = @ld.iterator(opts)
      iterator.next(nextCb)

    nextCb = (err, key, val) =>
      if err then return cb(err)
      if not arguments.length then return cb()
      value = val
      decode(bufferToKey(key), null, decodeKeyCb)

    decodeKeyCb = (err, decoded) =>
      if err then return cb(err)
      key = decoded.normalize()
      if key[2] of rev.uncommitted
        return iterator.next(nextCb)
      decode(value, null, decodeValueCb)

    decodeValueCb = (err, decoded) =>
      if err then return cb(err)
      cb(null, decoded)

    cacheKey = keyToBuffer(REVISION_CACHE_PREFIX,
      new BitArray([@rev.id, @id, key]))
    @ld.get(cacheKey, getCacheCb)


  setIndex: (key, value, cb) ->
    oldValue = undef

    getCacheCb = (err, old) =>
      if err
        if /notfound/i.test(err.message)
          k = keyToBuffer(INDEX_PREFIX, new BitArray([id, key, MAX_REV_ID]))
          return getOld(@ld, @id, @rev, k, getCb)
        return cb(err)
      oldValue = old
      encode(value, encodeValueCb)

    getCb = (err, old) =>
      if err then return cb(err)
      oldValue = value
      encode(value, encodeValueCb)

    encodeValueCb = (err, encoded) =>
      if err then return cb(err)
      @ld.put(key, encoded, putCb)

    putCb = (err) =>
      if err then return cb(err)
      cb(null, oldValue)

    cacheKey = keyToBuffer(REVISION_CACHE_PREFIX,
      new BitArray([@rev.id, @id, key]))
    @ld.get(cacheKey, getCacheCb)


  delIndex: (key, value, cb) ->
    oldValue = undef

    getCacheCb = (err, old) =>
      if err
        if /notfound/i.test(err.message)
          k = keyToBuffer(INDEX_PREFIX, new BitArray([id, key, MAX_REV_ID]))
          return getOld(@ld, @id, @rev, k, getCb)
        return cb(err)
      oldValue = old
      encode(value, encodeValueCb)

    getCb = (err, old) =>
      if err then return cb(err)
      oldValue = value
      encode(value, encodeValueCb)

    encodeValueCb = (err, encoded) =>
      if err then return cb(err)
      @ld.put(key, encoded, putCb)

    putCb = (err) =>
      if err then return cb(err)
      cb(null, oldValue)

    cacheKey = keyToBuffer(REVISION_CACHE_PREFIX,
      new BitArray([@rev.id, @id, key]))
    @ld.get(cacheKey, getCacheCb)


  setHistoryIndex: (key, historyEntry, cb) ->
    encodeValueCb = (err, encoded) =>
      if err then return cb(err)
      @rev.put(key, encoded, cb)

    key = keyToBuffer(1, new BitArray([HISTORY_ID, key]))
    encode(historyEntry, encodeValueCb)


  saveValue: (value, cb) ->
    encodeCb = (err, encoded) =>
      if err then return cb(err)
      @rev.putValue(key, ref, encoded, cb)

    ref = new ObjectRef(@uid++)
    key = new Buffer(8)
    writeUInt64BE(ref.valueOf(), key, 0)
    key = Buffer.concat([valuePrefix, key.slice(1)], 8)
    encode(value, null, encodeCb)


class LeveldownCursor extends CursorBase
  constructor: (@id, @db, @rev, @ld, queue, query) ->
    super(queue, query)
    @iterator = null


  each: (cb) ->


  findRangeAsc: (gte, gt, lte, lt, cb) ->
    i = skip = 0

    nextCb = (err, key, value) =>
      if err or not next then return cb(err, null, null, null)
      i++


    opts =
      limit: -1
      keyAsBuffer: true
      valueAsBuffer: true

    if start = gte or gt
      opts.start = new Buffer(start.getBytes())

    if end = lte or lt
      opts.end = new Buffer(end.getBytes())

    @iterator = @ld.iterator(opts)
    @iterator.next(nextCb)



  findRangeDesc: (gte, gt, lte, lt, cb) ->


exports.LeveldownDomain = LeveldownDomain
exports.LeveldownCursor = LeveldownCursor
