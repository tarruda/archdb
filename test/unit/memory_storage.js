describe('MemoryStorage', function() {
  var mem;

  beforeEach(function() {
    mem = new MemoryStorage();
  });

  it('saves/retrieves objects with unique ids', function(done) {
    mem.saveIndexNode([1, 2, 3], function(err, ref) {
      expect(ref.valueOf()).to.eql(1);
      mem.saveIndexData([4, 5, 6], function(err, ref) {
        expect(ref.valueOf()).to.eql(2);
        mem.getIndexNode(new ObjectRef(1), function(err, obj) {
          expect(obj).to.deep.eql([1, 2, 3]);
          mem.getIndexData(new ObjectRef(2), function(err, obj) {
            expect(obj).to.deep.eql([4, 5, 6]);
            done();
          });
        });
      });
    });
  });
});
