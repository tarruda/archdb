MemoryStorage = require('../src/memory_storage')
{ObjectRef} = require('../src/util')


tests =
  'MemoryStorage':
    beforeEach: ->
      @mem = new MemoryStorage()

    'saves/retrieves objects with unique ids': (done) ->
      @mem.saveIndexNode([1, 2, 3], (err, ref) =>
        expect(ref.valueOf()).to.eql(1)
        @mem.saveIndexData([4, 5, 6], (err, ref) =>
          expect(ref.valueOf()).to.eql(2)
          @mem.getIndexNode(new ObjectRef(1), (err, obj) =>
            expect(obj).to.deep.eql([1, 2, 3])
            @mem.getIndexData(new ObjectRef(2), (err, obj) =>
              expect(obj).to.deep.eql([4, 5, 6])
              done()
            )
          )
        )
      )


run(tests)
