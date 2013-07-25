/// <reference path="./private_api.ts"/>
/// <reference path="./util.ts"/>
/// <reference path="./local_revision.ts"/>
/// <reference path="./local_index.ts"/>
/// <reference path="./custom_errors.ts"/>
/// <reference path="./open.ts"/>

class LocalDatabase implements Connection {
  dbStorage: DbStorage;
  masterRef: string;
  queue: JobQueue;
  uidGenerator: UidGenerator;
  sequences: any;

  constructor(dbStorage: DbStorage) {
    var sequencesJob = (cb: AnyCb) => {
      this.dbStorage.get(DbObjectType.Other, 'sequences', cb);
    };
    var sequencesCb = (err: Error, sequences: any) => {
      this.sequences = sequences || [1];
    };
    var masterRefJob = (cb: AnyCb) => {
      this.dbStorage.get(DbObjectType.Other, 'masterRef', cb);
    };
    var masterRefCb = (err: Error, masterRef: string) => {
      this.masterRef = masterRef;
    };

    this.dbStorage = dbStorage;
    this.queue = new JobQueue();
    this.uidGenerator = new UidGenerator();
    this.sequences = null;
    this.masterRef = null;

    this.queue.add(sequencesCb, sequencesJob);
    this.queue.add(masterRefCb, masterRefJob);
  }

  begin(cb: TransactionCb) {
    var job = (cb) => {
      var suffix = this.uidGenerator.generate().hex.slice(0, 14);
      cb(null, new LocalRevision(this, this.dbStorage, this.masterRef,
            suffix));
    };

    if (!this.masterRef) this.queue.add(cb, job);
    else job(cb);
  }

