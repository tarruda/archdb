var platform;
(function (exports) {
  exports.ErrorClass = Error;

  if (Error.captureStackTrace) {
    exports.injectStackTrace = function(err) {
      Error.captureStackTrace(err, arguments.callee.caller.caller);
    }
  } else {
    exports.injectStackTrace = function(err) {
      // no-op
    }
  }

})(platform || (platform = {}));
