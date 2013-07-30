wrench = require('wrench');
fs = require('fs');
path = require('path');

describe('fs_storage', function() {
  var tmpDb = path.resolve('.tmpdb');

  beforeEach(function() {
    if (fs.existsSync(tmpDb)) wrench.rmdirSyncRecursive(tmpDb);
    fs.mkdirSync(tmpDb);
  });

  it('assumes an existing directory', function() {
    wrench.rmdirSyncRecursive(tmpDb);
    expect(function() { new FsStorage({path: tmpDb}); }).to.throw;
  });

  it('get/set', function(done) {
    var storage = new FsStorage({path: tmpDb});
    storage.set('mastetRef', {ref: '0001'}, function(err) {
      storage.get('mastetRef', function(err, obj) {
        expect(obj).to.deep.eql({ref: '0001'});
        done();
      });
    });
  });
  // very slow test, only here to verify messagepack decoding
  // of objects bigger than 4096 bytes
  it.skip('save and restore 100000 keys map', function(done) {
    this.timeout(600000);
    var storage = new FsStorage({path: tmpDb});
    storage.saveIndexData(solid100000, function(err, ref) {
      storage.getIndexData(ref, function(err, obj) {
        expect(obj).to.deep.eql(solid100000);
        done();
      });
    });
  });
});
