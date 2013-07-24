/// <reference path="./components.ts"/>
/// <reference path="./util.ts"/>
/// <reference path="./local_database.ts"/>
/// <reference path="./avl.ts"/>

var HISTORY = '$history';

class LocalRevision implements Transaction {
  id: Uid;
  db: LocalDatabase;
  dbStorage: DbStorage;
  originalMasterRef: string;
  queue: JobQueue;
  uidGenerator: UidGenerator;
  master: IndexTree;
  history: IndexTree;
  treeCache: any;

  constructor(db: LocalDatabase, dbStorage: DbStorage, masterRef: string,
      suffix: string) {
    var historyCb = (err: Error, tree: IndexTree) => {
      if (err) throw err; // fatal error?
      this.history = tree
    };

    this.db = db;
    this.dbStorage = dbStorage;
    this.originalMasterRef = masterRef;
    this.uidGenerator = new UidGenerator(suffix);
    this.id = this.uidGenerator.generate();
    this.queue = new JobQueue();
    this.treeCache = {};
    this.master = new AvlTree(dbStorage, masterRef);
    this.history = new IndexProxy(HISTORY, this.master, dbStorage,
        this.queue, historyCb);
  }

  domain(name: string): Domain {
    var getIdJob = (cb: AnyCb) => {
      indexIdKey = ['ids', name];
      this.master.get(indexIdKey, cb);
    };
    var getIdCb = (err: Error, id: number) => {
      if (err) throw err;
      if (!id) {
        id = this.db.next(0);
        this.queue.add(null, setIdJob);
      }
      cacheEntry.id = id;
      rv.id = id;
    };
    var setIdJob = (cb: AnyCb) => {
      this.master.set(indexIdKey, cacheEntry.id, cb);
    };
    var treeCb = (err: Error, tree: IndexTree) => {
      if (err) throw err;
      cacheEntry.tree = tree;
    };
    var rv, indexIdKey;
    var cacheEntry =
      this.treeCache[name] || (this.treeCache[name] =
      { tree: new IndexProxy(name, this.master, this.dbStorage,
          this.queue, treeCb), id: null, name: name });
    var tree = cacheEntry.tree;
    
    if (!cacheEntry.id) this.queue.add(getIdCb, getIdJob);
    rv = new LocalIndex(name, this.dbStorage, this.queue, tree,
        this.history, this.uidGenerator);
    rv.id = cacheEntry.id;
    return rv;
  }

  commit(cb: DoneCb) {
    var mergeCb = (err: Error, refMap: any, history: IndexTree,
        master: IndexTree) => {
      var index;
      if (err) return cb(err);
      for (var k in refMap) this.treeCache[k] = refMap[k];
      this.history = history;
      this.master = master;
      cb(null);
    };

    this.db.merge(this, mergeCb);
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
    var getCb = (err: Error, ref: string) => {
      if (err) return cb(err);
      this.tree = new AvlTree(dbStorage, ref);
      if (this.pending) {
        this.pending.frozen = false;
        this.pending.run();
      }
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

  getRootRef(): string { return this.tree.getRootRef(); }
  getOriginalRootRef(): string { return this.tree.getOriginalRootRef(); }
  setOriginalRootRef(ref: string) { this.tree.setOriginalRootRef(ref); }
  modified(): boolean { return this.tree.modified(); }

  private delegate(cb: AnyCb, fn: AnyCb) {
    var jobCb = (cb) => fn(this.tree, cb);

    if (this.tree) return fn(this.tree, cb);
    if (!this.pending) this.pending = new JobQueue(true);
    this.pending.add(cb, jobCb);
  }
}
