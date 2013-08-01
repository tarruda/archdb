'use strict';

global.testDatabase = function(options, init) {
  var suiteName = options.type + ' database with ' + options.storage +
    ' storage';

  if (!init) init = function(cb) { cb(); };

  describe(suiteName, function() {
    var db, dbStorage, tx;
    var domain1 = 'domain1', domain2 = 'domain2';
    var dom1, dom2;

    beforeEach(function(done) {
      init(function() {
        db = openDb(options);
        dbStorage = db.dbStorage;
        db.begin(function(err, transaction) {
          tx = transaction;
          dom1 = tx.domain(domain1);
          dom2 = tx.domain(domain2);
          done();
        });
      });
    });

    describe('LocalIndex', function() {
      beforeEach(function(done) {
        db.begin(function(err, tx) {
          dom1.ins({name: 'doc1'});
          dom1.ins({name: 'doc2'});
          dom1.set('3', {name: 'doc3'});
          dom1.set([4, 3], {name: 'doc4'});
          dom1.set(true, {name: 'doc5'}, done);
        });
      });

      it('insert new values using key sequence generator', function(done) {
        dom1.ins({name: 'doc6'}, function(err, key) {
          expect(key).to.eql(3);
          dom1.ins({name: 'doc7'}, function(err, key) {
            expect(key).to.eql(4);
          });
          dom1.find().all(function(err, rowset) {
            expect(rowset.total).to.eql(7);
            expect(rows(rowset.rows)).to.deep.eql([
              row(true, {name: 'doc5'}),
              row(1, {name: 'doc1'}),
              row(2, {name: 'doc2'}),
              row(3, {name: 'doc6'}),
              row(4, {name: 'doc7'}),
              row('3', {name: 'doc3'}),
              row([4, 3], {name: 'doc4'})
            ]);
            done();
          });
        });
      });
    
      it('sets keys/values', function(done) {
        dom1.find().all(function(err, rowset) {
          expect(rowset.total).to.eql(5);
          expect(rows(rowset.rows)).to.deep.eql([
            row(true, {name: 'doc5'}),
            row(1, {name: 'doc1'}),
            row(2, {name: 'doc2'}),
            row('3', {name: 'doc3'}),
            row([4, 3], {name: 'doc4'})
          ]);
          done();
        });
      });

      it('deletes keys/values', function(done) {
        dom1.del('3');
        dom1.del(2);
        dom1.find().all(function(err, rowset) {
          expect(rowset.total).to.eql(3);
          expect(rows(rowset.rows)).to.deep.eql([
            row(true, {name: 'doc5'}),
            row(1, {name: 'doc1'}),
            row([4, 3], {name: 'doc4'})
          ]);
          done();
        });
      });

      it('returns old values when keys are deleted', function(done) {
        dom1.del('3', function(err, oldRef) {
          expect(oldRef).to.be.instanceOf(ObjectRef);
          dbStorage.getIndexData(oldRef, function(err, oldVal) {
            expect(oldVal).to.deep.eql({name: 'doc3'});
            dom1.find().all(function(err, rowset) {
              expect(rowset.total).to.eql(4);
              expect(rows(rowset.rows)).to.deep.eql([
                row(true, {name: 'doc5'}),
                row(1, {name: 'doc1'}),
                row(2, {name: 'doc2'}),
                row([4, 3], {name: 'doc4'})
              ]);
              done();
            });
          });
        });
      });

      it('returns old values when updating keys', function(done) {
        dom1.set(2, [1, 2], function(err, oldRef) {
          expect(oldRef).to.be.instanceOf(ObjectRef);
          dbStorage.getIndexData(oldRef, function(err, oldVal) {
            expect(oldVal).to.deep.eql({name: 'doc2'});
            dom1.find().all(function(err, rowset) {
              expect(rowset.total).to.eql(5);
              expect(rows(rowset.rows)).to.deep.eql([
                row(true, {name: 'doc5'}),
                row(1, {name: 'doc1'}),
                row(2, [1, 2]),
                row('3', {name: 'doc3'}),
                row([4, 3], {name: 'doc4'})
              ]);
              done();
            });
          });
        });
      });

      it('numbers are stored inline', function(done) {
        dom1.set(10, 11, function(err) {
          dom1.set(10, 12, function(err, oldVal) {
            expect(oldVal).to.eql(11);
            done();
          });
        });
      });

      it('booleans are stored inline', function(done) {
        dom1.set(10, true, function(err) {
          dom1.set(10, false, function(err, oldVal) {
            expect(oldVal).to.be.true;
            done();
          });
        });
      });
    });

    describe('LocalCursor', function() {
      var expected = [
        row(1, {name: 'doc1'}),
        row(2, {name: 'doc2'}),
        row(3, 'doc3'),
        row(4, {name: 'doc4'}),
        row(5, 'doc5'),
        row('ab', 'doc6'),
        row('abc', 'doc7'),
        row([1, 2], {name: 'doc9'}),
        row([1, 2, 3], 'doc10'),
        row([1, 2, 3, 4], 'doc11')
      ];

      function testWithQuery(query, expected, desc) {
        describe(desc, function() {
          var cursor;

          beforeEach(function(done) {
            // no problem in preallocating the cursor before inserting
            cursor = dom1.find(query);
            dom1.set(1, {name: 'doc1'});
            dom1.set(2, {name: 'doc2'});
            dom1.set(3, 'doc3');
            dom1.set(4, {name: 'doc4'});
            dom1.set(5, 'doc5');
            dom1.set('ab', 'doc6');
            dom1.set('abc', 'doc7');
            dom1.set([1, 2], {name: 'doc9'});
            dom1.set([1, 2, 3], 'doc10'); 
            dom1.set([1, 2, 3, 4], 'doc11', done);
          });

          it('query each', function(done) {
            var i = 0;
            cursor.each(function(row) {
              row.ref = null;
              expect(row).to.deep.eql(expected[i++]);
              if (this.hasNext()) this.next();
            }).then(function() {
              expect(i).to.eql(expected.length); done();
            });
          });

          it('query all', function(done) {
            cursor.all(function(err, items) {
              expect(rows(items.rows)).to.deep.eql(expected);
              done();
            });
          });

          it('query one', function(done) {
            cursor.one(function(err, row) {
              row.ref = null;
              expect(row).to.deep.eql(expected[0]);
              done();
            });
          });
        });
      }

      testWithQuery(null, expected, 'without query');
      testWithQuery({$lte: 5}, expected.slice(0, 5), 'with query: $lte: 5');
      testWithQuery({$lt: 5}, expected.slice(0, 4), 'with query: $lt: 5');
      testWithQuery({$gte: 2}, expected.slice(1), 'with query: $gte: 2');
      testWithQuery({$gt: 2}, expected.slice(2), 'with query: $gt: 2');
      testWithQuery({$gte: 2, $lte: 5}, expected.slice(1, 5),
                    'with query: $gte: 2, $lte: 5');
      testWithQuery({$gt: 2, $lte: 5}, expected.slice(2, 5),
                    'with query: $gt: 2, $lte: 5');
      testWithQuery({$gte: 2, $lt: 5}, expected.slice(1, 4),
                    'with query: $gte: 2, $lt: 5');
      testWithQuery({$gt: 2, $lt: 5}, expected.slice(2, 4),
                    'with query: $gt: 2, $lt: 5');
      testWithQuery({$like: 'ab'}, expected.slice(5, 7),
                    'with query: $like: ab');
      testWithQuery({$like: 'abc'}, expected.slice(6, 7),
                    'with query: $like: abc');
      testWithQuery({$like: [1, 2]}, expected.slice(7),
                    'with query: $like: [1, 2]');
      testWithQuery({$like: [1, 2, 3]}, expected.slice(8),
                    'with query: $like: [1, 2, 3]');
      testWithQuery({$like: [1, 2, 3, 4]}, expected.slice(9),
                    'with query: $like: [1, 2, 3, 4]');
      testWithQuery({$eq: [1, 2, 3, 4]}, expected.slice(9),
                    'with query: $eq: [1, 2, 3, 4]');
      testWithQuery({$eq: 'ab'}, expected.slice(5, 6), 'with query: $eq: ab');
    });

    describe('transactions/concurrency behavior', function() {
      var tx1, tx2, tx3, tx4;
      var tx1dom1, tx1dom2, tx2dom1, tx2dom2;
      var tx3dom1, tx3dom2, tx4dom1, tx4dom2;

      beforeEach(function(done) {
        var i = 0;
        function d() { if (++i === 4) done(); }
        dom1 = tx.domain(domain1);
        dom2 = tx.domain(domain2);
        // commit initial data in 2 steps
        dom1.set(1, 1);
        dom1.set(2, {name: 'two'});
        dom1.set(3, 3);
        tx.commit(function() {
          dom2.set(4, 4);
          dom2.set(5, 5);
          dom2.set(6, 6);
          tx.commit(function() {
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

      describe('uncommitted', function() {
        it('tx1', function(done) {
          tx1dom1.find().all(function(err, items) {
            expect(items.rows.map(noref)).to.deep.eql([
              row(1, {name: 'one'}),
              row(2, 22),
              row(3, 3),
            ]);
            tx1dom2.find().all(function(err, items) {
              expect(items.rows.map(noref)).to.deep.eql([
                row(4, 4),
                row(5, 5),
                row(6, 6),
              ]);
              done();
            });
          });
        });

        it('tx2', function(done) {
          tx2dom1.find().all(function(err, items) {
            expect(items.rows.map(noref)).to.deep.eql([
              row(1, 1),
              row(2, {name: 'two'}),
              row(3, 3),
            ]);
            tx2dom2.find().all(function(err, items) {
              expect(items.rows.map(noref)).to.deep.eql([
                row(4, 4),
                row(5, 55),
              ]);
              done();
            });
          });
        });

        it('tx3', function(done) {
          tx3dom1.find().all(function(err, items) {
            expect(items.rows.map(noref)).to.deep.eql([
              row(1, 111),
              row(3, 3),
            ]);
            tx3dom2.find().all(function(err, items) {
              expect(items.rows.map(noref)).to.deep.eql([
                row(4, 4),
                row(5, 555),
                row(6, 6),
              ]);
              done();
            });
          });
        });

        it('tx4', function(done) {
          tx4dom1.find().all(function(err, items) {
            expect(items.rows.map(noref)).to.deep.eql([
              row(1, 1),
              row(2, {name: 'two'}),
              row(7, 7),
            ]);
            tx4dom2.find().all(function(err, items) {
              expect(items.rows.map(noref)).to.deep.eql([
                row(4, 4),
                row(5, 5),
                row(6, 6),
                row(8, 8),
              ]);
              done();
            });
          });
        });
      });              

      describe('simple commit', function() {
        // simplest case: transaction is committed before any other
        // concurrent transactions
        it('tx1', function(done) {
          tx1.commit(function() {
            tx1dom1.find().all(function(err, items) {
              expect(items.rows.map(noref)).to.deep.eql([
                row(1, {name: 'one'}),
                row(2, 22),
                row(3, 3),
              ]);
              tx1dom2.find().all(function(err, items) {
                expect(items.rows.map(noref)).to.deep.eql([
                  row(4, 4),
                  row(5, 5),
                  row(6, 6),
                ]);
                done();
              });
            });
          });
        });

        it('tx2', function(done) {
          tx2.commit(function() {
            tx2dom1.find().all(function(err, items) {
              expect(items.rows.map(noref)).to.deep.eql([
                row(1, 1),
                row(2, {name: 'two'}),
                row(3, 3),
              ]);
              tx2dom2.find().all(function(err, items) {
                expect(items.rows.map(noref)).to.deep.eql([
                  row(4, 4),
                  row(5, 55),
                ]);
                done();
              });
            });
          });
        });

        it('tx3', function(done) {
          tx3.commit(function() {
            tx3dom1.find().all(function(err, items) {
              expect(items.rows.map(noref)).to.deep.eql([
                row(1, 111),
                row(3, 3),
              ]);
              tx3dom2.find().all(function(err, items) {
                expect(items.rows.map(noref)).to.deep.eql([
                  row(4, 4),
                  row(5, 555),
                  row(6, 6),
                ]);
                done();
              });
            });
          });
        });

        it('tx4', function(done) {
          tx4.commit(function() {
            tx4dom1.find().all(function(err, items) {
              expect(items.rows.map(noref)).to.deep.eql([
                row(1, 1),
                row(2, {name: 'two'}),
                row(7, 7),
              ]);
              tx4dom2.find().all(function(err, items) {
                expect(items.rows.map(noref)).to.deep.eql([
                  row(4, 4),
                  row(5, 5),
                  row(6, 6),
                  row(8, 8),
                ]);
                done();
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
            tx2dom1.find().all(function(err, items) {
              expect(items.rows.map(noref)).to.deep.eql([
                row(1, 1),
                row(2, {name: 'two'}),
                row(3, 3),
              ]);
              tx2dom2.find().all(function(err, items) {
                expect(items.rows.map(noref)).to.deep.eql([
                  row(4, 4),
                  row(5, 55),
                ]);
              });
              tx2.commit(function() {
                // now tx2 can see tx1 modifications
                tx2dom1.find().all(function(err, items) {
                  expect(items.rows.map(noref)).to.deep.eql([
                    row(1, {name: 'one'}),
                    row(2, 22),
                    row(3, 3),
                  ]);
                  tx2dom2.find().all(function(err, items) {
                    expect(items.rows.map(noref)).to.deep.eql([
                      row(4, 4),
                      row(5, 55),
                    ]);
                    done();
                  });
                });
              });
            });
          });
        });

        it('tx2, tx1', function(done) {
          tx2.commit(function() {
            tx1dom1.find().all(function(err, items) {
              expect(items.rows.map(noref)).to.deep.eql([
                row(1, {name: 'one'}),
                row(2, 22),
                row(3, 3),
              ]);
              tx1dom2.find().all(function(err, items) {
                expect(items.rows.map(noref)).to.deep.eql([
                  row(4, 4),
                  row(5, 5),
                  row(6, 6),
                ]);
              });
              tx1.commit(function() {
                tx1dom1.find().all(function(err, items) {
                  expect(items.rows.map(noref)).to.deep.eql([
                    row(1, {name: 'one'}),
                    row(2, 22),
                    row(3, 3),
                  ]);
                  tx1dom2.find().all(function(err, items) {
                    expect(items.rows.map(noref)).to.deep.eql([
                      row(4, 4),
                      row(5, 55),
                    ]);
                    done();
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
                tx4dom1.find().all(function(err, items) {
                  expect(items.rows.map(noref)).to.deep.eql([
                    row(1, 1),
                    row(2, {name: 'two'}),
                    row(7, 7),
                  ]);
                  tx4dom2.find().all(function(err, items) {
                    expect(items.rows.map(noref)).to.deep.eql([
                      row(4, 4),
                      row(5, 5),
                      row(6, 6),
                      row(8, 8),
                    ]);
                  });
                  tx4.commit(function() {
                    tx4dom1.find().all(function(err, items) {
                      expect(items.rows.map(noref)).to.deep.eql([
                        row(1, {name: 'one'}),
                        row(2, 22),
                        row(7, 7),
                      ]);
                      tx4dom2.find().all(function(err, items) {
                        expect(items.rows.map(noref)).to.deep.eql([
                          row(4, 4),
                          row(5, 55),
                          row(8, 8),
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

        describe('with key/value conflict', function() {
          it('tx1, tx2, tx3', function(done) {
            tx1.commit(function() {
              tx2.commit(function() {
                tx3dom1.find().all(function(err, items) {
                  expect(items.rows.map(noref)).to.deep.eql([
                    row(1, 111),
                    row(3, 3),
                  ]);
                  tx3dom2.find().all(function(err, items) {
                    expect(items.rows.map(noref)).to.deep.eql([
                      row(4, 4),
                      row(5, 555),
                      row(6, 6),
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
                  });
                });
              });
            });
          });
        });
      });
    });

    describe('special domains', function() {
      describe('$history domain', function() {
        var hist;
        beforeEach(function(done) {
          dom1.set(1, {name: 'test1'});
          dom1.set(2, {name: 'test2'});
          dom1.set(3, 33);
          dom1.set(4, {name: 'test4'});
          dom1.set(5, 55);
          dom2.set(6, {name: 'test6'});
          dom2.set(7, {name: 'test7'});
          tx.commit(function(err){
            if (err) return done(err);
            hist = tx.domain('$history');
            done();
          });
        });

        it("set on new keys creates 'Insert' entries", function(done) {
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
              value: 33
            }, {
              type: 'Insert', domain: 'domain1', key: 4, oldValue: null,
              value: {name: 'test4'}
            }, {
              type: 'Insert', domain: 'domain1', key: 5, oldValue: null,
              value: 55
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

        it("del on existing keys creates 'Delete' entries", function(done) {
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
              value: 33
            }, {
              type: 'Insert', domain: 'domain1', key: 4, oldValue: null,
              value: {name: 'test4'}
            }, {
              type: 'Insert', domain: 'domain1', key: 5, oldValue: null,
              value: 55
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
              oldValue: 33
            }]);
            done();
          });
        });

        it('del on inexistent keys is a no-op', function(done) {
          dom2.del(8);
          dom1.del(9);
          dom1.del(6);
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
              value: 33
            }, {
              type: 'Insert', domain: 'domain1', key: 4, oldValue: null,
              value: {name: 'test4'}
            }, {
              type: 'Insert', domain: 'domain1', key: 5, oldValue: null,
              value: 55
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

        it("del is an idempotent operation", function(done) {
          dom1.del(2);
          dom1.del(2);
          dom1.del(5);
          dom1.del(2);
          dom1.del(5);
          dom1.del(2);
          hist.find().all(function(err, rowset) {
            expect(rowset.rows.map(mapHistory)).to.deep.eql([{
              type: 'Insert', domain: 'domain1', key: 1, oldValue: null,
              value: {name: 'test1'}
            }, {
              type: 'Insert', domain: 'domain1', key: 2, oldValue: null,
              value: {name: 'test2'}
            }, {
              type: 'Insert', domain: 'domain1', key: 3, oldValue: null,
              value: 33
            }, {
              type: 'Insert', domain: 'domain1', key: 4, oldValue: null,
              value: {name: 'test4'}
            }, {
              type: 'Insert', domain: 'domain1', key: 5, oldValue: null,
              value: 55
            }, {
              type: 'Insert', domain: 'domain2', key: 6, oldValue: null,
              value: {name: 'test6'}
            }, {
              type: 'Insert', domain: 'domain2', key: 7, oldValue: null,
              value: {name: 'test7'}
            }, {
              type: 'Delete', domain: 'domain1', key: 2, value: null,
              oldValue: {name: 'test2'}
            }, {
              type: 'Delete', domain: 'domain1', key: 5, value: null,
              oldValue: 55
            }]);
            done();
          });
        });

        it("set is an idempotent operation for equal values", function(done) {
          // only primitive values are compared internally
          dom1.set(1, 1);
          dom1.set(1, 1);
          dom1.set(8, 8);
          dom1.set(1, 1);
          dom1.set(8, 8);
          dom1.set(8, 8);
          hist.find().all(function(err, rowset) {
            expect(rowset.rows.map(mapHistory)).to.deep.eql([{
              type: 'Insert', domain: 'domain1', key: 1, oldValue: null,
              value: {name: 'test1'}
            }, {
              type: 'Insert', domain: 'domain1', key: 2, oldValue: null,
              value: {name: 'test2'}
            }, {
              type: 'Insert', domain: 'domain1', key: 3, oldValue: null,
              value: 33
            }, {
              type: 'Insert', domain: 'domain1', key: 4, oldValue: null,
              value: {name: 'test4'}
            }, {
              type: 'Insert', domain: 'domain1', key: 5, oldValue: null,
              value: 55
            }, {
              type: 'Insert', domain: 'domain2', key: 6, oldValue: null,
              value: {name: 'test6'}
            }, {
              type: 'Insert', domain: 'domain2', key: 7, oldValue: null,
              value: {name: 'test7'}
            }, {
              type: 'Update', domain: 'domain1', key: 1, value: 1,
              oldValue: {name: 'test1'}
            }, {
              type: 'Insert', domain: 'domain1', key: 8, value: 8,
              oldValue: null
            }]);
            done();
          });
        });

        it("set on existing keys creates 'Update' entries", function(done) {
          dom1.set(3, [1, 2]);
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
              value: 33
            }, {
              type: 'Insert', domain: 'domain1', key: 4, oldValue: null,
              value: {name: 'test4'}
            }, {
              type: 'Insert', domain: 'domain1', key: 5, oldValue: null,
              value: 55
            }, {
              type: 'Insert', domain: 'domain2', key: 6, oldValue: null,
              value: {name: 'test6'}
            }, {
              type: 'Insert', domain: 'domain2', key: 7, oldValue: null,
              value: {name: 'test7'}
            }, {
              type: 'Update', domain: 'domain1', key: 3,
              oldValue: 33, value: [1, 2]
            }, {
              type: 'Update', domain: 'domain2', key: 7,
              oldValue: {name: 'test7'}, value: 3
            }]);
            done();
          });
        });

        it("del/set one key results in 'Delete/Insert' entries", function(done) {
          dom1.del(3);
          tx.commit(function() {
            dom1.set(3, {name: 'test3'});
            hist.find().all(function(err, rowset) {
              // expect(rowset.total).to.eql(9);
              expect(rowset.rows.map(mapHistory)).to.deep.eql([{
                type: 'Insert', domain: 'domain1', key: 1, oldValue: null,
                value: {name: 'test1'}
              }, {
                type: 'Insert', domain: 'domain1', key: 2, oldValue: null,
                value: {name: 'test2'}
              }, {
                type: 'Insert', domain: 'domain1', key: 3, oldValue: null,
                value: 33
              }, {
                type: 'Insert', domain: 'domain1', key: 4, oldValue: null,
                value: {name: 'test4'}
              }, {
                type: 'Insert', domain: 'domain1', key: 5, oldValue: null,
                value: 55
              }, {
                type: 'Insert', domain: 'domain2', key: 6, oldValue: null,
                value: {name: 'test6'}
              }, {
                type: 'Insert', domain: 'domain2', key: 7, oldValue: null,
                value: {name: 'test7'}
              }, {
                type: 'Delete', domain: 'domain1', key: 3, oldValue: 33,
                value: null
              }, {
                type: 'Insert', domain: 'domain1', key: 3, oldValue: null,
                value: {name: 'test3'}
              }]);
              done();
            });
          });
        });

        function mapHistory(historyEntry) {
          delete historyEntry.date;
          delete historyEntry.ref;
          delete historyEntry.oldRef;
          return historyEntry;
        }
      });
    });
  });

  function row(key, value) {
    return new IndexRow(key, value, null);
  }

  function rows(array) {
    array.forEach(function(r) { r.ref = null; });
    return array;
  }

  function noref(row) {
    row.ref = null;
    return row;
  }
};
