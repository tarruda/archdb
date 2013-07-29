interface DoneCb { (err: Error); }

interface RowCb { (record: Row); }

interface RowErrCb { (err: Error, record: Row); }

interface RowArrayCb { (err: Error, array: Array<Row>); }

interface ObjectCb { (err: Error, obj: any); }

interface TransactionCb { (err: Error, tc: Transaction); }

interface Connection {
  begin(cb: TransactionCb);
}

interface Transaction {
  domain(name: string): Domain;
  commit(cb: DoneCb);
}

interface Domain {
  set(key: any, value: any, cb: ObjectCb);
  del(key: any, cb: ObjectCb);
  find(query: any): Cursor;
}

interface Cursor {
  each(eachCb: RowCb, cb: DoneCb);
  all(cb: RowArrayCb);
  one(cb: RowErrCb);
  pause();
  resume();
  close();
}

interface Row {
  key: any;
  value: any;
  ref: ObjectRef;
}
