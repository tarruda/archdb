var fs = require('fs');
var dbPath = '.tmpdb';

testDatabase({type: 'local', storage: 'memory'});
testDatabase({type: 'local', storage: 'fs', path: dbPath}, function(cb) {
  if (fs.existsSync(dbPath)) wrench.rmdirSyncRecursive(dbPath);
  fs.mkdirSync(dbPath);
  cb();
});
