(function (platform) {
  if (typeof setImmediate === 'function') {
    platform.yield = setImmediate;
  } else {
    platform.yield = function(fn) { process.nextTick(fn); }
  }
})(platform || (platform = {}));
