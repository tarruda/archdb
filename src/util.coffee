#  General purpose timestamp-based uid generator. The generated ids
#  are byte sequences where:
#
#  bytes 1-6: unix time in milliseconds(since 1970), the max possible
#             value is 7fffffffffff which represents
#             'Tue Oct 16 6429 23:45:55 GMT-0300 (BRT)' (we won't be
#             running out of ids for a while).
#  byte 7   : id count generated in the current millisecond, that means
#             each generator can only generate 256 ids per millisecond.
#  remaining: arbitrary number that is assigned to the UidGenerator instance
#             at creation. This allows multiple instances to safely generate
#             ids at the same time, as long as this number is unique
#             for each instance.
#
#  Uids are represented by hex strings wrapped on the Uid class
#

class Uid
  constructor: (@hex) ->

  # the date this uid was generated
  getTime: -> parseInt(@hex.substr(0, 12), 16)


  byteLength: -> @hex.length / 2


class UidGenerator
  constructor: (suffix) ->
    if not suffix
      @generateSuffix()
    else
      @suffix = suffix
    @genTime = 0
    @genTimeCount = 0


  generate: (time) ->
    if not time
      time = new Date().getTime()

    if @genTime != time
      @genTime = time
      @genTimeCount = 0

    if (count = @genTimeCount++) > 255
      throw new Error('Generated too many ids in the same millisecond')

    pad = '00'
    tc = count.toString(16)
    tc = pad.substr(0, pad.length - tc.length) + tc
    timeStr = @toTime16(time)

    return new Uid(timeStr + tc + @suffix)


  generateSuffix: ->
    @suffix = ''
    # generated suffixes are random 7-byte numbers so the resulting
    # uids have 14 bytes
    for i in [1..14]
      @suffix += @random('0123456789abcdef')


  toTime16: (time) ->
    pad = '000000000000'
    time = time.toString(16)
    return pad.substr(0, pad.length - time.length) + time


  random: (choices) ->
    radix = choices.length
    choice = Math.ceil(Math.random() * radix)

    if choice == radix
      choice--

    return choices[choice]


class ObjectRef
  constructor: (@val) ->


  valueOf: -> @val


  equals: (other) ->
    if not (other instanceof ObjectRef)
      return false
    return @valueOf() == other.valueOf()


class LinkedListNode
  constructor: (@data) ->


class LinkedList
  constructor: ->
    @length = 0


  push: (data) ->
    node = new LinkedListNode(data)
    if @tail
      @tail = @tail.next = node
    else
      @tail = @head = node
    @length++


  shift: ->
    if not @head
      return
    rv = @head.data
    if @head.next
      @head = @head.next
    else @head = @tail = null
    @length--
    return rv


  each: (cb) ->
    current = @head
    while current
      cb(current.data)
      current = current.next
    return


  eachAsync: (cb) ->
    current = @head

    if not current
      return

    next = =>
      data = current.data
      current = current.next
      called = false
      if current
        nextCb = (stop) =>
          if called
            throw new Error('called too many times')
          called = true
          if not stop
            $yield(next)
      cb(data, nextCb)

    next()


  remove: (item) ->
    current = @head
    previous = null
    while current
      if item == current.data
        if previous
          previous.next = current.next
        else
          @head = current.next || null
        break
      previous = current
      current = current.next
    if not @head
      @tail = @head


class Emitter
  on: (event, cb) ->
    @handlers = @handlers || {}
    @handlers[event] = @handlers[event] || new LinkedList()
    @handlers[event].push(cb)


  once: (event, cb) ->
    onceCb = =>
      cb.apply(null, arguments)
      @handlers[event].remove(onceCb)
    @on(event, onceCb)


  off: (event, cb) ->
    if not @handlers or not @handlers[event]
      return
    @handlers[event].remove(cb)


  emit: (event, args...) ->
    invokeCb = (handler) -> handler.apply(null, args)

    if not @handlers or not @handlers[event]
      return
    @handlers[event].each(invokeCb)


class AsyncEmitter extends Emitter
  emit: (event, args..., cb) ->
    invokeCb = (handler, next) ->
      if next
        nextCb = (stop) =>
          if stop
            return cb()
          next(stop)
      else
        nextCb = cb
      a = args.slice()
      a.unshift(nextCb)
      handler.apply(null, a)

    if not @handlers or not @handlers[event]
      return
    @handlers[event].eachAsync(invokeCb)


class Job
  constructor: (@cb, @fn) ->


