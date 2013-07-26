/// <reference path="./private_api.ts"/>
/// <reference path="./api.ts"/>
/// <reference path="./util.ts"/>

enum HistoryEntryType {
  Insert = 1, Delete = 2, Update = 3
}

class LocalIndex implements Domain {
  id: number;

  constructor(private name: string,
      public dbStorage: DbStorage, public queue: JobQueue,
      public tree: IndexTree, public hist: IndexTree,
      public uidGenerator: UidGenerator) { }

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
    var refCb = (err: Error, ref: string) => {
      set(new ObjectRef(ref));
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
          old = oldValue;
          he = [HistoryEntryType.Update, this.id, key, oldValue, newValue];
        } else {
          he = [HistoryEntryType.Insert, this.id, key, newValue];
        }
        return this.saveHistory(he, histCb);
      }
      cb(null, old);
    };
    var histCb = (err: Error) => {
      if (err) return cb(err, null);
      cb(null, old);
    };

    var old, newValue, type = typeOf(value);

    switch (type) {
      // small fixed-length values are stored inline
      case ObjectType.ObjectRef:
      case ObjectType.Boolean:
      case ObjectType.Number:
        set(value);
        break;
      default:
        this.dbStorage.save(DbObjectType.IndexData, value, refCb);
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

class LocalCursor extends Emitter implements Cursor {
  dbStorage: DbStorage;
  queue: JobQueue;
  tree: IndexTree;
  query: any;
  closed: boolean;
  paused: boolean;
  err: Error;

  constructor(dbStorage: DbStorage, queue: JobQueue, tree: IndexTree,
      query: any) {
    super();
    this.dbStorage = dbStorage; 
    this.queue = queue;
    this.tree = tree;
    this.query = query;
    this.closed = false;
    this.paused = false;
    this.err = null;
  }

  each(rowCb: RowCb, cb: DoneCb) {
    var jobCb = (cb) => {
      this.once('close', cb);
      this.find(visitCb);
    };
    var visitCb = (err: Error, next: NextNodeCb, k: any, v: any) => {
      if (err || !next) {
        this.err = err;
        return this.close();
      }
      nextCb = next;
      key = k;
      value = v;
      if (value instanceof ObjectRef) this.dbStorage.get(
          DbObjectType.IndexData, value.ref, refCb);
      else refCb(null, value);
    };
    var refCb = (err: Error, obj: any) => {
      var row;
      if (value instanceof ObjectRef) row = new Row(key, obj, value)
      else row = new Row(key, value, null);
      rowCb(row);
      if (this.closed) return nextCb(true);
      if (this.paused) return this.once('resume', nextCb);
      nextCb();
    };

    var key, value, nextCb;

    if (this.closed) throw new Error('Cursor is closed');

    this.queue.add(cb, jobCb);
  }

  all(cb: RowArrayCb) {
    var rowCb = (row: Row) => rv.push(row);
    var doneCb = (err: Error) => {
      if (err) return cb(err, null);
      cb(null, rv);
    };

    var rv: Array<Row> = [];

    this.each(rowCb, doneCb);
  }

  one(cb: RowErrCb) {
    var rowCb = (row: Row) => {
      rv = row;
      this.close();
    };
    var doneCb = (err: Error) => {
      if (err) return cb(err, null);
      cb(null, rv);
    };

    var rv;

    this.each(rowCb, doneCb);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.emit('close', this.err);
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.emit('resume');
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
    var gte = new BitArray(this.query.$like), lte = gte.clone();

    if ((type = typeOf(this.query.$like)) === ObjectType.Array) {
      // to properly create the 'upper bound key' for array, we must
      // insert the '1' before its terminator
      lte.rewind(4);
      lte.write(1, 1);
      lte.write(0, 4);
    } else if (type === ObjectType.String) {
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
      gte = this.query.$gte ? new BitArray(this.query.$gte) : null;
      gt = this.query.$gt ? new BitArray(this.query.$gt) : null;
      lte = this.query.$lte ? new BitArray(this.query.$lte) : null;
      lt = this.query.$lt ? new BitArray(this.query.$lt) : null;
      if (this.query.$rev) return this.findRangeDesc(gte, gt, lte, lt, cb);
    }

    this.findRangeAsc(gte, gt, lte, lt, cb);
  }

  private findRangeAsc(gte: BitArray, gt: BitArray, lte: BitArray,
      lt: BitArray, cb: VisitKvCb) {
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

  private findRangeDesc(gte: BitArray, gt: BitArray, lte: BitArray,
      lt: BitArray, cb: VisitKvCb) {
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
