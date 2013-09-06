{ObjectRef, normalize, denormalize} = require('../../src/util')


class DomStorage
  constructor: (options) ->
    @uid = @getItem('u', 'uid') or 0
    @prefix = options.prefix or ''


  get: (key, cb) ->
    cb(null, @getItem('k', key))


  set: (key, obj, cb) ->
    @setItem('k', key, obj)
    cb(null)


  save: (ns, value, cb) ->
    ref = new ObjectRef(++@uid)
    @setItem(ns, ref.valueOf(), value)
    cb(null, ref)


  saveIndexNode: (obj, cb) ->
    @save('n', obj, cb)


  getIndexNode: (ref, cb) ->
    cb(null, @getItem('n', ref.valueOf()))


  saveIndexData: (obj, cb) ->
    @save('d', obj, cb)


  getIndexData: (ref, cb) ->
    cb(null, @getItem('d', ref.valueOf()))


  flush: (cb) -> cb(null)


  open: (cb) -> cb(null)


  close: (cb) -> cb(null)


  getItem: (ns, key) ->
    str = localStorage.getItem(@prefix + key)

    if not str
      return null

    return denormalize(JSON.parse(str))


  setItem: (ns, key, value) ->
    localStorage.setItem(@prefix + key, JSON.stringify(normalize(value)))


registerStorage('dom', DomStorage)
