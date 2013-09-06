{ObjectRef, Emitter, ObjectType, typeOf} = require('../../../src/util')
{CursorError} = require('../../../src/errors')
BitArray = require('../../../src/bit_array')
{LocalDomain, LocalCursor, HistoryEntryType} =
  require('../../../src/local/domain')


# keyToBuffer = (key) ->
#   return new



class LeveldownDomain extends LocalDomain
  constructor: (@name, @db, @leveldown, @queue, @uidGenerator) ->


  find: (query) -> new LeveldownCursor(@db, @leveldown, @queue, query)


  setJob: (key, value, cb) ->
    old = newValue = null; type = typeOf(value)

    refCb = (err, ref) => set(ref)

    set = (ref) =>
      newValue = ref
      @tree.set(key, ref, setCb)

    setCb = (err, oldValue) =>
      if err then return cb(err, null)
      if @hist
        if oldValue
          if (oldValue instanceof ObjectRef and
          not oldValue.equals(newValue)) or
          oldValue != newValue
            old = oldValue
            he = [HistoryEntryType.Update, @id, key, oldValue, newValue]
        else
          he = [HistoryEntryType.Insert, @id, key, newValue]
        if he then @saveHistory(he, histCb)
        else cb(null, newValue)
        return
      cb(null, old)

    histCb = (err) =>
      if err then return cb(err, null)
      cb(null, old)

    switch type
      # small fixed-length values are stored inline
      when ObjectType.ObjectRef, ObjectType.Boolean, ObjectType.Number
        set(value)
      else
        @dbStorage.saveIndexData(value, refCb)


  delJob: (key, cb) ->
    old = null

    delCb = (err, oldValue) =>
      if err then return cb(err, null)
      if @hist
        if oldValue
          old = oldValue
          he = [HistoryEntryType.Delete, @id, key, oldValue]
          return @saveHistory(he, histCb)
      cb(null, null)

    histCb = (err) =>
      if err then return cb(err, null)
      cb(null, old)

    @tree.del(key, delCb)


  saveHistory: (historyEntry, cb) ->
    key = @uidGenerator.generate()
    @hist.set(key, historyEntry, cb)


class LeveldownCursor extends LocalCursor
  constructor: (@db, @leveldown, @queue, @query) ->
    @closed = false
    @started = false
    @err = null
    @nextNodeCb = null
    @thenCb = null
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

    @iterator = @leveldown.iterator(opts)
    @iterator.next(nextCb)



  findRangeDesc: (gte, gt, lte, lt, cb) ->


exports.LeveldownDomain = LeveldownDomain
exports.LeveldownCursor = LeveldownCursor
