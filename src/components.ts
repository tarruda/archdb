/// <reference path="./public_components.ts"/>

var yield: (fn: (...args: any[]) => any) => any;

enum DbObjectType {
  Other = 0,
  IndexNode = 1,
  IndexData = 2
}

interface EmptyCb { (): void; }

interface AnyCb { (...args: any[]); }

interface PredicateCb { (obj: any): boolean; }

interface RefCb { (err: Error, ref: string); }

interface NextNodeCb { (stop?: boolean) }

interface VisitNodeCb {
  (err: Error, next: NextNodeCb, node: IndexNode)
}

interface VisitKvCb {
  (err: Error, next: NextNodeCb, key: any, value: any);
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
  get(key: IndexKey, cb: ObjectCb);
  set(key: IndexKey, value: any, cb: ObjectCb);
  del(key: IndexKey, cb: ObjectCb);
  inOrder(minKey: IndexKey, cb: VisitNodeCb);
  revInOrder(maxKey: IndexKey, cb: VisitNodeCb);
  commit(releaseCache: boolean, cb: DoneCb);
  getRootRef(): string;
  getOriginalRootRef(): string;
  setOriginalRootRef(ref: string);
  modified(): boolean;
}

interface DbStorage {
  get(type: DbObjectType, ref: string, cb: ObjectCb);
  set(type: DbObjectType, ref: string, obj: any, cb: ObjectCb);
  save(type: DbObjectType, obj: any, cb: RefCb);
}
