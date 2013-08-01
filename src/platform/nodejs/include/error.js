var platform;
(function (exports) {
  exports.ErrorClass = Error;

  exports.injectStackTrace = function(err) {
    Error.captureStackTrace(err, arguments.callee.caller.caller);
  }
})(platform || (platform = {}));
