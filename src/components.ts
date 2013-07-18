var yield: (fn: (...params: any[]) => any) => any;

enum DbObjectType {
  IndexNode,
  Document
}

interface DoneCb { (err: Error); }

interface ObjectCb { (err: Error, obj: any); }

interface IdCb { (err: Error, id: string); }

interface NextNodeCb { (stop: boolean) }

interface VisitNodeCb {
  (err: Error, key: IndexKey, id: string, next: NextNodeCb)
}

interface Normalizable {
  normalize(): Object;
}

interface DbObject extends Normalizable {
  getType(): DbObjectType;
}

interface IndexKey extends Normalizable {
  compareTo(other: IndexKey): number;
  normalize(): any;
  clone(): IndexKey;
}

interface DbIndexTree {
  get(key: IndexKey, cb: IdCb);
  set(key: IndexKey, id: string, cb: ObjectCb);
  del(key: IndexKey, cb: ObjectCb);
  inOrder(minKey: IndexKey, cb: VisitNodeCb);
  revInOrder(maxKey: IndexKey, cb: VisitNodeCb);
  commit(cb: DoneCb);
}

interface DbStorage {
  get(id: string, cb: ObjectCb);
  save(obj: DbObject, cb: IdCb);
  getRootId(cb: IdCb);
  setRootId(id: string, cb: DoneCb);
}
