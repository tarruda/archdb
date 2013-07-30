// thanks to http://stackoverflow.com/questions/12915412/how-do-i-extend-a-host-object-e-g-error-in-typescript
declare function injectStackTrace(err: Error);
declare class ErrorClass implements Error {
  public name: string;
  public message: string;
  constructor(message?: string);
}

class DbError extends ErrorClass {
  name = 'DbError';

  constructor(public message?: string) {
    super(message);
    injectStackTrace(this);
  }
}

class InvalidOperationError extends DbError {
  name = 'InvalidOperationError';

  constructor(message: string) {
    super(message || 'This operation is invalid in this context');
  }
}

class ConflictError extends DbError {
  name = 'ConflictError';

  constructor(public conflicts: any) {
    super('One or more values were updated after read in the transaction');
  }
}

class FatalError extends DbError {
  name = 'FatalError';

  constructor(message: string) {
    super(message || 'Fatal error!');
  }
}
