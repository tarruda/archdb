# try
leveldown = require('leveldown')
# catch
#   return


{encode, decode} = require('./msgpack')
{DbError} = require('../../src/errors')
{ObjectRef} = require('../../src/util')


uid = 1


class LevelDBStorage
  constructor: (options) ->
    @db = leveldown(options.path)
    @options = options.leveldown or {}
    @ready = false


  get: (key, cb) ->
    getCb = (err, buffer) =>
      if err
        if /notfound/i.test(err.message)
          return cb(null, undef)
        return cb(err)
      decode(buffer, null, decodeCb)

    decodeCb = (err, decoded) =>
      if err then return cb(err)
      cb(null, decoded)

    @db.get(key.valueOf(), asBuffer: true, getCb)


  set: (key, val, cb) ->
    encodeCb = (err, encoded) =>
      if err then return cb(err)
      @db.put(key.valueOf(), encoded, cb)

    encode(val, null, encodeCb)


  save: (val, cb) ->
    setCb = (err) =>
      if err then return cb(err)
      cb(null, ref)

    ref = new ObjectRef(uid++)
    @set(ref, val, setCb)


  saveIndexNode: @::save


  getIndexNode: @::get


  saveIndexData: @::save


  getIndexData: @::get


  flush: (cb) -> cb(null)


  open: (cb) ->
    if @ready
      throw new DbError('already open')

    @db.open(@options, cb)


  close: (cb) -> @db.close(cb)


registerStorage('leveldb', LevelDBStorage)
