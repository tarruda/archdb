/// <reference path="./private_api.ts"/>
/// <reference path="./api.ts"/>
/// <reference path="./util.ts"/>
/// <reference path="./local_database.ts"/>
/// <reference path="./custom_errors.ts"/>

enum HistoryEntryType {
  Insert = 1, Delete = 2, Update = 3
}

class LocalIndex implements Domain {
  id: number;

  constructor(private name: string, private db: local_database.LocalDatabase,
      public dbStorage: DbStorage, public queue: util.JobQueue,
      public tree: IndexTree, public hist: IndexTree,
      public uidGenerator: util.UidGenerator) { }

  ins(value: any, cb: ObjectCb) {
    var insCb = (err: Error) => {
      if (err) return cb(err, null);
      cb(null, key);
    };
    var job = (next: ObjectCb) => {
      key = this.db.next(this.id);
      this.setJob(key, value, next);
    }
    var key;

    if (cb) this.queue.add(insCb, job);
    else this.queue.add(null, job);
  }

  set(key: any, value: any, cb: ObjectCb) {
    var job = (next: ObjectCb) => {
      this.setJob(key, value, next);
    }

    this.queue.add(cb, job);
  }

  del(key: any, cb: ObjectCb) {
    var job = (next: ObjectCb) => {
      this.delJob(key, next);
    };

    this.queue.add(cb, job);
  }

  find(query: any): Cursor {
    return new LocalCursor(this.dbStorage, this.queue, this.tree, query);
  }

  private setJob(key: any, value: any, cb: ObjectCb) {
    var refCb = (err: Error, ref: ObjectRef) => {
      set(ref);
    };
    var set = (ref: ObjectRef) => {
      newValue = ref;
      this.tree.set(key, ref, setCb);
    };
    var setCb = (err: Error, oldValue: any) => {
      var he;
      if (err) return cb(err, null);
      if (this.hist) {
        if (oldValue) {
          if ((oldValue instanceof ObjectRef && !oldValue.equals(newValue)) ||
              oldValue !== newValue) {
            old = oldValue;
            he = [HistoryEntryType.Update, this.id, key, oldValue, newValue];
          }
        } else {
          he = [HistoryEntryType.Insert, this.id, key, newValue];
        }
        if (he) this.saveHistory(he, histCb);
        else cb(null, newValue);
        return;
      }
      cb(null, old);
    };
    var histCb = (err: Error) => {
      if (err) return cb(err, null);
      cb(null, old);
    };

    var old, newValue, type = util.typeOf(value);

    switch (type) {
      // small fixed-length values are stored inline
      case util.ObjectType.ObjectRef:
      case util.ObjectType.Boolean:
      case util.ObjectType.Number:
        set(value);
        break;
      default:
        this.dbStorage.saveIndexData(value, refCb);
        break;
    }
  }

  private delJob(key: any, cb: ObjectCb) {
    var delCb = (err: Error, oldValue: any) => {
      var he;
      if (err) return cb(err, null);
      if (this.hist) {
        if (oldValue) {
          old = oldValue;
          he = [HistoryEntryType.Delete, this.id, key, oldValue];
          return this.saveHistory(he, histCb);
        }
      }
      cb(null, null);
    };
    var histCb = (err: Error) => {
      if (err) return cb(err, null);
      cb(null, old);
    };

    var old;

    this.tree.del(key, delCb);
  }

  private saveHistory(historyEntry, cb: ObjectCb) {
    var key = this.uidGenerator.generate();
    this.hist.set(key, historyEntry, cb);
  }
}

class LocalCursor extends util.Emitter implements Cursor {
  dbStorage: DbStorage;
  queue: util.JobQueue;
  tree: IndexTree;
  query: any;
  closed: boolean;
  started: boolean;
  err: Error;
  nextNodeCb: NextNodeCb;
  thenCb: DoneCb;

  constructor(dbStorage: DbStorage, queue: util.JobQueue, tree: IndexTree,
      query: any) {
    super();
    this.dbStorage = dbStorage;
    this.queue = queue;
    this.tree = tree;
    this.query = query;
    this.closed = false;
    this.started = false;
    this.err = null;
    this.nextNodeCb = null;
    this.thenCb = null;
  }

  all(cb: RowsetCb) {
    var rowCb = (row: Row) => {
      rv.rows.push(row);
      if (this.hasNext()) this.next();
    };
    var endCb = (err: Error) => {
      if (err) return cb(err, null);
      rv.total = this.tree.getCount();
      cb(null, rv);
    };
    var rv = {
      total: 0,
      rows: []
    };

    this.each(rowCb).then(endCb);
  }

