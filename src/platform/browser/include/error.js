var injectStackTrace;

if (Error.captureStackTrace) {
  injectStackTrace = function(err) {
    Error.captureStackTrace(err, arguments.callee.caller.caller);
  }
} else {
  injectStackTrace = function(err) {
    err.stackTrace = printStackTrace().slice(6);
    err.stack = err.name + ': ' + err.message;
    for (var i = err.stackTrace;i < err.stackTrace.length;i++) {
      err.stack += err.stackTrace[i];
    }
  }
}
