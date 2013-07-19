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
  get(key: IndexKey, cb: ObjectCb) {}
  set(key: IndexKey, value: Normalizable, cb: ObjectCb) {}
  del(key: IndexKey, cb: ObjectCb) {}
  inOrder(minKey: IndexKey, cb: VisitNodeCb) {}
  revInOrder(maxKey: IndexKey, cb: VisitNodeCb) {}
  commit(releaseCache: boolean, cb: DoneCb) {}
}
