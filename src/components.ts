var yield: (fn: (...args: any[]) => any) => any;

enum DbObjectType {
  IndexNode,
  Document
}

interface AnyCb { (...args: any[]); }

interface DoneCb { (err: Error); }

interface ObjectCb { (err: Error, obj: any); }

interface RefCb { (err: Error, ref: string); }

interface NextNodeCb { (stop: boolean) }

interface RevisionCb { (err: Error, rev: Revision); }

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
  get(key: IndexKey, cb: ObjectCb);
  set(key: IndexKey, value: Normalizable, cb: ObjectCb);
  del(key: IndexKey, cb: ObjectCb);
  inOrder(minKey: IndexKey, cb: VisitNodeCb);
  revInOrder(maxKey: IndexKey, cb: VisitNodeCb);
  commit(releaseCache: boolean, cb: DoneCb);
}

interface DbStorage {
  get(ref: string, cb: ObjectCb);
  save(obj: DbObject, cb: RefCb);
  getMasterRef(cb: RefCb);
  setMasterRef(ref: string, cb: DoneCb);
}

interface Database {
  checkout(cb: RevisionCb);
}

interface Revision {
}
