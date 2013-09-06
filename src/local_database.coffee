{ObjectRef, JobQueue, Uid, UidGenerator, ObjectType, typeOf} =
  require('./util')
{DbError, ConflictError} = require('./errors')
{AvlTree} = require('./avl')
{HistoryEntryType} = require('./local_index')
BitArray = require('./bit_array')
LocalRevision = require('./local_revision')


class LocalDatabase
  constructor: (@dbStorage) ->
    @queue = new JobQueue()
    @uidGenerator = new UidGenerator()
    @sequences = null
    @masterRef = null


  begin: (cb) ->
    job = (cb) =>
      hex = @uidGenerator.generate().hex
      suffix = hex.slice(0, 14)
      cb(null, new LocalRevision(this, @dbStorage, @masterRef, suffix))

    @queue.add(cb, job)


  open: (cb) ->
    openCb = (err) =>
      if err then return cb(err)
      @queue.add(sequencesCb, sequencesJob)
      @queue.add(masterRefCb, masterRefJob)

    sequencesJob = (sequencesCb) =>
      @dbStorage.get('sequences', sequencesCb)

    sequencesCb = (err, sequences) =>
      if err then return cb(err)
      @sequences = sequences || [1]

    masterRefJob = (masterRefCb) =>
      @dbStorage.get('masterRef', masterRefCb)

    masterRefCb = (err, masterRef) =>
      if err then return cb(err)
      @masterRef = masterRef
      cb(null)

    @dbStorage.open(openCb)


  close: (cb) -> @queue.add(cb, (cb) => @dbStorage.close(cb))


  # High level description of the merge(commit) algorithm:
  #
  # 1 - If the revision's original masterRef equals the current masterRef,
  #     then fast-forward(the revision masterRef becomes the current
  #     masterRef) and return.
  # 2 - For each index in the revision cache:
  #     2.1 - If the index is new or the original rootRef equals the current
  #           rootRef of the same index, or the index wasn't modified,
  #           fast-foward it and continue to the next index.
  #     2.2 - Store the index for later.
  # 3 - If no indexes were stored in the step 2 then the merge is complete
  #     and we can return.
  # 4 - For each history entry created in the revision:
  #     4.1 - If the entry's index is one of the indexes stored in step 2:
  #           4.1.1 - If the entry is a delete or update and the value
  #                   equals the current value associated with the entry's
  #                   key/index, reproduce the change in the current
  #                   version and continue to the next entry.
  #           4.1.2 - The merge failed due to a conflict(the key/index being
  #                   updated was modified since this revision was checked
  #                   out). Return an error containing the current value
  #                   so the conflict can be handled in another layer.
  #
  merge: (rev, mergeCb) ->
    forwarded = replay = commit = currentHistory = currentCommit =
      cached = currentIndex = currentMaster = revHistoryEntryNode =
      currentIndexKey = historyEntryType = refMap = conflicts =
      revHistoryEntryValueKey = revHistoryEntryValue = nextHistoryEntry =
      replayTree = revHistoryEntryKey = revHistoryEntryDomain =
      insertConflictCheck = null

    mergeJob = (nextJob) =>
      # Sets the merge job completion callback and copy cached indexes
      mergeCb = nextJob
      refMap = {}
      if not rev.originalMasterRef or rev.originalMasterRef.equals(@masterRef)
        return commitTrees()
      forwarded = {}
      replay = {}
      cached = []
      for own k, v of rev.treeCache
        cached.push(v)
      currentMaster = new AvlTree(@dbStorage, @masterRef, 0)
      nextIndex()

    nextIndex = =>
      # Called for each cached index to retrieve the current index rootRef
      if not cached.length
        return currentMaster.get(['refs', HISTORY], currentHistoryCb)
      currentIndex = cached.shift()
      currentIndexKey = ['refs', currentIndex.name]
      currentMaster.get(currentIndexKey, currentIndexCb)

    currentIndexCb = (err, refCount) =>
      # If the current index it wasn't modified in the master branch,
      # mark it for fast-forward.
      # If the current index wasn't modified in the revision but was
      # modified in the master branch, add the master version to the
      # refMap so it will be updated in the revision after commit.
      # Else mark it for conflict check/replay
      if err then return cb(err)
      orig = currentIndex.tree.getOriginalRootRef()
      if not refCount or orig.equals(refCount[0])
        forwarded[currentIndex.name] = currentIndex
        return $yield(nextIndex)
      currentMasterIndex =
        tree: new AvlTree(@dbStorage, refCount[0], refCount[1])
        name: currentIndex.name, id: currentIndex.id
      if not currentIndex.tree.modified() and not refCount[0].equals(orig)
        refMap[currentIndex.name] = currentMasterIndex
      else
        replay[currentIndex.id] = currentMasterIndex
      $yield(nextIndex)

    currentHistoryCb = (err, refCount) =>
      # Start iterating the revision's history to check for possible conflicts
      if err then return cb(err)
      currentHistory = new AvlTree(@dbStorage, refCount[0], refCount[1])
      # We are only interested in walking through history entries created
      # in the revision. Each revision has a timestamped id which we can use
      # to filter out history entries created in old revisions
      rev.hist.inOrder(new BitArray(rev.id), historyWalkCb)

    historyWalkCb = (err, next, node) =>
      # Called for each history entry created in the new revision,
      # setting relevant context variables for the iteration.
      if err then return cb(err)
      if not next
        nextHistoryEntry = null
        if conflicts then return @handleUpdateConflicts(conflicts, cb)
        if commitTrees then commitTrees()
        return
      nextHistoryEntry = next
      revHistoryEntryNode = node
      revHistoryEntryKey = node.getKey()
      revHistoryEntryValue = node.getValue()
      revHistoryEntryValueKey = revHistoryEntryValue[2]
      revHistoryEntryDomain = revHistoryEntryValue[1]
      # Even after filtering history entries using the revision's timestamp,
      # it is still possible to have entries created in previous revisions
      # that were committed later(and thus have a higher timestamp).
      # To ensure that this history node was created in this revision
      # we must compare its uid suffix with the revision's suffix
      if revHistoryEntryKey.normalize().hex.slice(14) != rev.suffix
        return $yield(next)
      historyEntryType = revHistoryEntryValue[0]
      if replay[revHistoryEntryDomain]
        # if not a fast-forward, get the current value from the index
        # to check for conflicts
        replayTree = replay[revHistoryEntryDomain].tree
        insertConflictCheck = historyEntryType == HistoryEntryType.Insert
        return replayTree.get(revHistoryEntryValueKey, checkIndexCb)
      replayOperation()

    checkIndexCb = (err, ref) =>
      # Collects all conflicts due to concurrent value updates.
      if insertConflictCheck
        hasConflict = ref?
        originalValue = null
      else
        if ref instanceof ObjectRef
          hasConflict = not ref.equals(revHistoryEntryValue[3])
        else
          hasConflict = ref != revHistoryEntryValue[3]
        originalValue = revHistoryEntryValue[3]
      if hasConflict
        conflicts = conflicts or []
        conflicts.push({
          index: replay[revHistoryEntryValue[1]].name
          key: revHistoryEntryValueKey
          originalValue: originalValue
          currentValue: ref
        })
        return nextHistoryEntry()
      replayOperation()

    replayOperation = =>
      if not replay[revHistoryEntryDomain]
        # only replay history entries for fast-forwared domains
        return replayOperationCb(null)
      # Replays the operation in the current index
      if historyEntryType == HistoryEntryType.Insert or
      historyEntryType == HistoryEntryType.Update
        replayTree.set(revHistoryEntryValueKey, revHistoryEntryValue[4] or
            revHistoryEntryValue[3], replayOperationCb)
      else
        replayTree.del(revHistoryEntryValueKey, replayOperationCb)

    replayOperationCb = (err) =>
      # Replays the history entry in the current history
      if err then return cb(err)
      currentHistory.set(revHistoryEntryKey, revHistoryEntryValue,
        replayHistoryCb)

    replayHistoryCb = (err, old) =>
      if err then return cb(err)
      if old then return cb(new DbError('history entry exists'))
      nextHistoryEntry()

    commitTrees = =>
      commit = []
      for own k, v of forwarded
        commit.push(v)
      for own k, v of replay
        commit.push(v)
      if not commit.length
        # the entire revision was fast-forwarded, so populate the commit
        # list with the revision treeCache
        for own k, v of rev.treeCache
          if rev.treeCache[k].tree.modified()
            commit.push(rev.treeCache[k])
        currentHistory = rev.hist
        currentMaster = rev.master
      commitNextTree(null)

    commitNextTree = (err) =>
      if err then return cb(err)
      if not commit.length
        return currentHistory.commit(true, commitHistoryCb)
      currentCommit = commit.shift()
      currentCommit.tree.commit(true, commitTreeCb)

    commitTreeCb = (err) =>
      if err then return cb(err)
      refMap[currentCommit.name] = currentCommit
      currentMaster.set(['refs', currentCommit.name],
          [currentCommit.tree.getRootRef(), currentCommit.tree.getCount()],
          commitNextTree)

    commitHistoryCb = (err) =>
      if err then return cb(err)
      currentMaster.set(['refs', HISTORY],
          [currentHistory.getRootRef(), currentHistory.getCount()],
          setHistoryRefCb)

    setHistoryRefCb = (err) =>
      if err then return cb(err)
      currentMaster.commit(true, commitMasterCb)

    commitMasterCb = (err) =>
      if err then return cb(err)
      @dbStorage.set('sequences', @sequences, setSequencesCb)

    setSequencesCb = (err) =>
      if err then return cb(err)
      @dbStorage.set('masterRef', currentMaster.getRootRef(), flush)

    flush = (err) =>
      if err then return cb(err)
      @dbStorage.flush(cb)

    cb = (err) =>
      if err
        commitTrees = null
        # free the history iteration job if in-progress
        if nextHistoryEntry then nextHistoryEntry(true)
        return mergeCb(err, null, null, null)
      @masterRef = currentMaster.getRootRef()
      mergeCb(null, refMap, currentHistory, currentMaster)

    @queue.add(mergeCb, mergeJob)


  handleUpdateConflicts: (conflicts, cb) ->
    conflict = null; i = 0

    nextConflict = =>
      if i == conflicts.length then return cb(new ConflictError(conflicts))
      conflict = conflicts[i++]
      if typeOf(conflict.currentValue) == ObjectType.ObjectRef
        return @dbStorage.getIndexData(conflict.currentValue, currentValueCb)
      currentValueCb(null, conflict.currentValue)

    currentValueCb = (err, value) =>
      if err then return cb(err)
      conflict.currentValue = value
      if typeOf(conflict.originalValue) == ObjectType.ObjectRef
        return @dbStorage.getIndexData(conflict.originalValue, originalValueCb)
      originalValueCb(null, conflict.originalValue)

    originalValueCb = (err, value) =>
      if err then return cb(err)
      conflict.originalValue = value
      $yield(nextConflict)

    nextConflict()


  next: (id) ->
    return if @sequences[id] then  ++@sequences[id] else (@sequences[id] = 1)


registerFrontend('local', LocalDatabase)
