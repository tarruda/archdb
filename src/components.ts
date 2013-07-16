declare var nextStack: () => void;

enum DbObjectType {
  IndexNode,
  Document
}

interface DoneCb { (err: Error); }

interface DbObjectCb { (err: Error, obj: DbObject); }

interface IdCb { (err: Error, id: string); }

interface UpdateIndexCb { (err: Error, oldId: string); }

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
  clone(): IndexKey;
}

interface DbIndexTree {
  get(key: IndexKey, cb: IdCb);
  set(key: IndexKey, id: string, cb: UpdateIndexCb);
  del(key: IndexKey, cb: UpdateIndexCb);
  inOrder(minKey: IndexKey, cb: VisitNodeCb);
  revInOrder(maxKey: IndexKey, cb: VisitNodeCb);
  getRootId(cb: IdCb);
  setRootId(id: string, cb: DoneCb);
  commit(cb: DoneCb);
}

interface DbStorage {
  get(id: string, cb: DbObjectCb);
  save(obj: DbObject, cb: IdCb);
  getRootId(cb: IdCb);
  setRootId(id: string, cb: DoneCb);
}