  /*
   *  High level description of the merge(commit) algorithm:
   * 
   *  1 - If the revision's original masterRef equals the current masterRef,
   *      then fast-forward(the revision masterRef becomes the current
   *      masterRef) and return.
   *  2 - For each index in the revision cache:
   *      2.1 - If the index is new or the original rootRef equals the current
   *            rootRef of the same index, or the index wasn't modified,
   *            fast-foward it and continue to the next index.
   *      2.2 - Store the index for later.
   *  3 - If no indexes were stored in the step 2 then the merge is complete
   *      and we can return.
   *  4 - For each history entry created in the revision:
   *      4.1 - If the entry's index is one of the indexes stored in step 2:
   *            4.1.1 - If the entry is a delete or update and the value
   *                    equals the current value associated with the entry's
   *                    key/index, reproduce the change in the current
   *                    version and continue to the next entry.
   *            4.1.2 - The merge failed due to a conflict(the key/index being
   *                    updated was modified since this revision was checked
   *                    out). Return an error containing the current value
   *                    so the conflict can be handled in another layer.
   */
  merge(rev: LocalRevision, mergeCb: MergeCb) {
    var mergeJob = (nextJob: MergeCb) => {
      /*
       * Sets the merge job completion callback and copy cached indexes
       */
      mergeCb = nextJob;
      refMap = {};
      if (rev.originalMasterRef === this.masterRef) return commitTrees();
      forwarded = {};
      replay = {};
      cached = [];
      for (var k in rev.treeCache) cached.push(rev.treeCache[k]);
      currentMaster = new AvlTree(this.dbStorage, this.masterRef);
      nextIndex();
    };
    var nextIndex = () => {
      /*
       * Called for each cached index to retrieve the current index rootRef
       */
      if (!cached.length) {
        return currentMaster.get(['refs', HISTORY], currentHistoryCb);
      }
      currentIndex = cached.shift();
      currentIndexKey = ['refs', currentIndex.name];
      currentMaster.get(currentIndexKey, currentIndexCb);
    };
    var currentIndexCb = (err: Error, ref: string) => {
      /*
       * If the current index it wasn't modified in the master branch,
       * mark it for fast-forward.
       * If the current index wasn't modified in the revision but was
       * modified in the master branch, add the master version to the
       * refMap so it will be updated in the revision after commit.
       * Else mark it for conflict check/replay
       */
      var orig, currentMasterIndex;
      if (err) return cb(err);
      orig = currentIndex.tree.getOriginalRootRef();
      if (!ref || orig === ref) {
        forwarded[currentIndex.name] = currentIndex;
        return yield(nextIndex);
      }
      currentMasterIndex = { tree: new AvlTree(this.dbStorage, ref),
        name: currentIndex.name, id: currentIndex.id };
      if (!currentIndex.tree.modified() && orig !== ref) {
        refMap[currentIndex.name] = currentMasterIndex;
      } else {
        replay[currentIndex.id] = currentMasterIndex;
      }
      yield(nextIndex);
    };
    var currentHistoryCb = (err: Error, ref: string) => {
      /*
       * Start iterating the revision history to check for possible conflicts
       */
      if (err) return cb(err);
      currentHistory = new AvlTree(this.dbStorage, ref);
      rev.history.inOrder(new BitArray(rev.id), historyWalkCb);
    };
    var historyWalkCb = (err: Error, next: NextNodeCb, node: IndexNode) => {
      /*
       * Called for each history entry created in the new revision,
       * setting relevant context variables for the iteration.
       */
      if (err) return cb(err);
      if (!next) {
        nextHistoryEntry = null;
        if (conflicts) return this.handleUpdateConflicts(conflicts, cb);
        if (commitTrees) commitTrees();
        return;
      }
      nextHistoryEntry = next;
      revHistoryEntryNode = node;
      revHistoryEntry = node.getValue();
      historyEntryType = revHistoryEntry[0];
      if (!replay[revHistoryEntry[1]]) return nextHistoryEntry();
      replayTree = replay[revHistoryEntry[1]].tree;
      revHistoryEntryKey = revHistoryEntry[2];
      if (historyEntryType !== HistoryEntryType.Insert) {
        return replayTree.get(revHistoryEntryKey, checkIndexCb);
      }
      replayOperation();
    };
    var checkIndexCb = (err: Error, ref: string) => {
      /*
       * Collects all conflicts due to concurrent value updates.
       */
      if (ref && ref !== revHistoryEntry[3]) {
        conflicts = conflicts || [];
        conflicts.push({
          index: replay[revHistoryEntry[1]].name,
          key: revHistoryEntryKey,
          originalValue: revHistoryEntry[3],
          actualValue: ref 
        });
        return nextHistoryEntry();
      }
      replayOperation();
    };
    var replayOperation = () => {
      /*
       * Replays the operation in the current index
       */
      if (historyEntryType === HistoryEntryType.Insert ||
          historyEntryType === HistoryEntryType.Update) {
        replayTree.set(revHistoryEntryKey, revHistoryEntry[4] ||
            revHistoryEntry[3], replayOperationCb);
      } else {
        replayTree.del(revHistoryEntryKey, replayOperationCb);
      }
    };
    var replayOperationCb = (err: Error) => {
      /*
       * Replays the history entry in the current history
       */
      if (err) return cb(err);
      currentHistory.set(revHistoryEntryNode.getKey(),
          revHistoryEntry, replayHistoryCb);
    };
    var replayHistoryCb = (err: Error, old: any) => {
      if (err) return cb(err);
      if (old) return cb(new DbError('history entry exists'));
      nextHistoryEntry();
    };
    var commitTrees = () => {
      commit = [];
      for (var k in forwarded) commit.push(forwarded[k]);
      for (var k in replay) commit.push(replay[k]);
      if (!commit.length) {
        // the entire revision was fast-forwarded, so populate the commit
        // list with the revision treeCache
        for (var k in rev.treeCache) {
          if (rev.treeCache[k].tree.modified()) commit.push(rev.treeCache[k]);
        }
        currentHistory = rev.history;
        currentMaster = rev.master;
      }
      commitNextTree(null);
    };
    var commitNextTree = (err: Error) => {
      if (err) return cb(err);
      if (!commit.length) return currentHistory.commit(true, commitHistoryCb);
      currentCommit = commit.shift();
      currentCommit.tree.commit(true, commitTreeCb);
    };
    var commitTreeCb = (err: Error) => {
      if (err) return cb(err);
      refMap[currentCommit.name] = currentCommit;
      currentMaster.set(['refs', currentCommit.name],
          currentCommit.tree.getRootRef(), commitNextTree);
    };
    var commitHistoryCb = (err: Error) => {
      if (err) return cb(err);
      currentMaster.set(['refs', HISTORY],
          currentHistory.getRootRef(), setHistoryRefCb);
    };
    var setHistoryRefCb = (err: Error) => {
      if (err) return cb(err);
      currentMaster.commit(true, commitMasterCb);
    };
    var commitMasterCb = (err: Error) => {
      if (err) return cb(err);
      this.dbStorage.set(DbObjectType.Other, 'sequences', this.sequences,
          commitSequencesCb);
    }
    var commitSequencesCb = (err: Error) => {
      if (err) return cb(err);
      return this.dbStorage.set(DbObjectType.Other, 'masterRef',
          currentMaster.getRootRef(), cb);
    };
    var cb = (err: Error) => {
      if (err) {
        commitTrees = null;
        // free the history iteration job if in-progress
        if (nextHistoryEntry) nextHistoryEntry(true);
        return mergeCb(err, null, null, null);
      }
      this.masterRef = currentMaster.getRootRef();
      mergeCb(null, refMap, currentHistory, currentMaster);
    }
    var forwarded, replay, commit, currentHistory, currentCommit;
    var cached, currentIndex, currentMaster, revHistoryEntryNode;
    var currentIndexKey, historyEntryType, refMap, conflicts;
    var revHistoryEntryKey, revHistoryEntry, nextHistoryEntry, replayTree;

    this.queue.add(mergeCb, mergeJob);
  }

  private handleUpdateConflicts(conflicts: Array, cb: AnyCb) {
    var nextConflict = () => {
      if (i === conflicts.length) return cb(new ConflictError(conflicts));
      conflict = conflicts[i++];
      if (typeOf(conflict.actualValue) === ObjectType.ObjectRef) {
        return this.dbStorage.get(DbObjectType.IndexData,
            conflict.actualValue.ref, actualValueCb);
      }
      actualValueCb(null, conflict.actualValue);
    };
    var actualValueCb = (err: Error, value: any) => {
      if (err) return cb(err);
      conflict.actualValue = value;
      if (typeOf(conflict.originalValue) === ObjectType.ObjectRef) {
        return this.dbStorage.get(DbObjectType.IndexData,
            conflict.originalValue.ref, originalValueCb);
      }
      originalValueCb(null, conflict.originalValue);
    };
    var originalValueCb = (err: Error, value: any) => {
      if (err) return cb(err);
      conflict.originalValue = value;
      yield(nextConflict);
    };

    var conflict, i = 0;

    nextConflict();
  }

  next(id: number) {
    return this.sequences[id] ?
      ++this.sequences[id] :
      (this.sequences[id] = 1);
  }
}

registerFrontend('local', LocalDatabase);
