function testDatabase(options) {
  var suiteName = options.type + ' database with ' + options.storage +
    ' storage';

  describe(suiteName, function() {
    var db, tx;
    var domain1 = 'test1', domain2 = 'test2';
    var dom1, dom2;

    describe('query', function() {
      describe('ranges', function() {
        beforeEach(function(done) {
          openDatabase(options, function(err, database) {
            if (err) return done(err);
            db = database;
            db.begin(function(err, transaction) {
              tx = transaction;
              dom1 = tx.domain(domain1);
              dom1.set(1, 'test1');
              dom1.set(2, 'test2');
              dom1.set(3, 'test3');
              dom1.set(4, 'test4');
              dom1.set(5, 'test5');
              dom1.set(6, 'test6');
              dom1.set(7, 'test7');
              tx.commit(function(err){
                if (err) return done(err);
                done();
              });
            });
          });
        });

        it('in default order', function(done) {
          query(dom1, null, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              1, 'test1',
              2, 'test2',
              3, 'test3',
              4, 'test4',
              5, 'test5',
              6, 'test6',
              7, 'test7',
            ]);
            done();
          });
        });

        it('in reverse order', function(done) {
          query(dom1, {$rev: true}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              7, 'test7',
              6, 'test6',
              5, 'test5',
              4, 'test4',
              3, 'test3',
              2, 'test2',
              1, 'test1',
            ]);
            done();
          });
        });

        it('filter gte in default order', function(done) {
          query(dom1, {$gte: 4}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              4, 'test4',
              5, 'test5',
              6, 'test6',
              7, 'test7',
            ]);
            done();
          });
        });

        it('filter gt in default order', function(done) {
          query(dom1, {$gt: 4}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              5, 'test5',
              6, 'test6',
              7, 'test7',
            ]);
            done();
          });
        });

        it('filter lte in reverse order', function(done) {
          query(dom1, {$rev: true, $lte: 5}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              5, 'test5',
              4, 'test4',
              3, 'test3',
              2, 'test2',
              1, 'test1',
            ]);
            done();
          });
        });

        it('filter lt in reverse order', function(done) {
          query(dom1, {$rev: true, $lt: 5}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              4, 'test4',
              3, 'test3',
              2, 'test2',
              1, 'test1',
            ]);
            done();
          });
        });

        it('filter gte/lte in default order', function(done) {
          query(dom1, {$gte: 3, $lte: 6}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              3, 'test3',
              4, 'test4',
              5, 'test5',
              6, 'test6',
            ]);
            done();
          });
        });

        it('filter gte/lt in default order', function(done) {
          query(dom1, {$gte: 3, $lt: 6}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              3, 'test3',
              4, 'test4',
              5, 'test5',
            ]);
            done();
          });
        });

        it('filter gt/lte in default order', function(done) {
          query(dom1, {$gt: 3, $lte: 6}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              4, 'test4',
              5, 'test5',
              6, 'test6',
            ]);
            done();
          });
        });

        it('filter gt/lt in default order', function(done) {
          query(dom1, {$gt: 3, $lt: 6}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              4, 'test4',
              5, 'test5',
            ]);
            done();
          });
        });

        it('filter lte/gte in reverse order', function(done) {
          query(dom1, {$rev: true, $lte: 5, $gte: 2}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              5, 'test5',
              4, 'test4',
              3, 'test3',
              2, 'test2',
            ]);
            done();
          });
        });

        it('filter lte/gt in reverse order', function(done) {
          query(dom1, {$rev: true, $lte: 5, $gt: 2}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              5, 'test5',
              4, 'test4',
              3, 'test3',
            ]);
            done();
          });
        });

        it('filter lt/gte in reverse order', function(done) {
          query(dom1, {$rev: true, $lt: 5, $gte: 2}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              4, 'test4',
              3, 'test3',
              2, 'test2',
            ]);
            done();
          });
        });

        it('filter lt/gt in reverse order', function(done) {
          query(dom1, {$rev: true, $lt: 5, $gt: 2}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              4, 'test4',
              3, 'test3',
            ]);
            done();
          });
        });

        it('in default order with limit', function(done) {
          query(dom1, {$limit: 3}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              1, 'test1',
              2, 'test2',
              3, 'test3',
            ]);
            done();
          });
        });

        it('in reverse order with limit', function(done) {
          query(dom1, {$rev: true, $limit: 2}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              7, 'test7',
              6, 'test6',
            ]);
            done();
          });
        });

        it('in default order with skip', function(done) {
          query(dom1, {$skip: 5}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              6, 'test6',
              7, 'test7',
            ]);
            done();
          });
        });

        it('in reverse order with skip', function(done) {
          query(dom1, {$rev: true, $skip: 4}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              3, 'test3',
              2, 'test2',
              1, 'test1',
            ]);
            done();
          });
        });

        it('in default order with limit and skip', function(done) {
          query(dom1, {$limit: 3, $skip: 2}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              3, 'test3',
              4, 'test4',
              5, 'test5',
            ]);
            done();
          });
        });

        it('in reverse order with limit and skip', function(done) {
          query(dom1, {$rev: true, $limit: 2, $skip: 3}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              4, 'test4',
              3, 'test3',
            ]);
            done();
          });
        });
      });

      describe('pattern', function() {
        beforeEach(function(done) {
          openDatabase(options, function(err, database) {
            if (err) return done(err);
            db = database;
            db.begin(function(err, transaction) {
              tx = transaction;
              dom1 = tx.domain(domain1);
              dom1.set('abc', 0);
              dom1.set('abcd', 0);
              dom1.set('abcde', 0);
              dom1.set(['abc', 1], 0);
              dom1.set(['abc', 'def', 2], 0);
              dom1.set(['abcdef', 3], 0);
              tx.commit(function(err){
                if (err) return done(err);
                done();
              });
            });
          });
        });

        it('abc', function(done) {
          query(dom1, {$like: 'abc'}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              'abc',
              'abcd',
              'abcde',
            ]);
            done();
          });
        });

        it('abc reverse', function(done) {
          query(dom1, {$like: 'abc', $rev: true}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              'abcde',
              'abcd',
              'abc',
            ]);
            done();
          });
        });

        it('abcd', function(done) {
          query(dom1, {$like: 'abcd'}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              'abcd',
              'abcde',
            ]);
            done();
          });
        });

        it('abcd reverse', function(done) {
          query(dom1, {$like: 'abcd', $rev: true}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              'abcde',
              'abcd',
            ]);
            done();
          });
        });

        it('[]', function(done) {
          query(dom1, {$like: []}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              ['abc', 1],
              ['abc', 'def', 2],
              ['abcdef', 3],
            ]);
            done();
          });
        });

        it('[] reverse', function(done) {
          query(dom1, {$like: [], $rev: true}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              ['abcdef', 3],
              ['abc', 'def', 2],
              ['abc', 1],
            ]);
            done();
          });
        });

        it('[abc]', function(done) {
          query(dom1, {$like: ['abc']}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              ['abc', 1],
              ['abc', 'def', 2],
            ]);
            done();
          });
        });

        it('[abc] reverse', function(done) {
          query(dom1, {$like: ['abc'], $rev: true}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              ['abc', 'def', 2],
              ['abc', 1],
            ]);
            done();
          });
        });

        it('[abc, def]', function(done) {
          query(dom1, {$like: ['abc', 'def']}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              ['abc', 'def', 2],
            ]);
            done();
          });
        });

        it('[abcdef]', function(done) {
          query(dom1, {$like: ['abcdef']}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              ['abcdef', 3],
            ]);
            done();
          });
        });
      });
    });

    describe('isolation', function() {
      beforeEach(function(done) {
        openDatabase(options, function(err, database) {
          if (err) return done(err);
          db = database;
          db.begin(function(err, transaction) {
            tx = transaction;
            dom1 = tx.domain(domain1);
            dom2 = tx.domain(domain2);
            dom1.set(1, 1);
            dom1.set(2, 2);
            dom1.set(3, 3);
            dom1.set(4, 4);
            dom1.set(5, 5);
            dom1.set(6, 6);
            dom1.set(7, 7);
            dom2.set(8, 8);
            dom2.set(9, 9, function(err){
              if (err) return done(err);
              tx.commit(function(err) {
                if (err) return done(err);
                db.begin(function(err, transaction) {
                  tx = transaction;
                  dom1 = tx.domain(domain1);
                  dom2 = tx.domain(domain2);
                  // make some changes
                  dom1.set(5, 15);
                  dom1.set(6, 16);
                  dom1.del(2, function() {
                    dom1.del(7);
                    dom2.set(8, 18);
                    dom2.set(15, 155, done);
                  });
                })
              })
            });
          });
        });
      });

      it('committed state', function(done) {
        db.begin(function(err, tx) {
          // begin a new transaction so only committed data will appear
          query(tx.domain(domain1), null, function(err, items) {
            expect(items).to.deep.eql([
              1, 1,
              2, 2,
              3, 3,
              4, 4,
              5, 5,
              6, 6,
              7, 7,
            ]);
            query(tx.domain(domain2), null, function(err, items) {
              expect(items).to.deep.eql([
                8, 8,
                9, 9,
              ]);
            });
            done();
          });
        });
      });

      it('uncommitted state', function(done) {
        query(tx.domain(domain1), null, function(err, items) {
          expect(items).to.deep.eql([
            1, 1,
            3, 3,
            4, 4,
            5, 15,
            6, 16,
          ]);
          query(tx.domain(domain2), null, function(err, items) {
            expect(items).to.deep.eql([
              8, 18,
              9, 9,
              15, 155,
            ]);
          });
          done();
        });
      });

      it('commit two concurrent transactions without conflicts',
              function(done) {
        db.begin(function(err, tx2) {
          if (err) return done(err);
          // edit domain1 in parallel with the first transaction, but only
          // distinct keys so it will force/validate conflict check
          tx2.domain(domain1).set(3, 30);
          tx2.domain(domain1).del(1);
          query(tx2.domain(domain1), null, function(err, items) {
            if (err) return done(err);
            // incorporate changes from both transactions
            expect(items).to.deep.eql([
              2, 2,
              3, 30,
              4, 4,
              5, 5,
              6, 6,
              7, 7,
            ]);
            query(tx2.domain(domain2), null, function(err, items) {
              if (err) return done(err);
              // incorporate changes from both transactions
              expect(items).to.deep.eql([
                8, 8,
                9, 9,
              ]);
              query(tx.domain(domain1), null, function(err, items) {
                expect(items).to.deep.eql([
                  1, 1,
                  3, 3,
                  4, 4,
                  5, 15,
                  6, 16,
                ]);
                query(tx.domain(domain2), null, function(err, items) {
                  expect(items).to.deep.eql([
                    8, 18,
                    9, 9,
                    15, 155,
                  ]);
                  tx2.commit(function(err) {
                    tx.commit(function(err) {
                      if (err) return done(err);
                      // domain1 merge complete, domain2 was fast-forwarded
                      // since it was not modified
                      query(tx.domain(domain1), null, function(err, items) {
                        if (err) return done(err);
                        // incorporate changes from both transactions
                        expect(items).to.deep.eql([
                          3, 30,
                          4, 4,
                          5, 15,
                          6, 16,
                        ]);
                        query(tx.domain(domain2), null, function(err, items) {
                          expect(items).to.deep.eql([
                            8, 18,
                            9, 9,
                            15, 155,
                          ]);
                          done();
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    function query(domain, q, cb) {
      var rv = [];
      domain.find(q).all(function(err, items) {
        if (err) return cb(err);
        items.forEach(function(item) {
          rv.push(item.key);
          if (item.value) rv.push(item.value);
        });
        cb(null, rv);
      });
    }
  });
}

