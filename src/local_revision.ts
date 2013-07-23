/// <reference path="./components.ts"/>
/// <reference path="./util.ts"/>
/// <reference path="./local_database.ts"/>
/// <reference path="./avl.ts"/>

var HISTORY = '$history';

class LocalRevision implements Transaction {
  db: LocalDatabase;
  dbStorage: DbStorage;
  parentMasterRef: string;
  queue: JobQueue;
  uidGenerator: UidGenerator;
  master: IndexTree;
  history: IndexTree;
  treeCache: any;
  parentRevision: any;

  constructor(db: LocalDatabase, dbStorage: DbStorage, masterRef: string,
      uidSuffix: string) {
    var historyCb = (err: Error, tree: IndexTree) => {
      if (err) throw err; // fatal error?
      this.history = tree
    };

    this.db = db;
    this.dbStorage = dbStorage;
    this.parentMasterRef = masterRef;
    this.uidGenerator = new UidGenerator(uidSuffix);
    this.queue = new JobQueue();
    this.treeCache = {};
    this.parentRevision = {};
    this.master = new AvlTree(dbStorage, masterRef);
    this.history = new IndexPromise(HISTORY, this.master, dbStorage,
        this.queue, historyCb);
  }

  domain(name: string): Domain {
    var idCb = (err: Error, id: number) => {
    
    };
    var treeCb = (err: Error, tree: IndexTree) => {
      if (err) throw err;
      this.treeCache[name] = tree;
    };

    var tree = this.treeCache[name] || this.treeCache[name] = new IndexPromise(
          name, this.master, this.dbStorage, this.queue, treeCb);

    return new LocalIndex(name, this.dbStorage, this.queue, tree,
        this.history, this.uidGenerator);
  }

  commit(cb: DoneCb) {
  }
}

class IndexPromise implements IndexTree {
  tree: IndexTree; 
  pending: JobQueue;

  constructor(name: string, master: IndexTree, dbStorage: DbStorage,
      queue: JobQueue, cb: AnyCb) {
    var jobCb = (nextJob: AnyCb) => {
      cb = nextJob;
      master.get(new BitArray(['refs', name]), getCb);
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

  get(key: IndexKey, cb: ObjectCb) {
    var dcb = (tree: IndexTree, cb: AnyCb) => tree.get(key, cb);
    this.delegate(cb, dcb);
  }

  set(key: IndexKey, value: any, cb: ObjectCb) {
    var dcb = (tree: IndexTree, cb: AnyCb) => tree.set(key, value, cb);
    this.delegate(cb, dcb);
  }

  del(key: IndexKey, cb: ObjectCb) {
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

  private delegate(cb: AnyCb, fn: AnyCb) {
    var jobCb = (cb) => fn(this.tree, cb);

    if (this.tree) return fn(this.tree, cb);
    if (!this.pending) this.pending = new JobQueue(true);
    this.pending.add(cb, jobCb);
  }
}
