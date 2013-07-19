var yield: (fn: (...args: any[]) => any) => any;

enum DbObjectType {
  IndexNode,
  Document
}

interface AnyCb { (...args: any[]); }

interface DoneCb { (err: Error); }

interface ObjectCb { (err: Error, obj: any); }

interface IdCb { (err: Error, id: string); }

interface NextNodeCb { (stop: boolean) }

interface VisitNodeCb {
  (err: Error, next: NextNodeCb, node: IndexNode)
}

interface Normalizable {
  normalize(): Object;
}

interface DbObject extends Normalizable {
  getType(): DbObjectType;
}

interface IndexNode extends DbObject {
  getKey(): IndexKey;
  getValue(): any;
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
  getMasterRootId(cb: IdCb);
  setMasterRootId(id: string, cb: DoneCb);
}
