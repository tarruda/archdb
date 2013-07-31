interface EmptyCb { (): void; }

interface AnyCb { (...args: any[]); }

interface DoneCb { (err: Error); }

interface RowCb { (row: Row); }

interface RowErrCb { (err: Error, row: Row); }

interface RowArrayCb { (err: Error, array: Array<Row>); }

interface ObjectCb { (err: Error, obj: any); }

interface TransactionCb { (err: Error, tx: Transaction); }

interface Connection {
  begin(cb: TransactionCb);
  close(cb: DoneCb);
}

interface Transaction {
  domain(name: string): Domain;
  commit(cb: DoneCb);
}

interface Domain {
  ins(value: any, cb: ObjectCb);
  set(key: any, value: any, cb: ObjectCb);
  del(key: any, cb: ObjectCb);
  find(query: any): Cursor;
}

interface Cursor {
  all(cb: RowArrayCb);
  one(cb: RowErrCb);
  each(eachCb: RowCb);
  then(cb: DoneCb);
  hasNext(): boolean;
  next();
  close();
}

interface Row {
  key: any;
  value: any;
  ref: ObjectRef;
}

class ObjectRef {
  val;

  constructor(refVal: any) {
    this.val = refVal;
  }

  valueOf() {
    return this.val;
  }

  equals(other: ObjectRef) {
    if (!(other instanceof ObjectRef)) return false;
    return this.valueOf() === other.valueOf();
  }
}
