var platform;
(function (exports) {

  exports.yield = function(fn) {
    window.setImmediate(fn);
  };

})(platform || (platform = {}));
