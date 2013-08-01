module platform {
  export declare function yield(fn);

  export declare function injectStackTrace(err: Error);

  export declare class ErrorClass implements Error {
    public name: string;
    public message: string;
    constructor(message?: string);
  }
}
