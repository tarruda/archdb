testDatabase = function(options, init) {
  var suiteName = options.type + ' database with ' + options.storage +
    ' storage';

  if (!init) init = function(cb) { cb(); }

  describe(suiteName, function() {
    var db, tx;
    var domain1 = 'domain1', domain2 = 'domain2';
    var dom1, dom2;

    beforeEach(init);

    describe('query', function() {
      describe('ranges', function() {
        beforeEach(function(done) {
          db = openDb(options);
          db.begin(function(err, transaction) {
            tx = transaction;
            dom1 = tx.domain(domain1);
            dom1.set(1, {name: 'test1'});
            dom1.set(2, {name: 'test2'});
            dom1.set(3, {name: 'test3'});
            dom1.set(4, {name: 'test4'});
            dom1.set(5, {name: 'test5'});
            dom1.set(6, {name: 'test6'});
            dom1.set(7, {name: 'test7'});
            tx.commit(function(err){
              if (err) return done(err);
              done();
            });
          });
        });

        it('in default order', function(done) {
          query(dom1, null, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              1, {name: 'test1'},
              2, {name: 'test2'},
              3, {name: 'test3'},
              4, {name: 'test4'},
              5, {name: 'test5'},
              6, {name: 'test6'},
              7, {name: 'test7'},
            ]);
            done();
          });
        });

        it('in reverse order', function(done) {
          query(dom1, {$rev: true}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              7, {name: 'test7'},
              6, {name: 'test6'},
              5, {name: 'test5'},
              4, {name: 'test4'},
              3, {name: 'test3'},
              2, {name: 'test2'},
              1, {name: 'test1'},
            ]);
            done();
          });
        });

        it('filter gte in default order', function(done) {
          query(dom1, {$gte: 4}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              4, {name: 'test4'},
              5, {name: 'test5'},
              6, {name: 'test6'},
              7, {name: 'test7'},
            ]);
            done();
          });
        });

        it('filter gt in default order', function(done) {
          query(dom1, {$gt: 4}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              5, {name: 'test5'},
              6, {name: 'test6'},
              7, {name: 'test7'},
            ]);
            done();
          });
        });

        it('filter lte in reverse order', function(done) {
          query(dom1, {$rev: true, $lte: 5}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              5, {name: 'test5'},
              4, {name: 'test4'},
              3, {name: 'test3'},
              2, {name: 'test2'},
              1, {name: 'test1'},
            ]);
            done();
          });
        });

        it('filter lt in reverse order', function(done) {
          query(dom1, {$rev: true, $lt: 5}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              4, {name: 'test4'},
              3, {name: 'test3'},
              2, {name: 'test2'},
              1, {name: 'test1'},
            ]);
            done();
          });
        });

        it('filter gte/lte in default order', function(done) {
          query(dom1, {$gte: 3, $lte: 6}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              3, {name: 'test3'},
              4, {name: 'test4'},
              5, {name: 'test5'},
              6, {name: 'test6'},
            ]);
            done();
          });
        });

        it('filter gte/lt in default order', function(done) {
          query(dom1, {$gte: 3, $lt: 6}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              3, {name: 'test3'},
              4, {name: 'test4'},
              5, {name: 'test5'},
            ]);
            done();
          });
        });

        it('filter gt/lte in default order', function(done) {
          query(dom1, {$gt: 3, $lte: 6}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              4, {name: 'test4'},
              5, {name: 'test5'},
              6, {name: 'test6'},
            ]);
            done();
          });
        });

        it('filter gt/lt in default order', function(done) {
          query(dom1, {$gt: 3, $lt: 6}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              4, {name: 'test4'},
              5, {name: 'test5'},
            ]);
            done();
          });
        });

        it('filter lte/gte in reverse order', function(done) {
          query(dom1, {$rev: true, $lte: 5, $gte: 2}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              5, {name: 'test5'},
              4, {name: 'test4'},
              3, {name: 'test3'},
              2, {name: 'test2'},
            ]);
            done();
          });
        });

        it('filter lte/gt in reverse order', function(done) {
          query(dom1, {$rev: true, $lte: 5, $gt: 2}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              5, {name: 'test5'},
              4, {name: 'test4'},
              3, {name: 'test3'},
            ]);
            done();
          });
        });

        it('filter lt/gte in reverse order', function(done) {
          query(dom1, {$rev: true, $lt: 5, $gte: 2}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              4, {name: 'test4'},
              3, {name: 'test3'},
              2, {name: 'test2'},
            ]);
            done();
          });
        });

        it('filter lt/gt in reverse order', function(done) {
          query(dom1, {$rev: true, $lt: 5, $gt: 2}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              4, {name: 'test4'},
              3, {name: 'test3'},
            ]);
            done();
          });
        });

        it('in default order with limit', function(done) {
          query(dom1, {$limit: 3}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              1, {name: 'test1'},
              2, {name: 'test2'},
              3, {name: 'test3'},
            ]);
            done();
          });
        });

        it('in reverse order with limit', function(done) {
          query(dom1, {$rev: true, $limit: 2}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              7, {name: 'test7'},
              6, {name: 'test6'},
            ]);
            done();
          });
        });

        it('in default order with skip', function(done) {
          query(dom1, {$skip: 5}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              6, {name: 'test6'},
              7, {name: 'test7'},
            ]);
            done();
          });
        });

        it('in reverse order with skip', function(done) {
          query(dom1, {$rev: true, $skip: 4}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              3, {name: 'test3'},
              2, {name: 'test2'},
              1, {name: 'test1'},
            ]);
            done();
          });
        });

        it('in default order with limit and skip', function(done) {
          query(dom1, {$limit: 3, $skip: 2}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              3, {name: 'test3'},
              4, {name: 'test4'},
              5, {name: 'test5'},
            ]);
            done();
          });
        });

        it('in reverse order with limit and skip', function(done) {
          query(dom1, {$rev: true, $limit: 2, $skip: 3}, function(err, items) {
            if (err) return done(err);
            expect(items).to.deep.eql([
              4, {name: 'test4'},
              3, {name: 'test3'},
            ]);
            done();
          });
        });
      });

      describe('pattern', function() {
        beforeEach(function(done) {
          db = openDb(options);
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

    describe('transactions/concurrency behavior', function() {
      var tx1, tx2, tx3, tx4;
      var tx1dom1, tx1dom2, tx2dom1, tx2dom2;
      var tx3dom1, tx3dom2, tx4dom1, tx4dom2;

      beforeEach(function(done) {
        var i = 0;
        function d() { if (++i === 4) done(); }

        db = openDb(options);
        db.begin(function(err, transaction) {
          dom1 = transaction.domain(domain1);
          dom2 = transaction.domain(domain2);
          // commit initial data in 2 steps
          dom1.set(1, 1);
          dom1.set(2, {name: 'two'});
          dom1.set(3, 3);
          transaction.commit(function() {
            dom2.set(4, 4);
            dom2.set(5, 5);
            dom2.set(6, 6);
            transaction.commit(function() {
              // begin 4 concurrent transactions
              db.begin(function(err, transaction) {
                tx1 = transaction;
                tx1dom1 = tx1.domain(domain1);
                tx1dom2 = tx1.domain(domain2);
                tx1dom1.set(1, {name: 'one'});
                tx1dom1.set(2, 22, d);
              });
              db.begin(function(err, transaction) {
                tx2 = transaction;
                tx2dom1 = tx2.domain(domain1);
                tx2dom2 = tx2.domain(domain2);
                tx2dom2.set(5, 55);
                tx2dom2.del(6, d);
              });
              db.begin(function(err, transaction) {
                tx3 = transaction;
                tx3dom1 = tx3.domain(domain1);
                tx3dom2 = tx3.domain(domain2);
                tx3dom1.set(1, 111);
                tx3dom1.del(2);
                tx3dom2.set(5, 555, d);
              });
              db.begin(function(err, transaction) {
                tx4 = transaction;
                tx4dom1 = tx4.domain(domain1);
                tx4dom2 = tx4.domain(domain2);
                tx4dom1.del(3);
                tx4dom1.set(7, 7);
                tx4dom2.set(8, 8, d);
              });
            });
          });
        });
      });

      describe('uncommitted', function() {
        it('tx1', function(done) {
          query(tx1dom1, null, function(err, items) {
            expect(items).to.deep.eql([
            1, {name: 'one'},
            2, 22,
            3, 3,
            ]);
            query(tx1dom2, null, function(err, items) {
              expect(items).to.deep.eql([
              4, 4,
              5, 5,
              6, 6,
              ]);
              done()
            });
          });
        });

        it('tx2', function(done) {
          query(tx2dom1, null, function(err, items) {
            expect(items).to.deep.eql([
            1, 1,
            2, {name: 'two'},
            3, 3,
            ]);
            query(tx2dom2, null, function(err, items) {
              expect(items).to.deep.eql([
              4, 4,
              5, 55,
              ]);
              done()
            });
          });
        });

        it('tx3', function(done) {
          query(tx3dom1, null, function(err, items) {
            expect(items).to.deep.eql([
            1, 111,
            3, 3,
            ]);
            query(tx3dom2, null, function(err, items) {
              expect(items).to.deep.eql([
              4, 4,
              5, 555,
              6, 6,
              ]);
              done()
            });
          });
        });

        it('tx4', function(done) {
          query(tx4dom1, null, function(err, items) {
            expect(items).to.deep.eql([
            1, 1,
            2, {name: 'two'},
            7, 7,
            ]);
            query(tx4dom2, null, function(err, items) {
              expect(items).to.deep.eql([
              4, 4,
              5, 5,
              6, 6,
              8, 8,
              ]);
              done()
            });
          });
        });
      });              

      describe('simple commit', function() {
        // simplest case: transaction is committed before any other
        // concurrent transactions
        it('tx1', function(done) {
          tx1.commit(function() {
            query(tx1dom1, null, function(err, items) {
              expect(items).to.deep.eql([
              1, {name: 'one'},
              2, 22,
              3, 3,
              ]);
              query(tx1dom2, null, function(err, items) {
                expect(items).to.deep.eql([
                4, 4,
                5, 5,
                6, 6,
                ]);
                done()
              });
            });
          });
        });

        it('tx2', function(done) {
          tx2.commit(function() {
            query(tx2dom1, null, function(err, items) {
              expect(items).to.deep.eql([
              1, 1,
              2, {name: 'two'},
              3, 3,
              ]);
              query(tx2dom2, null, function(err, items) {
                expect(items).to.deep.eql([
                4, 4,
                5, 55,
                ]);
                done()
              });
            });
          });
        });

        it('tx3', function(done) {
          tx3.commit(function() {
            query(tx3dom1, null, function(err, items) {
              expect(items).to.deep.eql([
              1, 111,
              3, 3,
              ]);
              query(tx3dom2, null, function(err, items) {
                expect(items).to.deep.eql([
                4, 4,
                5, 555,
                6, 6,
                ]);
                done()
              });
            });
          });
        });

        it('tx4', function(done) {
          tx4.commit(function() {
            query(tx4dom1, null, function(err, items) {
              expect(items).to.deep.eql([
              1, 1,
              2, {name: 'two'},
              7, 7,
              ]);
              query(tx4dom2, null, function(err, items) {
                expect(items).to.deep.eql([
                4, 4,
                5, 5,
                6, 6,
                8, 8,
                ]);
                done()
              });
            });
          });
        });
      });

      describe('concurrent commit within different domains', function() {
        // two concurrent transactions are committed, but they change
        // different domains.
        it('tx1, tx2', function(done) {
          tx1.commit(function() {
            // only after tx2 is committed it will see tx1 modifications
            query(tx2dom1, null, function(err, items) {
              expect(items).to.deep.eql([
              1, 1,
              2, {name: 'two'},
              3, 3,
              ]);
              query(tx2dom2, null, function(err, items) {
                expect(items).to.deep.eql([
                4, 4,
                5, 55,
                ]);
              });
              tx2.commit(function() {
                // now tx2 can see tx1 modifications
                query(tx2dom1, null, function(err, items) {
                  expect(items).to.deep.eql([
                  1, {name: 'one'},
                  2, 22,
                  3, 3,
                  ]);
                  query(tx2dom2, null, function(err, items) {
                    expect(items).to.deep.eql([
                    4, 4,
                    5, 55,
                    ]);
                    done()
                  });
                });
              });
            });
          });
        });

        it('tx2, tx1', function(done) {
          tx2.commit(function() {
            query(tx1dom1, null, function(err, items) {
              expect(items).to.deep.eql([
              1, {name: 'one'},
              2, 22,
              3, 3,
              ]);
              query(tx1dom2, null, function(err, items) {
                expect(items).to.deep.eql([
                4, 4,
                5, 5,
                6, 6,
                ]);
              });
              tx1.commit(function() {
                query(tx1dom1, null, function(err, items) {
                  expect(items).to.deep.eql([
                  1, {name: 'one'},
                  2, 22,
                  3, 3,
                  ]);
                  query(tx1dom2, null, function(err, items) {
                    expect(items).to.deep.eql([
                    4, 4,
                    5, 55,
                    ]);
                    done()
                  });
                });
              });
            });
          });
        });
      });

      describe('concurrent commit within the same domain', function() {
        describe('without key/value conflict', function() {
          it('tx1, tx2, tx4', function(done) {
            tx1.commit(function() {
              tx2.commit(function() {
                query(tx4dom1, null, function(err, items) {
                  expect(items).to.deep.eql([
                  1, 1,
                  2, {name: 'two'},
                  7, 7,
                  ]);
                  query(tx4dom2, null, function(err, items) {
                    expect(items).to.deep.eql([
                    4, 4,
                    5, 5,
                    6, 6,
                    8, 8,
                    ]);
                  });
                  tx4.commit(function() {
                    query(tx4dom1, null, function(err, items) {
                      expect(items).to.deep.eql([
                      1, {name: 'one'},
                      2, 22,
                      7, 7,
                      ]);
                      query(tx4dom2, null, function(err, items) {
                        expect(items).to.deep.eql([
                        4, 4,
                        5, 55,
                        8, 8,
                        ]);
                        done()
                      });
                    });
                  });
                });
              });
            });
          });
        });

        describe('with key/value conflict', function() {
          it('tx1, tx2, tx3', function(done) {
            tx1.commit(function() {
              tx2.commit(function() {
                query(tx3dom1, null, function(err, items) {
                  expect(items).to.deep.eql([
                  1, 111,
                  3, 3,
                  ]);
                  query(tx3dom2, null, function(err, items) {
                    expect(items).to.deep.eql([
                    4, 4,
                    5, 555,
                    6, 6,
                    ]);
                  });
                  tx3.commit(function(err) {
                    expect(err).to.be.instanceOf(ConflictError);
                    expect(err.conflicts).to.deep.eql([{
                      index: 'domain1',
                      key: 1,
                      originalValue: 1,
                      actualValue: {name: 'one'}
                    }, {
                      index: 'domain1',
                      key: 2,
                      originalValue: {name: 'two'},
                      actualValue: 22 
                    }, {
                      index: 'domain2',
                      key: 5,
                      originalValue: 5,
                      actualValue: 55 
                    }]);
                    done();
                  })
                });
              });
            });
          });
        });
      });
    });

    describe('$history domain', function() {
      var hist;
      beforeEach(function(done) {
        db = openDb(options);
        db.begin(function(err, transaction) {
          tx = transaction;
          dom1 = tx.domain(domain1);
          dom2 = tx.domain(domain2);
          dom1.set(1, {name: 'test1'});
          dom1.set(2, {name: 'test2'});
          dom1.set(3, {name: 'test3'});
          dom1.set(4, {name: 'test4'});
          dom1.set(5, {name: 'test5'});
          dom2.set(6, {name: 'test6'});
          dom2.set(7, {name: 'test7'});
          tx.commit(function(err){
            if (err) return done(err);
            hist = tx.domain('$history');
            done();
          });
        });
      });

      it('records inserts executed on each domain', function(done) {
        hist.find().all(function(err, rowset) {
          expect(rowset.total).to.eql(7);
          expect(rowset.rows.map(mapHistory)).to.deep.eql([{
            type: 'Insert', domain: 'domain1', key: 1, oldValue: null,
            value: {name: 'test1'}
          }, {
            type: 'Insert', domain: 'domain1', key: 2, oldValue: null,
            value: {name: 'test2'}
          }, {
            type: 'Insert', domain: 'domain1', key: 3, oldValue: null,
            value: {name: 'test3'}
          }, {
            type: 'Insert', domain: 'domain1', key: 4, oldValue: null,
            value: {name: 'test4'}
          }, {
            type: 'Insert', domain: 'domain1', key: 5, oldValue: null,
            value: {name: 'test5'}
          }, {
            type: 'Insert', domain: 'domain2', key: 6, oldValue: null,
            value: {name: 'test6'}
          }, {
            type: 'Insert', domain: 'domain2', key: 7, oldValue: null,
            value: {name: 'test7'}
          }]);
          done();
        });
      });

      it('records deletes executed on each domain', function(done) {
        dom2.del(6);
        dom1.del(3);
        hist.find().all(function(err, rowset) {
          expect(rowset.total).to.eql(9);
          expect(rowset.rows.map(mapHistory)).to.deep.eql([{
            type: 'Insert', domain: 'domain1', key: 1, oldValue: null,
            value: {name: 'test1'}
          }, {
            type: 'Insert', domain: 'domain1', key: 2, oldValue: null,
            value: {name: 'test2'}
          }, {
            type: 'Insert', domain: 'domain1', key: 3, oldValue: null,
            value: {name: 'test3'}
          }, {
            type: 'Insert', domain: 'domain1', key: 4, oldValue: null,
            value: {name: 'test4'}
          }, {
            type: 'Insert', domain: 'domain1', key: 5, oldValue: null,
            value: {name: 'test5'}
          }, {
            type: 'Insert', domain: 'domain2', key: 6, oldValue: null,
            value: {name: 'test6'}
          }, {
            type: 'Insert', domain: 'domain2', key: 7, oldValue: null,
            value: {name: 'test7'}
          }, {
            type: 'Delete', domain: 'domain2', key: 6, value: null,
            oldValue: {name: 'test6'}
          }, {
            type: 'Delete', domain: 'domain1', key: 3, value: null,
            oldValue: {name: 'test3'}
          }]);
          done();
        });
      });

      it('records updates executed on each domain', function(done) {
        dom1.set(4, [1, 2]);
        dom2.set(7, 3);
        hist.find().all(function(err, rowset) {
          expect(rowset.total).to.eql(9);
          expect(rowset.rows.map(mapHistory)).to.deep.eql([{
            type: 'Insert', domain: 'domain1', key: 1, oldValue: null,
            value: {name: 'test1'}
          }, {
            type: 'Insert', domain: 'domain1', key: 2, oldValue: null,
            value: {name: 'test2'}
          }, {
            type: 'Insert', domain: 'domain1', key: 3, oldValue: null,
            value: {name: 'test3'}
          }, {
            type: 'Insert', domain: 'domain1', key: 4, oldValue: null,
            value: {name: 'test4'}
          }, {
            type: 'Insert', domain: 'domain1', key: 5, oldValue: null,
            value: {name: 'test5'}
          }, {
            type: 'Insert', domain: 'domain2', key: 6, oldValue: null,
            value: {name: 'test6'}
          }, {
            type: 'Insert', domain: 'domain2', key: 7, oldValue: null,
            value: {name: 'test7'}
          }, {
            type: 'Update', domain: 'domain1', key: 4, value: [1, 2],
            oldValue: {name: 'test4'}
          }, {
            type: 'Update', domain: 'domain2', key: 7, value: 3,
            oldValue: {name: 'test7'}
          }]);
          done();
        });
      });

      function mapHistory(historyEntry) {
        delete historyEntry.date;
        delete historyEntry.ref;
        delete historyEntry.oldRef;
        return historyEntry;
      }
    });

    function query(domain, q, cb) {
      var rv = [];
      domain.find(q).all(function(err, rowset) {
        if (err) return cb(err);
        rowset.rows.forEach(function(item) {
          rv.push(item.key);
          if (item.value) rv.push(item.value);
        });
        cb(null, rv);
      });
    }
  });
}
