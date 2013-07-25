var yield;
var ErrorClass = Error;

function injectStackTrace(err) {
  Error.captureStackTrace(err, arguments.callee.caller.caller);
}

if (setImmediate) {
  yield = function(fn) { setImmediate(fn); }
} else {
  yield = function(fn) { process.nextTick(fn); }
}
