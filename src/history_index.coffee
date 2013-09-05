{LocalIndex, LocalCursor, HistoryEntryType} = require('./local_index')
{ObjectRef} = require('./util')
{InvalidOperationError, CorruptedStateError} = require('./errors')


class HistoryIndex extends LocalIndex
  constructor: (dbStorage, queue, tree, @master) ->
    super(null, null, dbStorage, queue, tree, null, null)


  ins: (value, cb) ->
    throw new InvalidOperationError(
      "Direct modifications are forbidden on the $history domain")


  set: (key, value, cb) ->
    throw new InvalidOperationError(
      "Direct modifications are forbidden on the $history domain")


  del: (key, cb) ->
    throw new InvalidOperationError(
      "Direct modifications are forbidden on the $history domain")


  find: (query) -> new HistoryCursor(@dbStorage, @queue, @tree, query, @master)


class HistoryCursor extends LocalCursor
  constructor: (dbStorage, queue, tree, query, @master) ->
    super(dbStorage, queue, tree, query)


  fetchRow: (key, val, cb) ->
    getOld = getNew = false
    rv = new HistoryRow(new Date(key.getTime()), HistoryEntryType[val[0]],
        null, val[2], null, null, null, null)

    getDomainNameCb = (err, name) =>
      if err then return cb(err, null)
      rv.domain = name
      if getOld then return @dbStorage.getIndexData(rv.oldRef, getOldCb)
      getOldCb(null, rv.oldValue)

    getOldCb = (err, value) =>
      if err then return cb(err, null)
      rv.oldValue = value
      if getNew then return @dbStorage.getIndexData(rv.ref, getNewCb)
      getNewCb(null, rv.value)

    getNewCb = (err, value) =>
      if err then return cb(err, null)
      rv.value = value
      cb(null, rv)

    switch val[0]
      when HistoryEntryType.Insert
        if val[3] instanceof ObjectRef
          getNew = true
          rv.ref = val[3]
        else
          rv.value = val[3]
      when HistoryEntryType.Delete
        if val[3] instanceof ObjectRef
          getOld = true
          rv.oldRef = val[3]
        else
          rv.oldValue = val[3]
      when HistoryEntryType.Update
        if val[3] instanceof ObjectRef
          getOld = true
          rv.oldRef = val[3]
        else
          rv.oldValue = val[3]
        if val[4] instanceof ObjectRef
          getNew = true
          rv.ref = val[4]
        else
          rv.value = val[4]
      else
        throw new CorruptedStateError()

    @master.get(['names', val[1]], getDomainNameCb)


class HistoryRow
  constructor: (@date, @type, @domain, @key, @oldValue, @oldRef, @value,
    @ref) ->


exports.HistoryIndex = HistoryIndex
