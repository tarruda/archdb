{ObjectRef, denormalize, normalize} = require('./util')


class MemoryStorage
  constructor: ->
    @uid = 1
    @kv = {}
    @indexData = {}
    @indexNode = {}


  get: (key, cb) ->
    cb(null, denormalize(@kv[key]))


  set: (key, obj, cb) ->
    @kv[key] = normalize(obj)
    cb(null)


  saveIndexNode: (obj, cb) ->
    @save(@indexNode, obj, cb)


  getIndexNode: (ref, cb) ->
    cb(null, denormalize(@indexNode[ref.valueOf()]))


  saveIndexData: (obj, cb) ->
    @save(@indexData, obj, cb)


  getIndexData: (ref, cb) ->
    cb(null, denormalize(@indexData[ref.valueOf()]))


  flush: (cb) -> cb(null)


  close: (cb) -> cb(null)


  save: (hash, obj, cb) ->
    ref = new ObjectRef(@uid++)
    hash[ref.valueOf()] = normalize(obj)
    cb(null, ref)


registerBackend('memory', MemoryStorage)


module.exports = MemoryStorage
