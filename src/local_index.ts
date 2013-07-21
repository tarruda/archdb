/// <reference path="./components.ts"/>
/// <reference path="./public_components.ts"/>
/// <reference path="./util.ts"/>

class LocalIndex implements Index {
  constructor(private dbStorage: DbStorage, private queue: JobQueue,
      private tree: DbIndexTree, private history: DbIndexTree) { }

  set(key: any, value: any, cb: ObjectCb) {
    var job = (cb: ObjectCb) => { this.setJob(key, value, cb); }

    this.queue.add(cb, job);
  }

  del(key: any, cb: ObjectCb) {
    var job = (cb: ObjectCb) => { this.delJob(key, cb); }

    this.queue.add(cb, job);
  }

  setJob(key: any, value: any, cb: ObjectCb) { }

  delJob(key: any, cb: ObjectCb) { }

  find(query: any): Cursor {
    return new LocalCursor(this.dbStorage, this.queue, this.tree, query);
  }
}

class LocalCursor extends EventEmitter implements Cursor {
  dbStorage: DbStorage;
  queue: JobQueue;
  tree: DbIndexTree;
  query: any;
  queryEq: any;
  closed: boolean;
  paused: boolean;
  err: Error;

  constructor(dbStorage: DbStorage, queue: JobQueue, tree: DbIndexTree,
      query: any) {
    super();
    this.dbStorage = dbStorage; 
    this.queue = queue;
    this.tree = tree;
    this.query = query;
    this.closed = false;
    this.paused = false;
    this.err = null;
    this.queryEq = null;
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
      if (value instanceof ObjectRef) this.dbStorage.get(value.ref, refCb);
      else refCb(null, value);
    };
    var refCb = (err: Error, obj: any) => {
      rowCb(new Row(key, obj, value));
      if (this.closed) return nextCb(true);
      if (this.paused) return this.once('resume', nextCb);
      nextCb();
    };

    var key, value, nextCb;

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

    this.queryEq = this.query.$eq;
    this.tree.get(new BitArray(this.query.$eq), getCb);
  }

  private findLike(cb: VisitKvCb) {
    // 'like' queries are nothing but range queries where we derive
    // the upper key from the '$like' parameter, that is, we find an upper
    // key so that all keys within the resulting range 'start' with the
    // '$like' parameter
    var gte = new BitArray(this.query.$like), lte = gte.clone();

    if (Array.isArray(this.query.$like)) {
      // to properly create the 'upper bound key' for array, we must
      // insert the '1' before its terminator
      lte.rewind(4);
      lte.write(1, 1);
      lte.write(0, 4);
    } else {
      lte.write(1, 1);
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
      i++;
      key = node.getKey();
      if (err || !next) return cb(err, null, null, null);
      if (gt && gt.compareTo(key) >= 0) return next();
      if (lt && lt.compareTo(key) <= 0) return next(true);
      if (lte && lte.compareTo(key) < 0) return next(true);
      if (limit && (i > limit + skip)) return next(true);
      if (skip < i) return cb(null, next, key, node.getValue());
      next();
    };

    var i = 0;
    var limit = this.query.$limit, skip = this.query.$skip || 0;

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
      if (skip < i) return cb(null, next, key, node.getValue());
      next();
    };

    var i = 0;
    var limit = this.query.$limit, skip = this.query.$skip || 0;

    this.tree.revInOrder(lte || lt, nodeCb);
  }
}
