/// <reference path="./components.ts"/>
/// <reference path="./util.ts"/>

class Revision {
  queue: JobQueue;
}

class IndexPromise implements DbIndexTree {
  constructor(private name: string, private rev: Revision, private cb: AnyCb) {
    var job = () => {
    };
  }
  get(key: IndexKey, cb: IdCb) {}
  set(key: IndexKey, id: string, cb: ObjectCb) {}
  del(key: IndexKey, cb: ObjectCb) {}
  inOrder(minKey: IndexKey, cb: VisitNodeCb) {}
  revInOrder(maxKey: IndexKey, cb: VisitNodeCb) {}
  commit(cb: DoneCb) {}
}
