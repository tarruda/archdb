enum DbObjectType {
  IndexNode,
  Document
}

interface DbObject {
  getNamespace(): string;
  getType(): DbObjectType;
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
