
class LeveldownRevision
  constructor: (@id, @db, @leveldown) ->


  put: (key, value, cb) ->
    oldValue = undef

    getCb = (err, old) =>
      if err and not /notfound/i.test(err.message) then return cb(err)
      oldValue = old
      encode(value, encodeValueCb)

    encodeValueCb = (err, encoded) =>
      if err then return cb(err)
      @rev.put(key, encoded, putCb)

    putCb = (err) =>
      if err then return cb(err)
      cb(null, oldValue)

    key = keyToBuffer(1, new BitArray([@id, key]))
    @rev.get(key, getCb)


