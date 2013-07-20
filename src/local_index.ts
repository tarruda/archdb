/// <reference path="./components.ts"/>
/// <reference path="./util.ts"/>

class LocalIndex {
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

  find(query: Object) {
    return new Cursor(this.dbStorage, this.queue, this.tree, query);
  }
}

class LocalCursor {
  dbStorage: DbStorage;
  queue: JobQueue;
  tree: DbIndexTree;
  query: Object;
  closed: boolean;
  paused: boolean;
  nextJobCb: AnyCb;
  doneCb: DoneCb;
  runCb: EmptyCb; 
  err: Error;

  constructor(dbStorage: DbStorage, queue: JobQueue, tree: DbIndexTree,
      query: Object) {
    this.dbStorage = dbStorage; 
    this.queue = queue;
    this.tree = tree;
    this.query = query;
    this.closed = false;
    this.paused = false;
    this.nextJobCb = null;
    this.doneCb = null;
    this.runCb = null;
    this.err = null;
  }

  each(cb: KVCb) {
    var job = (cb) => {
      this.nextJobCb = cb;
      this.find(visitCb);
    };
    var visitCb = (err: Error, next: NextNodeCb, node: IndexNode) => {
      if (err) {
        this.err = err;
        this.close();
        this.done
      
      }
    
    };
  
  }

  private find(visitCb: VisitNodeCb) {
    if (this.query) {
      if (this.query.$eq) return this.findEq(cb);
      if (this.query.$like) return this.findLike(cb);
    }
    findRange(cb);
  }
}
