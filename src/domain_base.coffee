{Emitter, ObjectType, typeOf} = require('./util')
BitArray = require('./bit_array')
{CursorError} = require('./errors')


class DomainBase
  constructor: (@name, @queue, @uidGenerator) ->


  ins: (value, cb) ->
    key = undef

    insCb = (err) =>
      if err then return cb(err, null)
      cb(null, key)

    job = (next) =>
      key = @db.next(@id)
      @setJob(key, value, next)

    if cb then @queue.add(insCb, job)
    else @queue.add(null, job)


  set: (key, value, cb) ->
    job = (next) => @setJob(key, value, next)

    @queue.add(cb, job)


  del: (key, cb) ->
    job = (next) => @delJob(key, next)

    @queue.add(cb, job)


  find: -> throw new Error('not implemented')


  setJob: -> throw new Error('not implemented')


  delJob: -> throw new Error('not implemented')


class CursorBase extends Emitter
  constructor: (@queue, @query) ->
    super()
    @closed = false
    @started = false
    @err = null
    @nextNodeCb = null
    @thenCb = null


  count: -> throw new Error('not implemented')


  all: (cb) ->
    rv =
      total: 0
      rows: []

    rowCb = (row) =>
      rv.rows.push(row)
      if @hasNext() then @next()

    endCb = (err) =>
      if err then return cb(err, null)
      rv.total = @count()
      cb(null, rv)

    @each(rowCb).then(endCb)


  one: (cb) ->
    rv = null

    rowCb = (row) =>
      rv = row
      @close()

    endCb = (err) =>
      if err then return cb(err, null)
      cb(null, rv)

    @each(rowCb).then(endCb)


  each: (cb) ->
    jobCb = null

    job = (cb) =>
      jobCb = cb
      @once('end', endCb)
      @find(visitCb)

    visitCb = (err, next, key, val) =>
      @nextNodeCb = next
      if err or not next then return @emit('end', err)
      @fetchValue(key, val, fetchValueCb)

    fetchValueCb = (err, row) =>
      if err then return @emit('end', err)
      cb.call(this, row)

    endCb = (err) =>
      if err then @err = err
      # if (@hasNext()) @nextNodeCb(true)
      @nextNodeCb = null
      if @thenCb
        @thenCb(err)
        @thenCb = null
      if jobCb
        jobCb(err)
        jobCb = null

    if @closed
      throw new CursorError('Cursor already closed')

    if @started
      throw new CursorError('Cursor already started')

    @started = true
    @queue.add(null, job)
    return this


  then: (cb) -> @thenCb = cb


  hasNext: -> !!@nextNodeCb


  next: ->
    if not @hasNext()
      throw new CursorError('No more rows')

    @nextNodeCb()


  close: ->
    if @closed
      return

    @closed = true
    @emit('end')


  find: (cb) ->
    if @query
      if @query.$eq then return @findEq(cb)
      if @query.$like then return @findLike(cb)
    @findRange(cb)


  findEq: (cb) ->
    getCb = (err, obj) =>
      if err then return cb(err, null, null, null)
      cb(null, nextCb, @query.$eq, obj)

    nextCb = => cb(null, null, null, null)

    @fetchKey(@query.$eq, getCb)


  findLike: (cb) ->
    # 'like' queries are nothing but range queries where we derive
    # the upper key from the '$like' parameter. That is, we find an upper
    # key so that all keys within the resulting range 'start' with the
    # '$like' parameter. It only makes sense for strings and arrays, eg:
    # [1, 2, 3] is starts with [1, 2]
    # 'ab' starts with 'abc'
    gte = new BitArray(@query.$like); lte = gte.clone()

    if (type = typeOf(@query.$like)) == ObjectType.Array
      # to properly create the 'upper bound key' for array, we must
      # insert the '1' before its terminator
      lte.rewind(4)
      lte.write(1, 1)
      lte.write(0, 4)
    else if (type == ObjectType.String)
      lte.write(1, 1)
    else
      throw new Error('invalid object type for $like parameter')

    if @query.$rev
      return @findRangeDesc(gte, null, lte, null, cb)

    @findRangeAsc(gte, null, lte, null, cb)


  findRange: (cb) ->
    if @query
      gte = if @query.$gte then new BitArray(@query.$gte) else null
      gt = if @query.$gt then new BitArray(@query.$gt) else null
      lte = if @query.$lte then new BitArray(@query.$lte) else null
      lt = if @query.$lt then new BitArray(@query.$lt) else null
      if @query.$rev then return @findRangeDesc(gte, gt, lte, lt, cb)

    @findRangeAsc(gte, gt, lte, lt, cb)


  findRangeAsc: (gte, gt, lte, lt, cb) -> throw new Error('not implemented')


  findRangeDesc: (gte, gt, lte, lt, cb) -> throw new Error('not implemented')

  
  fetchKey: (ref, cb) -> throw new Error('not implemented')


  fetchValue: (ref, cb) -> throw new Error('not implemented')


class DomainRow
  constructor: (@key, @value, @ref) ->


exports.DomainBase = DomainBase
exports.CursorBase = CursorBase
exports.DomainRow = DomainRow
