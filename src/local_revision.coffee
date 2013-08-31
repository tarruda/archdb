{Emitter, Uid, JobQueue, UidGenerator, ObjectRef} = require('./util')
{AvlTree} = require('./avl')
{LocalIndex, HistoryIndex} = require('./local_index')


class LocalRevision extends Emitter
  constructor: (db, dbStorage, masterRef, suffix) ->
    errorCb = (err) =>
      @emit('error', err)

    historyCb = (err, tree) =>
      if err then return @emit('error', err)
      @hist = tree

    super()
    @db = db
    @dbStorage = dbStorage
    @originalMasterRef = masterRef
    @uidGenerator = new UidGenerator(suffix)
    @id = @uidGenerator.generate()
    @queue = new JobQueue()
    @queue.on('error', errorCb)
    @treeCache = {}
    @master = new AvlTree(dbStorage, masterRef, 0)
    @hist = new IndexProxy(HISTORY, @master, dbStorage, @queue, historyCb)


  domain: (name) ->
    switch name
      when HISTORY
        return @historyDomain()
      else
        return @simpleDomain(name)


  historyDomain: ->
    rv = new HistoryIndex(@dbStorage, @queue, @hist, @master)

    committedCb = =>
      rv.tree = @hist

    @once('committed', committedCb)
    return rv


  simpleDomain: (name) ->
    indexIdKey = indexIdReverseKey = null
    cacheEntry = @treeCache[name] or
      @treeCache[name] =
        tree: new IndexProxy(name, @master, @dbStorage, @queue, treeCb)
        id: null
        name: name
    tree = cacheEntry.tree
    rv = new LocalIndex(name, @db, @dbStorage, @queue, tree, @hist,
      @uidGenerator)
    
    getIdJob = (cb) =>
      indexIdKey = ['ids', name]
      @master.get(indexIdKey, cb)

    getIdCb = (err, id) =>
      if err then return @emit('error', err)
      if not id
        id = @db.next(0)
        indexIdReverseKey = ['names', id]
        @queue.add(null, setIdJob)
        @queue.add(null, setIdReverseJob)
      cacheEntry.id = id
      rv.id = id

    setIdJob = (cb) =>
      @master.set(indexIdKey, cacheEntry.id, cb)

    setIdReverseJob = (cb) =>
      @master.set(indexIdReverseKey, name, cb)

    treeCb = (err, tree) =>
      if err then return @emit('error', err)
      cacheEntry.tree = tree

    committedCb = =>
      rv.tree = @treeCache[name].tree

    @once('committed', committedCb)
    if not cacheEntry.id then @queue.add(getIdCb, getIdJob)
    rv.id = cacheEntry.id
    return rv


  commit: (cb) ->
    job = (mergeCb) => @db.merge(this, mergeCb)

    mergeCb = (err, refMap, hist, master) =>
      if err then return cb(err)
      for own k, v of refMap
        @treeCache[k] = v
      @hist = hist
      @master = master
      @originalMasterRef = master.getRootRef()
      @id = @uidGenerator.generate()
      @emit('committed')
      cb(null)

    @queue.add(mergeCb, job)


class IndexProxy
  constructor: (name, master, dbStorage, queue, cb) ->
    jobCb = (nextJob) =>
      cb = nextJob
      master.get(['refs', name], getCb)

    getCb = (err, refCount) =>
      if err then return cb(err)
      if refCount
        @tree = new AvlTree(dbStorage, refCount[0], refCount[1])
      else
        @tree = new AvlTree(dbStorage, null, null)
      if @pending
        @pending.add(cb, proxyJob)
        @pending.frozen = false
        return @pending.run()
      cb(null, @tree)

    proxyJob = (cb) =>
      # only after all pending proxy invocations are handled we let
      # the transaction queue continue processing
      cb(null, @tree)

    @tree = null
    @pending = null
    queue.add(cb, jobCb)


  get: (key, cb) ->
    dcb = (tree, cb) => tree.get(key, cb)

    @delegate(cb, dcb)


  set: (key, value, cb) ->
    dcb = (tree, cb) => tree.set(key, value, cb)

    @delegate(cb, dcb)


  del: (key, cb) ->
    dcb = (tree, cb) => tree.del(key, cb)

    @delegate(cb, dcb)


  getCount: -> @tree.getCount()


  inOrder: (minKey, cb) ->
    dcb = (tree, cb) => tree.inOrder(minKey, cb)

    @delegate(cb, dcb)


  revInOrder: (maxKey, cb) ->
    dcb = (tree, cb) => tree.revInOrder(maxKey, cb)

    @delegate(cb, dcb)


  commit: (releaseCache, cb) ->
    dcb = (tree, cb) => tree.commit(releaseCache, cb)

    @delegate(cb, dcb)


  getRootRef: -> @tree.getRootRef()


  getOriginalRootRef: -> @tree.getOriginalRootRef()


  setOriginalRootRef: (ref) -> @tree.setOriginalRootRef(ref)


  modified: -> @tree.modified()


  delegate: (cb, fn) ->
    jobCb = (cb) => fn(@tree, cb)

    if @tree
      return fn(@tree, cb)

    if not @pending
      @pending = new JobQueue(true)

    @pending.add(cb, jobCb)


module.exports = LocalRevision