class JobQueue extends Emitter
  constructor: (@frozen = false) ->
    super()
    @jobs = new LinkedList()
    @running = false


  add: (cb, fn) ->
    args = null

    invokeCb = =>
      if cb
        cb.apply(null, args)
      if args[0] instanceof Error
        @emit('error', args[0])
      @running = false
      @run()

    jobCb = =>
      if not jobCb
        throw new Error('job callback invoked too many times')
      jobCb = null
      args = arguments
      $yield(invokeCb)

    @jobs.push(new Job(jobCb, fn))
    @run()


  run: ->
    nextJob = =>
      if not @jobs.length
        return
      currentJob = @jobs.shift()
      currentJob.fn(currentJob.cb)

    currentJob = null

    if @frozen or @running or not @jobs.length
      return
    @running = true
    $yield(nextJob)


ObjectType = {
  Object: 1
  Array: 2
  Date: 3
  RegExp: 4
  String: 5
  Number: 6
  Boolean: 7
  Uid: 8
  ObjectRef: 9
  Null: 10
  Undefined: 11
}


typeOf = (obj) ->
  if obj == null then return ObjectType.Null
  if obj == undefined then return ObjectType.Undefined
  if obj instanceof Uid then return ObjectType.Uid
  if obj instanceof ObjectRef then return ObjectType.ObjectRef
  type = /\[object\s(\w+)]/.exec(Object.prototype.toString.call(obj))[1]
  return ObjectType[type]


# Object normalization/denormalization functions
#
# These functions have two purposes:
# 1 - Deeply cloning objects returned from index queries, so it is
# safe to modify those objects from user code without worrying
# about messing with the backend caches
# 2 - Converting special objects such as Date or RegExp instances
# to a format that is friendly for storage using key/value serialization
# formats such as json or message pack
normalize = (obj) ->
  type = typeOf(obj)
  switch type
    when ObjectType.Date
      rv = normalizeDate(obj)
    when ObjectType.RegExp
      rv = normalizeRegExp(obj)
    when ObjectType.Uid
      rv = normalizeUid(obj)
    when ObjectType.ObjectRef
      rv = normalizeObjectRef(obj)
    when ObjectType.Number, ObjectType.Boolean
      rv = obj.valueOf()
    when ObjectType.Undefined, ObjectType.Null
      rv = null
    when ObjectType.String
      rv = normalizeString(obj)
    when ObjectType.Array
      rv = []
      for item in obj
        rv.push(normalize(item))
    when ObjectType.Object
      rv = {}
      for own k, v of obj
        rv[k] = normalize(v)
  return rv


denormalize = (obj) ->
  type = typeOf(obj)
  switch type
    when ObjectType.Number, ObjectType.Boolean
      rv = obj
    when ObjectType.Null
      rv = null
    when ObjectType.String
      if not (rv = denormalizeDate(obj)) and
      not (rv = denormalizeRegExp(obj)) and
      not (rv = denormalizeUid(obj)) and
      not (rv = denormalizeObjectRef(obj))
        rv = denormalizeString(obj)
    when ObjectType.Array
      rv = []
      for item in obj
        rv.push(denormalize(item))
    when ObjectType.Object
      rv = {}
      for own k, v of obj
        rv[k] = denormalize(v)
  return rv


normalizeString = (obj) ->
  if /^!/.test(obj)
    return '!' + obj
  return obj


denormalizeString = (obj) ->
  if /^!/.test(obj)
    return obj.slice(1)
  return obj


normalizeObjectRef = (obj) ->
  return '!or' + JSON.stringify(obj.valueOf())


denormalizeObjectRef = (obj) ->
  match = /^!or(.+)$/.exec(obj)
  if match
    return new ObjectRef(JSON.parse(match[1]))


normalizeUid = (obj) ->
  return '!id' + obj.hex


denormalizeUid = (obj) ->
  match = /^!id([abcdef0123456789]{28})$/.exec(obj)
  if match
    return new Uid(match[1])


normalizeDate = (obj) ->
  return '!dt' + obj.valueOf().toString(16)


denormalizeDate = (obj) ->
  match = /^!dt(.+)$/.exec(obj)
  if match
    return new Date(parseInt(match[1], 16))


normalizeRegExp = (obj) ->
  flags = ''
  if obj.global
    flags += 'g'
  if obj.multiline
    flags += 'm'
  if obj.ignoreCase
    flags += 'i'
  return '!re' + flags + ',' + obj.source


denormalizeRegExp = (obj) ->
  match = /^!re(.+)?,(.+)$/.exec(obj)
  if match
    return new RegExp(match[2], match[1])


exports.ObjectRef = ObjectRef
exports.Uid = Uid
exports.UidGenerator = UidGenerator
exports.LinkedList = LinkedList
exports.Emitter = Emitter
exports.AsyncEmitter = AsyncEmitter
exports.Job = Job
exports.JobQueue = JobQueue
exports.ObjectType = ObjectType
exports.typeOf = typeOf
exports.normalize = normalize
exports.denormalize = denormalize
