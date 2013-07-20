/// <reference path="./components.ts"/>
/// <reference path="./util.ts"/>
/// <reference path="./local_database.ts"/>
/// <reference path="./avl.ts"/>

class LocalRevision {
  db: LocalDatabase;
  parentMasterRef: string;
  queue: JobQueue;
  uidGenerator: UidGenerator;
  master: AvlTree;

  constructor(db: LocalDatabase, masterRef: string, uidSuffix: string) {
    this.db = db;
    this.parentMasterRef = masterRef;
    this.uidGenerator = new UidGenerator(uidSuffix);
    this.queue = new JobQueue();
    this.master = new AvlTree(db.storage, masterRef);
  }
}

class IndexPromise implements DbIndexTree {
  constructor(private name: string, private rev: Revision, private cb: AnyCb) {
    var job = () => {
    };
  }
  get(key: IndexKey, cb: ObjectCb) {}
  set(key: IndexKey, value: Normalizable, cb: ObjectCb) {}
  del(key: IndexKey, cb: ObjectCb) {}
  inOrder(minKey: IndexKey, cb: VisitNodeCb) {}
  revInOrder(maxKey: IndexKey, cb: VisitNodeCb) {}
  commit(releaseCache: boolean, cb: DoneCb) {}
}
