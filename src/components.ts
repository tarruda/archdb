declare var nextStack: () => void;

enum DbObjectType {
  IndexNode,
  Document
}

interface DoneCallback { (err: Error); }

interface DbObjectCallback { (err: Error, obj: DbObject); }

interface IdCallback { (err: Error, id: string); }

interface UpdateIndexCallback { (err: Error, oldId: string); }

interface NextNodeCallback { (stop: boolean) }

interface VisitNodeCallback {
  (err: Error, key: IndexKey, id: string, next: NextNodeCallback)
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
  get(key: IndexKey, cb: IdCallback);
  set(key: IndexKey, id: string, cb: UpdateIndexCallback);
  del(key: IndexKey, cb: UpdateIndexCallback);
  inOrder(minKey: IndexKey, cb: VisitNodeCallback);
  revInOrder(maxKey: IndexKey, cb: VisitNodeCallback);
  getRootId(cb: IdCallback);
  setRootId(id: string, cb: DoneCallback);
  commit(cb: DoneCallback);
}

interface DbStorage {
  get(id: string, cb: DbObjectCallback);
  save(obj: DbObject, cb: IdCallback);
  getRootId(cb: IdCallback);
  setRootId(id: string, cb: DoneCallback);
}
