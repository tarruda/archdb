module archdb {
  export enum DbObjectType {
    IndexNode,
    Document
  }

  export interface DbObject {
    get namespace(): string;
    get type(): DbObjectType;
  }

  export interface DoneCallback { (err?: Error); }

  export interface DbObjectCallback { (err?: Error, obj: DbObject); }

  export interface IdCallback { (err?: Error, id: string); }

  export interface DbStorage {
    get(id: string, cb: DbObjectCallback);

    save(obj: DbObject, cb: IdCallback);

    get rootId(cb: IdCallback);

    set rootId(id: string, cb: DoneCallback);
  }
}
