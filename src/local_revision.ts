/// <reference path="./private_api.ts"/>
/// <reference path="./util.ts"/>
/// <reference path="./local_database.ts"/>
/// <reference path="./avl.ts"/>

var HISTORY = '$history';

class LocalRevision extends Emitter implements Transaction {
  id: Uid;
  db: LocalDatabase;
  dbStorage: DbStorage;
  originalMasterRef: ObjectRef;
  queue: JobQueue;
  uidGenerator: UidGenerator;
  master: IndexTree;
  hist: IndexTree;
  treeCache: any;

  constructor(db: LocalDatabase, dbStorage: DbStorage, masterRef: ObjectRef,
      suffix: string) {
    super();
    var historyCb = (err: Error, tree: IndexTree) => {
      if (err) throw err; // fatal error?
      this.hist = tree
    };

    this.db = db;
    this.dbStorage = dbStorage;
    this.originalMasterRef = masterRef;
    this.uidGenerator = new UidGenerator(suffix);
    this.id = this.uidGenerator.generate();
    this.queue = new JobQueue();
    this.treeCache = {};
    this.master = new AvlTree(dbStorage, masterRef);
    this.hist = new IndexProxy(HISTORY, this.master, dbStorage,
        this.queue, historyCb);
  }

  domain(name: string): Domain {
    switch (name) {
      case '$history': return this.historyDomain();
      default: return this.simpleDomain(name);
    }
  }

  private historyDomain(): Domain {
    var committedCb = () => {
      rv.tree = this.hist;
    };
    var rv = new HistoryIndex(this.dbStorage, this.queue, this.hist,
        this.master);

    this.once('committed', committedCb);
    return rv;
  }

  private simpleDomain(name: string): Domain {
    var getIdJob = (cb: AnyCb) => {
      indexIdKey = ['ids', name];
      this.master.get(indexIdKey, cb);
    };
    var getIdCb = (err: Error, id: number) => {
      if (err) throw err;
      if (!id) {
        id = this.db.next(0);
        indexIdReverseKey = ['names', id];
        this.queue.add(null, setIdJob);
        this.queue.add(null, setIdReverseJob);
      }
      cacheEntry.id = id;
      rv.id = id;
    };
    var setIdJob = (cb: AnyCb) => {
      this.master.set(indexIdKey, cacheEntry.id, cb);
    };
    var setIdReverseJob = (cb: AnyCb) => {
      this.master.set(indexIdReverseKey, name, cb);
    };
    var treeCb = (err: Error, tree: IndexTree) => {
      if (err) throw err;
      cacheEntry.tree = tree;
    };
    var committedCb = () => {
      rv.tree = this.treeCache[name].tree;
    };
    var indexIdKey, indexIdReverseKey;
    var cacheEntry =
      this.treeCache[name] || (this.treeCache[name] =
      { tree: new IndexProxy(name, this.master, this.dbStorage,
          this.queue, treeCb), id: null, name: name });
    var tree = cacheEntry.tree;
    var rv = new LocalIndex(name, this.db, this.dbStorage, this.queue, tree,
        this.hist, this.uidGenerator);
    
    this.once('committed', committedCb);
    if (!cacheEntry.id) this.queue.add(getIdCb, getIdJob);
    rv.id = cacheEntry.id;
    return rv;
  }

  commit(cb: DoneCb) {
    var job = (mergeCb: AnyCb) => {
      this.db.merge(this, mergeCb);
    };
    var mergeCb = (err: Error, refMap: any, hist: IndexTree,
        master: IndexTree) => {
      var index;
      if (err) return cb(err);
      for (var k in refMap) this.treeCache[k] = refMap[k];
      this.hist = hist;
      this.master = master;
      this.originalMasterRef = master.getRootRef();
      this.id = this.uidGenerator.generate();
      this.emit('committed');
      cb(null);
    };

    this.queue.add(mergeCb, job);
  }
}

class IndexProxy implements IndexTree {
  tree: IndexTree; 
  pending: JobQueue;

  constructor(name: string, master: IndexTree, dbStorage: DbStorage,
      queue: JobQueue, cb: AnyCb) {
    var jobCb = (nextJob: AnyCb) => {
      cb = nextJob;
      master.get(['refs', name], getCb);
    };
    var getCb = (err: Error, ref: ObjectRef) => {
      if (err) return cb(err);
      this.tree = new AvlTree(dbStorage, ref);
      if (this.pending) {
        this.pending.add(cb, proxyJob);
        this.pending.frozen = false;
        return this.pending.run();
      }
      cb(null, this.tree);
    };
    var proxyJob = (cb: AnyCb) => {
      // only after all pending proxy invocations are handled we let
      // the transaction queue continue processing
      cb(null, this.tree);
    };

    this.tree = null;
    this.pending = null;
    queue.add(cb, jobCb);
  }

  get(key: any, cb: ObjectCb) {
    var dcb = (tree: IndexTree, cb: AnyCb) => tree.get(key, cb);
    this.delegate(cb, dcb);
  }

  set(key: any, value: any, cb: ObjectCb) {
    var dcb = (tree: IndexTree, cb: AnyCb) => tree.set(key, value, cb);
    this.delegate(cb, dcb);
  }

  del(key: any, cb: ObjectCb) {
    var dcb = (tree: IndexTree, cb: AnyCb) => tree.del(key, cb);
    this.delegate(cb, dcb);
  }

  inOrder(minKey: IndexKey, cb: VisitNodeCb) {
    var dcb = (tree: IndexTree, cb: AnyCb) => tree.inOrder(minKey, cb);
    this.delegate(cb, dcb);
  }

  revInOrder(maxKey: IndexKey, cb: VisitNodeCb) {
    var dcb = (tree: IndexTree, cb: AnyCb) => tree.revInOrder(maxKey, cb);
    this.delegate(cb, dcb);
  }

  commit(releaseCache: boolean, cb: DoneCb) {
    var dcb = (tree: IndexTree, cb: AnyCb) => tree.commit(releaseCache, cb);
    this.delegate(cb, dcb);
  }

  getRootRef(): ObjectRef { return this.tree.getRootRef(); }
  getOriginalRootRef(): ObjectRef { return this.tree.getOriginalRootRef(); }
  setOriginalRootRef(ref: ObjectRef) { this.tree.setOriginalRootRef(ref); }
  modified(): boolean { return this.tree.modified(); }

  private delegate(cb: AnyCb, fn: AnyCb) {
    var jobCb = (cb) => fn(this.tree, cb);

    if (this.tree) return fn(this.tree, cb);
    if (!this.pending) this.pending = new JobQueue(true);
    this.pending.add(cb, jobCb);
  }
}
