fs = require('fs')
path = require('path')
wrench = require('wrench')

FsStorage = require('../../platform/nodejs/fs_storage')


tmpDb = path.resolve('.tmpDb')


suite =
  'fs_storage':
    beforeEach: ->
      if fs.existsSync(tmpDb)
        wrench.rmdirSyncRecursive(tmpDb)

      fs.mkdirSync(tmpDb)


    'assumes an existing directory': ->
      wrench.rmdirSyncRecursive(tmpDb)
      expect( -> new FsStorage(path: tmpDb)).to.throw


    'get/set': (done) ->
      storage = new FsStorage(path: tmpDb)
      storage.open((err) =>
        storage.set('mastetRef', ref: '0001', (err) =>
          storage.get('mastetRef', (err, obj) =>
            expect(obj).to.deep.eql(ref: '0001')
            done())))


    # this slow test is skipped. this is only here to verify messagepack
    # decoding of objects bigger than 4096 bytes when changes are made
    # to the msgpack module
    'skip:save and restore 100000 keys map': (done) ->
      @timeout(600000)
      storage = new FsStorage(path: tmpDb)
      storage.saveIndexData(solid100000, (err, ref) =>
        storage.getIndexData(ref, (err, obj) =>
          expect(obj).to.deep.eql(solid100000)
          done()))


run(suite)

