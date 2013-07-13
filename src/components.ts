enum DbObjectType {
  IndexNode,
  Document
}

interface Normalizable {
  normalize(): Object;
}

interface DbObject extends Normalizable {
  getNamespace(): string;
  getType(): DbObjectType;
}

interface IndexKey extends Normalizable {
  compareTo(other: IndexKey): number;
}

interface DoneCallback { (err: Error); }

interface DbObjectCallback { (err: Error, obj: DbObject); }

interface IdCallback { (err: Error, id: string); }

interface DbStorage {
  get(id: string, cb: DbObjectCallback);
  save(obj: DbObject, cb: IdCallback);
  getRootId(cb: IdCallback);
  setRootId(id: string, cb: DoneCallback);
}
