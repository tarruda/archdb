describe('MemoryStorage', function() {
  var mem;

  beforeEach(function() {
    mem = new MemoryStorage();
  });

  it('saves/retrieves objects with unique ids', function(done) {
    mem.save([1, 2, 3], function(err, id) {
      expect(id).to.eql('1');
      mem.save([4, 5, 6], function(err, id) {
        expect(id).to.eql('2');
        mem.get('1', function(err, obj) {
          expect(obj).to.deep.eql([1, 2, 3]);
          mem.get('2', function(err, obj) {
            expect(obj).to.deep.eql([4, 5, 6]);
            done();
          });
        });
      });
    });
  });

  it('gets/sets root node id', function(done) {
    mem.setRootId('10', function() {
      mem.getRootId(function(err, id) {
        expect(id).to.eql('10');
        done();
      });
    });
  });
});
