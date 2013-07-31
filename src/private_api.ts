/// <reference path="./api.ts"/>

var yield: (fn: (...args: any[]) => any) => any;

interface PredicateCb { (obj: any): boolean; }

interface RefCb { (err: Error, ref: ObjectRef); }

interface NextNodeCb { (stop?: boolean) }

interface VisitNodeCb {
  (err: Error, next: NextNodeCb, node: IndexNode)
}

interface VisitKvCb {
  (err: Error, next: NextNodeCb, key: any, value: any);
}

interface MergeCb {
  (err: Error, refMap: any, history: IndexTree, master: IndexTree);
}

interface IndexNode {
  getKey(): IndexKey;
  getValue(): any;
}

interface IndexKey {
  compareTo(other: IndexKey): number;
  normalize(): any;
  clone(): IndexKey;
}

interface IndexTree {
  get(key: any, cb: ObjectCb);
  set(key: any, value: any, cb: ObjectCb);
  del(key: any, cb: ObjectCb);
  getCount(): number;
  inOrder(minKey: IndexKey, cb: VisitNodeCb);
  revInOrder(maxKey: IndexKey, cb: VisitNodeCb);
  commit(releaseCache: boolean, cb: DoneCb);
  getRootRef(): ObjectRef;
  getOriginalRootRef(): ObjectRef;
  setOriginalRootRef(ref: ObjectRef);
  modified(): boolean;
}

interface DbStorage {
  set(key: string, val: any, cb: DoneCb);
  get(key: string, cb: ObjectCb);
  saveIndexNode(obj: any, cb: RefCb);
  getIndexNode(ref: ObjectRef, cb: ObjectCb);
  saveIndexData(obj: any, cb: RefCb);
  getIndexData(ref: ObjectRef, cb: ObjectCb);
  flush(cb: DoneCb);
  close(cb: DoneCb);
}
