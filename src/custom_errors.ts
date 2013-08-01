/// <reference path="./platform.ts"/>

module custom_errors {
  // thanks to http://stackoverflow.com/questions/12915412/how-do-i-extend-a-host-object-e-g-error-in-typescript

  export class DbError extends platform.ErrorClass {
    name = 'DbError';

    constructor(public message?: string) {
      super(message);
      platform.injectStackTrace(this);
    }
  }

  export class InvalidOperationError extends DbError {
    name = 'InvalidOperationError';

    constructor(message: string) {
      super(message || 'This operation is invalid in this context');
    }
  }

  export class ConflictError extends DbError {
    name = 'ConflictError';

    constructor(public conflicts: any) {
      super('One or more values were updated after read in the transaction');
    }
  }

  export class CursorError extends DbError {
    name = 'CursorError';

    constructor(message: string) {
      super(message);
    }
  }

  export class FatalError extends DbError {
    name = 'FatalError';

    constructor(message: string) {
      super(message || 'Fatal error!');
    }
  }

  export class CorruptedStateError extends FatalError {
    name = 'CorruptedStateError';

    constructor() {
      super('Sorry but the database seems to be corrupted!');
    }
  }
}
