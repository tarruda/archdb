{ObjectRef, ObjectType, typeOf} = require('../util')
{DomainBase, CursorBase, DomainRow} = require('../domain_base')
{HistoryRow, HistoryDomainMixin, HistoryCursorMixin, HistoryEntryType} =
  require('../history_domain')


class LocalDomain extends DomainBase
  constructor: (@name, @db, @dbStorage, @queue, @tree, @hist, @uidGenerator) ->


  find: (query) -> new LocalCursor(@dbStorage, @queue, @tree, query)


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


class LocalCursor extends CursorBase
  constructor: (@dbStorage, queue, @tree, query) ->
    super(queue, query)


  count: -> @tree.getCount()


  findRangeAsc: (gte, gt, lte, lt, cb) ->
    limit = null
    i = skip = 0
    
    nodeCb = (err, next, node) =>
      if err or not next then return cb(err, null, null, null)
      i++
      key = node.getKey()
      if gt and gt.compareTo(key) >= 0 then return next()
      if lt and lt.compareTo(key) <= 0 then return next(true)
      if lte and lte.compareTo(key) < 0 then return next(true)
      if limit and i > limit + skip then return next(true)
      if skip < i then return cb(null, next, key.normalize(), node.getValue())
      next()

    if @query
      limit = @query.$limit
      skip = @query.$skip or skip

    @tree.inOrder(gte or gt, nodeCb)


  findRangeDesc: (gte, gt, lte, lt, cb) ->
    limit = null
    i = skip = 0

    nodeCb = (err, next, node) =>
      if err or not next then return cb(err, null, null, null)
      i++
      key = node.getKey()
      if lt and lt.compareTo(key) <= 0 then return next()
      if gt and gt.compareTo(key) >= 0 then return next(true)
      if gte and gte.compareTo(key) > 0 then return next(true)
      if limit and i > limit + skip then return next(true)
      if skip < i then return cb(null, next, key.normalize(), node.getValue())
      next()

    if @query
      limit = @query.$limit
      skip = @query.$skip or skip

    @tree.revInOrder(lte or lt, nodeCb)


  fetchKey: (key, cb) -> @tree.get(key, cb)


  fetchObj: (ref, cb) -> @dbStorage.getIndexData(ref, cb)


  fetchValue: (key, val, cb) ->
    rv = new DomainRow(key, null, null)

    refCb = (err, obj) =>
      if err then return cb(err, null)
      rv.value = obj
      cb(null, rv)

    if val instanceof ObjectRef
      rv.ref = val
      return @fetchObj(val, refCb)

    refCb(null, val)


class LocalHistoryDomain extends LocalDomain
  constructor: (dbStorage, queue, tree, @master) ->
    super(null, null, dbStorage, queue, tree, null, null)


  find: (query) ->
    new LocalHistoryCursor(@dbStorage, @queue, @tree, query, @master)


  HistoryDomainMixin.merge(this)


class LocalHistoryCursor extends LocalCursor
  constructor: (dbStorage, queue, tree, query, @master) ->
    super(dbStorage, queue, tree, query)


  fetchDomainName: (id, cb) ->
    @master.get(['names', id], cb)


  HistoryCursorMixin.merge(this)


exports.LocalDomain = LocalDomain
exports.LocalCursor = LocalCursor
exports.LocalHistoryDomain = LocalHistoryDomain
exports.LocalHistoryCursor = LocalHistoryCursor
