wrench = require('wrench');
fs = require('fs');
path = require('path');

describe('fs_storage', function() {
  var tmpDb = path.resolve('.tmpdb');

  beforeEach(function() {
    if (fs.existsSync(tmpDb)) wrench.rmdirSyncRecursive(tmpDb);
  });

  it('assumes an existing directory', function() {
    expect(function() { new FsStorage({path: tmpDb}); }).to.throw;
  });
});