  one(cb: RowErrCb) {
    var rowCb = (row: Row) => {
      rv = row;
      this.close();
    };
    var endCb = (err: Error) => {
      if (err) return cb(err, null);
      cb(null, rv);
    };
    var rv;

    this.each(rowCb).then(endCb);
  }

  each(cb: RowCb) {
    var job = (cb) => {
      jobCb = cb;
      this.once('end', endCb);
      this.find(visitCb);
    };
    var visitCb = (err: Error, next: NextNodeCb, key: any, val: any) => {
      this.nextNodeCb = next;
      if (err || !next) return this.emit('end', err);
      this.fetchRow(key, val, fetchRowCb);
    };
    var fetchRowCb = (err: Error, row: Row) => {
      if (err) return this.emit('end', err);
      cb.call(this, row);
    };
    var endCb = (err: Error) => {
      if (err) this.err = err;
      // if (this.hasNext()) this.nextNodeCb(true);
      this.nextNodeCb = null;
      if (this.thenCb) {
        this.thenCb(err);
        this.thenCb = null;
      }
      if (jobCb) {
        jobCb(err);
        jobCb = null
      }
    };
    var jobCb;

    if (this.closed) throw new custom_errors.CursorError('Cursor already closed');
    if (this.started) throw new custom_errors.CursorError('Cursor already started');
    this.started = true;
    this.queue.add(null, job);
    return this;
  }

  then(cb: DoneCb) {
    this.thenCb = cb;
  }

  hasNext(): boolean {
    return !!this.nextNodeCb;
  }

  next() {
    if (!this.hasNext()) throw new custom_errors.CursorError('No more rows');
    this.nextNodeCb();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.emit('end');
  }

  fetchRow(key: any, val: any, cb: RowErrCb) {
    var refCb = (err: Error, obj: any) => {
      if (err) return cb(err, null);
      rv.value = obj;
      cb(null, rv);
    };
    var rv = new IndexRow(key, null, null);

    if (val instanceof ObjectRef) {
      rv.ref = val;
      return this.dbStorage.getIndexData(val, refCb);
    } 

    refCb(null, val);
  }

  private find(cb: VisitKvCb) {
    if (this.query) {
      if (this.query.$eq) return this.findEq(cb);
      if (this.query.$like) return this.findLike(cb);
    }
    this.findRange(cb);
  }

  private findEq(cb: VisitKvCb) {
    var getCb = (err: Error, obj: any) => {
      if (err) return cb(err, null, null, null);
      cb(null, nextCb, this.query.$eq, obj);
    };
    var nextCb = () => cb(null, null, null, null);

    this.tree.get(this.query.$eq, getCb);
  }

  private findLike(cb: VisitKvCb) {
    // 'like' queries are nothing but range queries where we derive
    // the upper key from the '$like' parameter. That is, we find an upper
    // key so that all keys within the resulting range 'start' with the
    // '$like' parameter. It only makes sense for strings and arrays, eg:
    // [1, 2, 3] is starts with [1, 2]
    // 'ab' starts with 'abc'
    var type;
    var gte = new bit_array.BitArray(this.query.$like), lte = gte.clone();

    if ((type = util.typeOf(this.query.$like)) === util.ObjectType.Array) {
      // to properly create the 'upper bound key' for array, we must
      // insert the '1' before its terminator
      lte.rewind(4);
      lte.write(1, 1);
      lte.write(0, 4);
    } else if (type === util.ObjectType.String) {
      lte.write(1, 1);
    } else {
      throw new Error('invalid object type for $like parameter');
    }

    if (this.query.$rev) return this.findRangeDesc(gte, null, lte, null, cb);
    this.findRangeAsc(gte, null, lte, null, cb);
  }

  private findRange(cb: VisitKvCb) {
    var gte, gt, lte, lt;

    if (this.query) {
      gte = this.query.$gte ? new bit_array.BitArray(this.query.$gte) : null;
      gt = this.query.$gt ? new bit_array.BitArray(this.query.$gt) : null;
      lte = this.query.$lte ? new bit_array.BitArray(this.query.$lte) : null;
      lt = this.query.$lt ? new bit_array.BitArray(this.query.$lt) : null;
      if (this.query.$rev) return this.findRangeDesc(gte, gt, lte, lt, cb);
    }

    this.findRangeAsc(gte, gt, lte, lt, cb);
  }

