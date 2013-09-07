{ObjectRef, ObjectType, typeOf} = require('../util')
{DomainBase, CursorBase, DomainRow} = require('../domain_base')
{HistoryRow, HistoryDomainMixin, HistoryCursorMixin, HistoryEntryType} =
  require('../history_domain')


class LocalDomain extends DomainBase
  constructor: (@name, @db, @dbStorage, @queue, @tree, @hist, @uidGenerator) ->


  find: (query) -> new LocalCursor(@dbStorage, @tree, @queue, query)


  setIndex: (key, value, cb) -> @tree.set(key, value, cb)


  delIndex: (key, cb) -> @tree.del(key, cb)


  setHistoryIndex: (key, historyEntry, cb) -> @hist.set(key, historyEntry, cb)


  saveValue: (value, cb) -> @dbStorage.saveIndexData(value, cb)


class LocalCursor extends CursorBase
  constructor: (@dbStorage, @tree, queue, query) ->
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


  fetchValue: (ref, cb) -> @dbStorage.getIndexData(ref, cb)


  fetchRow: (key, val, cb) ->
    rv = new DomainRow(key, null, null)

    refCb = (err, obj) =>
      if err then return cb(err, null)
      rv.value = obj
      cb(null, rv)

    if val instanceof ObjectRef
      rv.ref = val
      return @fetchValue(val, refCb)

    refCb(null, val)


class LocalHistoryDomain extends LocalDomain
  constructor: (dbStorage, queue, tree, @master) ->
    super(null, null, dbStorage, queue, tree, null, null)


  find: (query) ->
    new LocalHistoryCursor(@dbStorage, @queue, @tree, query, @master)


  HistoryDomainMixin.merge(this)


class LocalHistoryCursor extends LocalCursor
  constructor: (dbStorage, queue, tree, query, @master) ->
    super(dbStorage, tree, queue, query)


  fetchDomainName: (id, cb) ->
    @master.get(['names', id], cb)


  HistoryCursorMixin.merge(this)


exports.LocalDomain = LocalDomain
exports.LocalCursor = LocalCursor
exports.LocalHistoryDomain = LocalHistoryDomain
exports.LocalHistoryCursor = LocalHistoryCursor
