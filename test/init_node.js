// require('source-map-support').install();
fs = require('fs');
vm = require('vm');
expect = require('chai').expect;

global.exports = {};
global.require = require;
global.include = function(filename) {
  var code = fs.readFileSync(filename) + '';
  vm.runInThisContext(code, filename);
}

include('./lib/archdb.js');