  private findRangeAsc(gte: bit_array.BitArray, gt: bit_array.BitArray, lte: bit_array.BitArray,
      lt: bit_array.BitArray, cb: VisitKvCb) {
    var nodeCb = (err: Error, next: NextNodeCb, node: IndexNode) => {
      var key;
      if (err || !next) return cb(err, null, null, null);
      i++;
      key = node.getKey();
      if (gt && gt.compareTo(key) >= 0) return next();
      if (lt && lt.compareTo(key) <= 0) return next(true);
      if (lte && lte.compareTo(key) < 0) return next(true);
      if (limit && (i > limit + skip)) return next(true);
      if (skip < i) return cb(null, next, key.normalize(), node.getValue());
      next();
    };

    var i = 0;
    var limit, skip = 0;
    
    if (this.query) {
      limit = this.query.$limit;
      skip = this.query.$skip || skip;
    }

    this.tree.inOrder(gte || gt, nodeCb);
  }

  private findRangeDesc(gte: bit_array.BitArray, gt: bit_array.BitArray, lte: bit_array.BitArray,
      lt: bit_array.BitArray, cb: VisitKvCb) {
    var nodeCb = (err: Error, next: NextNodeCb, node: IndexNode) => {
      var key;
      if (err || !next) return cb(err, null, null, null);
      i++;
      key = node.getKey();
      if (lt && lt.compareTo(key) <= 0) return next();
      if (gt && gt.compareTo(key) >= 0) return next(true);
      if (gte && gte.compareTo(key) > 0) return next(true);
      if (limit && (i > limit + skip)) return next(true);
      if (skip < i) return cb(null, next, key.normalize(), node.getValue());
      next();
    };

    var i = 0;
    var limit, skip = 0;
    
    if (this.query) {
      limit = this.query.$limit;
      skip = this.query.$skip || skip;
    }

    this.tree.revInOrder(lte || lt, nodeCb);
  }
}

class HistoryIndex extends LocalIndex {
  constructor(dbStorage: DbStorage, queue: util.JobQueue, tree: IndexTree,
      private master: IndexTree) {
    super(null, null, dbStorage, queue, tree, null, null);
  }

  ins(value: any, cb: ObjectCb) {
    throw new custom_errors.InvalidOperationError(
        "Direct modifications are forbidden on the $history domain");
  }

  set(key: any, value: any, cb: ObjectCb) {
    throw new custom_errors.InvalidOperationError(
        "Direct modifications are forbidden on the $history domain");
  }

  del(key: any, cb: ObjectCb) {
    throw new custom_errors.InvalidOperationError(
        "Direct modifications are forbidden on the $history domain");
  }

  find(query: any): Cursor {
    return new HistoryCursor(this.dbStorage, this.queue, this.tree, query,
        this.master);
  }
}

class HistoryCursor extends LocalCursor {
  constructor(dbStorage: DbStorage, queue: util.JobQueue, tree: IndexTree,
      query, private master: IndexTree) {
    super(dbStorage, queue, tree, query);
  }

  fetchRow(key: any, val: any, cb: RowErrCb) {
    var getDomainNameCb = (err: Error, name: string) => {
      if (err) return cb(err, null);
      rv.domain = name;
      if (getOld) return this.dbStorage.getIndexData(rv.oldRef, getOldCb);
      getOldCb(null, rv.oldValue);
    };
    var getOldCb = (err: Error, value: any) => {
      if (err) return cb(err, null);
      rv.oldValue = value;
      if (getNew) return this.dbStorage.getIndexData(rv.ref, getNewCb);
      getNewCb(null, rv.value);
    };
    var getNewCb = (err: Error, value: any) => {
      if (err) return cb(err, null);
      rv.value = value;
      cb(null, rv);
    };
    var getOld = false, getNew = false;
    var rv = new HistoryRow(new Date(key.getTime()), HistoryEntryType[val[0]],
        null, val[2], null, null, null, null);

    switch (val[0]) {
      case HistoryEntryType.Insert:
        if (val[3] instanceof ObjectRef) {
          getNew = true;
          rv.ref = val[3];
        } else {
          rv.value = val[3];
        }
        break;
      case HistoryEntryType.Delete:
        if (val[3] instanceof ObjectRef) {
          getOld = true;
          rv.oldRef = val[3];
        } else {
          rv.oldValue = val[3];
        }
        break;
      case HistoryEntryType.Update:
        if (val[3] instanceof ObjectRef) {
          getOld = true;
          rv.oldRef = val[3];
        } else {
          rv.oldValue = val[3];
        }
        if (val[4] instanceof ObjectRef) {
          getNew = true;
          rv.ref = val[4];
        } else {
          rv.value = val[4];
        }
        break;
      default:
        throw new custom_errors.CorruptedStateError();
    }

    this.master.get(['names', val[1]], getDomainNameCb);
  }
}

class IndexRow {
  constructor(public key: any, public value: any, public ref: ObjectRef) { }
}

class HistoryRow {
  constructor(public date: Date, public type: string, public domain: string,
      public key: any, public oldValue: any, public oldRef: ObjectRef,
      public value: any, public ref: ObjectRef) { }
}

