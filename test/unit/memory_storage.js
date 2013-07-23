describe('MemoryStorage', function() {
  var mem;

  beforeEach(function() {
    mem = new MemoryStorage();
  });

  it('saves/retrieves objects with unique ids', function(done) {
    mem.save(0, [1, 2, 3], function(err, ref) {
      expect(ref).to.eql('1');
      mem.save(0, [4, 5, 6], function(err, ref) {
        expect(ref).to.eql('2');
        mem.get(0, '1', function(err, obj) {
          expect(obj).to.deep.eql([1, 2, 3]);
          mem.get(0, '2', function(err, obj) {
            expect(obj).to.deep.eql([4, 5, 6]);
            done();
          });
        });
      });
    });
  });
});
