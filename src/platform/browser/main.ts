var ErrorClass = Error;

declare function printStackTrace(): Array;

interface Err { stackTrace: Array; }

function yield(fn: () => any) {
  window.setImmediate(fn);
}

