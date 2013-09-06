{ObjectRef} = require('../../src/util')
{IndexRow} = require('../../src/local_index')
{ConflictError} = require('../../src/errors')
require('../../src/local_database')


domain1 = 'domain1'
domain2 = 'domain2'


apiTests =
  'LocalIndex':
    '**setup**': (done) ->
      @dom1.ins(name: 'doc1')
      @dom1.ins(name: 'doc2')
      @dom1.set('3', name: 'doc3')
      @dom1.set([4, 3], name: 'doc4')
      @dom1.set(true, name: 'doc5', done)


    'insert new values using key sequence generator': (done) ->
      @dom1.ins(name: 'doc6', (err, key) =>
        expect(key).to.eql(3)
        @dom1.ins(name: 'doc7', (err, key) => expect(key).to.eql(4))
        @dom1.find().all((err, rowset) =>
          expect(rowset.total).to.eql(7)
          expect(rows(rowset.rows)).to.deep.eql([
            row(true, name: 'doc5')
            row(1, name: 'doc1')
            row(2, name: 'doc2')
            row(3, name: 'doc6')
            row(4, name: 'doc7')
            row('3', name: 'doc3')
            row([4, 3], name: 'doc4')
          ])
          done()))


    'sets keys/values': (done) ->
      @dom1.find().all((err, rowset) =>
        expect(rowset.total).to.eql(5)
        expect(rows(rowset.rows)).to.deep.eql([
          row(true, name: 'doc5')
          row(1, name: 'doc1')
          row(2, name: 'doc2')
          row('3', name: 'doc3')
          row([4, 3], name: 'doc4')
        ])
        done())


    'deletes keys/values': (done) ->
      @dom1.del('3')
      @dom1.del(2)
      @dom1.find().all((err, rowset) =>
        expect(rowset.total).to.eql(3)
        expect(rows(rowset.rows)).to.deep.eql([
          row(true, name: 'doc5')
          row(1, name: 'doc1')
          row([4, 3], name: 'doc4')
        ])
        done())


    # 'returns old values when keys are deleted': (done) ->
    #   @dom1.del('3', (err, oldRef) =>
    #     expect(oldRef).to.be.instanceOf(ObjectRef)
    #     @dbStorage.getIndexData(oldRef, (err, oldVal) =>
    #       expect(oldVal).to.deep.eql(name: 'doc3')
    #       @dom1.find().all((err, rowset) =>
    #         expect(rowset.total).to.eql(4)
    #         expect(rows(rowset.rows)).to.deep.eql([
    #           row(true, name: 'doc5')
    #           row(1, name: 'doc1')
    #           row(2, name: 'doc2')
    #           row([4, 3], name: 'doc4')
    #         ])
    #         done())))


    # 'returns old values when keys are updated': (done) ->
    #   @dom1.set(2, [1, 2], (err, oldRef) =>
    #     expect(oldRef).to.be.instanceOf(ObjectRef)
    #     @dbStorage.getIndexData(oldRef, (err, oldVal) =>
    #       expect(oldVal).to.deep.eql(name: 'doc2')
    #       @dom1.find().all((err, rowset) =>
    #         expect(rowset.total).to.eql(5)
    #         expect(rows(rowset.rows)).to.deep.eql([
    #           row(true, name: 'doc5')
    #           row(1, name: 'doc1')
    #           row(2, [1, 2])
    #           row('3', name: 'doc3')
    #           row([4, 3], name: 'doc4')
    #         ])
    #         done())))


    'numbers are stored inline': (done) ->
      @dom1.set(10, 11, (err) =>
        @dom1.set(10, 12, (err, oldVal) =>
          expect(oldVal).to.eql(11)
          done()))


    'booleans are stored inline': (done) ->
      @dom1.set(10, true, (err) =>
        @dom1.set(10, false, (err, oldVal) =>
          expect(oldVal).to.be.true
          done()))


  'transactions/concurrency behavior':
    '**setup**': (done) ->
      @dom1 = @tx.domain(domain1)
      @dom2 = @tx.domain(domain2)
      # commit initial data in 2 steps
      @dom1.set(1, 1)
      @dom1.set(2, name: 'two')
      @dom1.set(3, 3)
      @tx.commit( =>
        @dom2.set(4, 4)
        @dom2.set(5, 5)
        @dom2.set(6, 6)
        @tx.commit( =>
          # begin 4 concurrent transactions
          @db.begin((err, transaction) =>
            @tx1 = transaction
            @tx1dom1 = @tx1.domain(domain1)
            @tx1dom2 = @tx1.domain(domain2)
            @db.begin((err, transaction) =>
              @tx2 = transaction
              @tx2dom1 = @tx2.domain(domain1)
              @tx2dom2 = @tx2.domain(domain2)
              @db.begin((err, transaction) =>
                @tx3 = transaction
                @tx3dom1 = @tx3.domain(domain1)
                @tx3dom2 = @tx3.domain(domain2)
                @db.begin((err, transaction) =>
                  @tx4 = transaction
                  @tx4dom1 = @tx4.domain(domain1)
                  @tx4dom2 = @tx4.domain(domain2)
                  @db.begin((err, transaction) =>
                    @tx5 = transaction
                    @tx5dom2 = @tx5.domain(domain2)
                    @tx1dom1.set(1, name: 'one')
                    @tx1dom1.set(2, 22, =>
                      # since each transaction has independent uid generators
                      # we need to use this setTimeout hack to ensure the
                      # expected chronological order of history entries
                      setTimeout(=>
                        @tx2dom2.set(5, 55)
                        @tx2dom2.del(6, =>
                          setTimeout(=>
                            @tx3dom1.set(1, 111)
                            @tx3dom1.del(2)
                            @tx3dom2.set(5, 555, =>
                              setTimeout(=>
                                @tx4dom1.del(3)
                                @tx4dom1.set(7, 7)
                                @tx4dom2.set(8, 8, =>
                                  setTimeout(=>
                                    @tx5dom2.set(8, 80, done))))))))))))))))


    'uncommitted':
      'tx1': (done) ->
        @tx1dom1.find().all((err, items) =>
          expect(items.rows.map(noref)).to.deep.eql([
            row(1, name: 'one')
            row(2, 22)
            row(3, 3)
          ])
          @tx1dom2.find().all((err, items) =>
            expect(items.rows.map(noref)).to.deep.eql([
              row(4, 4)
              row(5, 5)
              row(6, 6)
            ])
            done()))

      'tx2': (done) ->
        @tx2dom1.find().all((err, items) =>
          expect(items.rows.map(noref)).to.deep.eql([
            row(1, 1)
            row(2, name: 'two')
            row(3, 3)
          ])
          @tx2dom2.find().all((err, items) =>
            expect(items.rows.map(noref)).to.deep.eql([
              row(4, 4)
              row(5, 55)
            ])
            done()))

      'tx3': (done) ->
        @tx3dom1.find().all((err, items) =>
          expect(items.rows.map(noref)).to.deep.eql([
            row(1, 111)
            row(3, 3)
          ])
          @tx3dom2.find().all((err, items) =>
            expect(items.rows.map(noref)).to.deep.eql([
              row(4, 4)
              row(5, 555)
              row(6, 6)
            ])
            done()))

      'tx4': (done) ->
        @tx4dom1.find().all((err, items) =>
          expect(items.rows.map(noref)).to.deep.eql([
            row(1, 1)
            row(2, name: 'two')
            row(7, 7)
          ])
          @tx4dom2.find().all((err, items) =>
            expect(items.rows.map(noref)).to.deep.eql([
              row(4, 4)
              row(5, 5)
              row(6, 6)
              row(8, 8)
            ])
            done()))

    'simple commit':
      # simplest case: transaction is committed before any other
      # concurrent transactions
      'tx1': (done) ->
        @tx1.commit( =>
          @tx1dom1.find().all((err, items) =>
            expect(items.rows.map(noref)).to.deep.eql([
              row(1, name: 'one')
              row(2, 22)
              row(3, 3)
            ])
            @tx1dom2.find().all((err, items) =>
              expect(items.rows.map(noref)).to.deep.eql([
                row(4, 4)
                row(5, 5)
                row(6, 6)
              ])
              done())))


      'tx2': (done) ->
        @tx2.commit( =>
          @tx2dom1.find().all((err, items) =>
            expect(items.rows.map(noref)).to.deep.eql([
              row(1, 1)
              row(2, name: 'two')
              row(3, 3)
            ])
            @tx2dom2.find().all((err, items) =>
              expect(items.rows.map(noref)).to.deep.eql([
                row(4, 4)
                row(5, 55)
              ])
              done())))


      'tx3': (done) ->
        @tx3.commit( =>
          @tx3dom1.find().all((err, items) =>
            expect(items.rows.map(noref)).to.deep.eql([
              row(1, 111)
              row(3, 3)
            ])
            @tx3dom2.find().all((err, items) =>
              expect(items.rows.map(noref)).to.deep.eql([
                row(4, 4)
                row(5, 555)
                row(6, 6)
              ])
              done())))


      'tx4': (done) ->
        @tx4.commit( =>
          @tx4dom1.find().all((err, items) =>
            expect(items.rows.map(noref)).to.deep.eql([
              row(1, 1)
              row(2, name: 'two')
              row(7, 7)
            ])
            @tx4dom2.find().all((err, items) =>
              expect(items.rows.map(noref)).to.deep.eql([
                row(4, 4)
                row(5, 5)
                row(6, 6)
                row(8, 8)
              ])
              done())))


    'concurrent commit within different domains':
      # two concurrent transactions are committed, but they change
      # different domains.
      'tx1, tx2': (done) ->
        @tx1.commit( =>
          # only after tx2 is committed it will see tx1 modifications
          @tx2dom1.find().all((err, items) =>
            expect(items.rows.map(noref)).to.deep.eql([
              row(1, 1)
              row(2, name: 'two')
              row(3, 3)
            ])
            @tx2dom2.find().all((err, items) =>
              expect(items.rows.map(noref)).to.deep.eql([
                row(4, 4)
                row(5, 55)
              ]))
            @tx2.commit( =>
              # now tx2 can see tx1 modifications
              @tx2dom1.find().all((err, items) =>
                expect(items.rows.map(noref)).to.deep.eql([
                  row(1, name: 'one')
                  row(2, 22)
                  row(3, 3)
                ])
                @tx2dom2.find().all((err, items) =>
                  expect(items.rows.map(noref)).to.deep.eql([
                    row(4, 4)
                    row(5, 55)
                  ])
                  @tx2.domain('$history').find().all((err, items) =>
                    expect(items.total).to.eql(10)
                    expect(items.rows.map(mapHistory)).to.deep.eql([{
                      type: 'Insert', domain: 'domain1', key: 1,
                      oldValue: null, value: 1
                    }, {
                      type: 'Insert', domain: 'domain1', key: 2,
                      oldValue: null, value: {name: 'two'}
                    }, {
                      type: 'Insert', domain: 'domain1', key: 3,
                      oldValue: null, value: 3
                    }, {
                      type: 'Insert', domain: 'domain2', key: 4,
                      oldValue: null, value: 4
                    }, {
                      type: 'Insert', domain: 'domain2', key: 5,
                      oldValue: null, value: 5
                    }, {
                      type: 'Insert', domain: 'domain2', key: 6,
                      oldValue: null, value: 6
                    }, {
                      type: 'Update', domain: 'domain1', key: 1,
                      oldValue: 1, value: {name: 'one'}
                    }, {
                      type: 'Update', domain: 'domain1', key: 2,
                      oldValue: {name: 'two'}, value: 22
                    }, {
                      type: 'Update', domain: 'domain2', key: 5,
                      oldValue: 5, value: 55
                    }, {
                      type: 'Delete', domain: 'domain2', key: 6,
                      oldValue: 6, value: null
                    }])
                    done()))))))


      'tx2, tx1': (done) ->
        @tx2.commit( =>
          @tx1dom1.find().all((err, items) =>
            expect(items.rows.map(noref)).to.deep.eql([
              row(1, name: 'one')
              row(2, 22)
              row(3, 3)
            ])
            @tx1dom2.find().all((err, items) =>
              expect(items.rows.map(noref)).to.deep.eql([
                row(4, 4)
                row(5, 5)
                row(6, 6)
              ]))
            @tx1.commit( =>
              @tx1dom1.find().all((err, items) =>
                expect(items.rows.map(noref)).to.deep.eql([
                  row(1, name: 'one')
                  row(2, 22)
                  row(3, 3)
                ])
                @tx1dom2.find().all((err, items) =>
                  expect(items.rows.map(noref)).to.deep.eql([
                    row(4, 4)
                    row(5, 55)
                  ])
                  @tx1.domain('$history').find().all((err, items) =>
                    expect(items.total).to.eql(10)
                    expect(items.rows.map(mapHistory)).to.deep.eql([{
                      type: 'Insert', domain: 'domain1', key: 1,
                      oldValue: null, value: 1
                    }, {
                      type: 'Insert', domain: 'domain1', key: 2,
                      oldValue: null, value: {name: 'two'}
                    }, {
                      type: 'Insert', domain: 'domain1', key: 3,
                      oldValue: null, value: 3
                    }, {
                      type: 'Insert', domain: 'domain2', key: 4,
                      oldValue: null, value: 4
                    }, {
                      type: 'Insert', domain: 'domain2', key: 5,
                      oldValue: null, value: 5
                    }, {
                      type: 'Insert', domain: 'domain2', key: 6,
                      oldValue: null, value: 6
                    }, {
                      type: 'Update', domain: 'domain1', key: 1,
                      oldValue: 1, value: {name: 'one'}
                    }, {
                      type: 'Update', domain: 'domain1', key: 2,
                      oldValue: {name: 'two'}, value: 22
                    }, {
                      type: 'Update', domain: 'domain2', key: 5,
                      oldValue: 5, value: 55
                    }, {
                      type: 'Delete', domain: 'domain2', key: 6,
                      oldValue: 6, value: null
                    }])
                    done()))))))


    'concurrent commit within the same domain':
      'without key/value conflict':
        'tx1, tx2, tx4': (done) ->
          @tx1.commit( =>
            @tx2.commit( =>
              @tx4dom1.find().all((err, items) =>
                expect(items.rows.map(noref)).to.deep.eql([
                  row(1, 1)
                  row(2, name: 'two')
                  row(7, 7)
                ])
                @tx4dom2.find().all((err, items) =>
                  expect(items.rows.map(noref)).to.deep.eql([
                    row(4, 4)
                    row(5, 5)
                    row(6, 6)
                    row(8, 8)
                  ])
                @tx4.commit( =>
                  @tx4dom1.find().all((err, items) =>
                    expect(items.rows.map(noref)).to.deep.eql([
                      row(1, name: 'one')
                      row(2, 22)
                      row(7, 7)
                    ])
                    @tx4dom2.find().all((err, items) =>
                      expect(items.rows.map(noref)).to.deep.eql([
                        row(4, 4)
                        row(5, 55)
                        row(8, 8)
                      ])
                      @tx4.domain('$history').find().all((err, items) =>
                        expect(items.total).to.eql(13)
                        expect(items.rows.map(mapHistory)).to.deep.eql([{
                          type: 'Insert', domain: 'domain1', key: 1,
                          oldValue: null, value: 1
                        }, {
                          type: 'Insert', domain: 'domain1', key: 2,
                          oldValue: null, value: {name: 'two'}
                        }, {
                          type: 'Insert', domain: 'domain1', key: 3,
                          oldValue: null, value: 3
                        }, {
                          type: 'Insert', domain: 'domain2', key: 4,
                          oldValue: null, value: 4
                        }, {
                          type: 'Insert', domain: 'domain2', key: 5,
                          oldValue: null, value: 5
                        }, {
                          type: 'Insert', domain: 'domain2', key: 6,
                          oldValue: null, value: 6
                        }, {
                          type: 'Update', domain: 'domain1', key: 1,
                          oldValue: 1, value: {name: 'one'}
                        }, {
                          type: 'Update', domain: 'domain1', key: 2,
                          oldValue: {name: 'two'}, value: 22
                        }, {
                          type: 'Update', domain: 'domain2', key: 5,
                          oldValue: 5, value: 55
                        }, {
                          type: 'Delete', domain: 'domain2', key: 6,
                          oldValue: 6, value: null
                        }, {
                          type: 'Delete', domain: 'domain1', key: 3,
                          oldValue: 3, value: null
                        }, {
                          type: 'Insert', domain: 'domain1', key: 7,
                          oldValue: null, value: 7
                        }, {
                          type: 'Insert', domain: 'domain2', key: 8,
                          oldValue: null, value: 8
                        }])
                        done()))))))))


      'with key/value conflict':
        'tx1, tx2, tx3': (done) ->
          # tx1 updates keys 1/2 of dom1 and key 5 of dom2, which
          # are also updated by tx1 and tx2
          @tx1.commit(=>
            @tx2.commit(=>
              @tx3dom1.find().all((err, items) =>
                expect(items.rows.map(noref)).to.deep.eql([
                  row(1, 111)
                  row(3, 3)
                ])
                @tx3dom2.find().all((err, items) =>
                  expect(items.rows.map(noref)).to.deep.eql([
                    row(4, 4)
                    row(5, 555)
                    row(6, 6)
                  ])
                  @tx3.commit((err) =>
                    expect(err).to.be.instanceOf(ConflictError)
                    expect(err.conflicts).to.deep.eql([{
                      index: 'domain1'
                      key: 1
                      originalValue: 1
                      currentValue: {name: 'one'}
                    }, {
                      key: 2
                      originalValue: {name: 'two'}
                      index: 'domain1'
                      currentValue: 22
                    }, {
                      index: 'domain2'
                      key: 5
                      originalValue: 5
                      currentValue: 55
                    }])
                    done())))))


        'tx4, tx5': (done) ->
          @tx4.commit(=>
            @tx5dom2.find().all((err, items) =>
              expect(items.rows.map(noref)).to.deep.eql([
                row(4, 4)
                row(5, 5)
                row(6, 6)
                row(8, 80) # tx4 already inserted a different value
              ])
              @tx5.commit((err) =>
                expect(err).to.be.instanceOf(ConflictError)
                expect(err.conflicts).to.deep.eql([{
                  index: 'domain2'
                  key: 8
                  originalValue: null
                  currentValue: 8
                }])
                done())))


  'special domains':
    '$history domain':
      '**setup**': (done) ->
        @dom1.set(1, name: 'test1')
        @dom1.set(2, name: 'test2')
        @dom1.set(3, 33)
        @dom1.set(4, name: 'test4')
        @dom1.set(5, 55)
        @dom2.set(6, name: 'test6')
        @dom2.set(7, name: 'test7')
        @tx.commit((err) =>
          if err then return done(err)
          @hist = @tx.domain(HISTORY)
          done())

      "set on new keys creates 'Insert' entries": (done) ->
        @hist.find().all((err, rowset) =>
          expect(rowset.total).to.eql(7)
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
          }])
          done())

      "del on existing keys creates 'Delete' entries": (done) ->
        @dom2.del(6)
        @dom1.del(3)
        @hist.find().all((err, rowset) =>
          expect(rowset.total).to.eql(9)
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
          }])
          done())


      'del on inexistent keys is a no-op': (done) ->
        @dom2.del(8)
        @dom1.del(9)
        @dom1.del(6)
        @hist.find().all((err, rowset) =>
          expect(rowset.total).to.eql(7)
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
          }])
          done())


      "del is an idempotent operation": (done) ->
        @dom1.del(2)
        @dom1.del(2)
        @dom1.del(5)
        @dom1.del(2)
        @dom1.del(5)
        @dom1.del(2)
        @hist.find().all((err, rowset) =>
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
          }])
          done())


      "set is an idempotent operation for equal values": (done) ->
        # only primitive values are compared internally
        @dom1.set(1, 1)
        @dom1.set(1, 1)
        @dom1.set(8, 8)
        @dom1.set(1, 1)
        @dom1.set(8, 8)
        @dom1.set(8, 8)
        @hist.find().all((err, rowset) =>
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
          }])
          done())


      "set on existing keys creates 'Update' entries": (done) ->
        @dom1.set(3, [1, 2])
        @dom2.set(7, 3)
        @hist.find().all((err, rowset) =>
          expect(rowset.total).to.eql(9)
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
          }])
          done())


      "del/set one key results in 'Delete/Insert' entries": (done) ->
        @dom1.del(3)
        @tx.commit( =>
          @dom1.set(3, name: 'test3')
          @hist.find().all((err, rowset) =>
            expect(rowset.total).to.eql(9)
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
            }])
            done()))


cursorApiTests =
  '**setup**': (done) ->


row = (key, value) -> new IndexRow(key, value, null)


rows = (array) -> array.map(noref)


noref = (row) ->
  row.ref = null
  return row


mapHistory = (historyEntry) ->
  delete historyEntry.date
  delete historyEntry.ref
  delete historyEntry.oldRef
  return historyEntry


cursorApiTestExpected = [
  row(1, name: 'doc1')
  row(2, name: 'doc2')
  row(3, 'doc3')
  row(4, name: 'doc4')
  row(5, 'doc5')
  row('ab', 'doc6')
  row('abc', 'doc7')
  row([1, 2], name: 'doc9')
  row([1, 2, 3], 'doc10')
  row([1, 2, 3, 4], 'doc11')
]


testCursorApi = (query, expectedStart, expectedEnd) ->
  expected = cursorApiTestExpected.slice(expectedStart, expectedEnd)

  return {
    '**setup**': (done) ->
      @cursor = @dom1.find(query)
      @dom1.set(1, name: 'doc1')
      @dom1.set(2, name: 'doc2')
      @dom1.set(3, 'doc3')
      @dom1.set(4, name: 'doc4')
      @dom1.set(5, 'doc5')
      @dom1.set('ab', 'doc6')
      @dom1.set('abc', 'doc7')
      @dom1.set([1, 2], name: 'doc9')
      @dom1.set([1, 2, 3], 'doc10')
      @dom1.set([1, 2, 3, 4], 'doc11', done)

    'query each': (done) ->
      i = 0
      @cursor.each((row) ->
        row.ref = null
        expect(row).to.deep.eql(expected[i++])
        if @hasNext() then @next()
      ).then(->
        expect(i).to.eql(expected.length)
        done())

    'query all': (done) ->
      @cursor.all((err, items) ->
        expect(rows(items.rows)).to.deep.eql(expected)
        done())

    'query one': (done) ->
      @cursor.one((err, row) ->
        row.ref = null
        expect(row).to.deep.eql(expected[0])
        done())
  }


testApi = (options, init) ->
  title = "#{options.type} database with #{options.storage} storage"
  suite = {}

  if not init
    init = (cb) -> cb()

  suite[title] =
    '**setup**': (done) ->
      init(=>
        @db = db(options)
        @db.open((err) =>
          if err then throw err
          @db.begin((err, transaction) =>
            @tx = transaction
            @dom1 = @tx.domain(domain1)
            @dom2 = @tx.domain(domain2)
            done())))
    '**teardown**': (done) -> @db.close(done)

  for own k, v of apiTests
    suite[title][k] = v

  suite[title]['LocalCursor'] =
    'without query': testCursorApi()
    'with query $lte: 5': testCursorApi({$lte: 5}, 0, 5)
    'with query $lt: 5': testCursorApi({$lt: 5}, 0, 4)
    'with query $gte: 2': testCursorApi({$gte: 2}, 1)
    'with query $gt: 2': testCursorApi({$gt: 2}, 2)
    'with query $gte: 2, $lte: 5': testCursorApi({$gte: 2, $lte: 5}, 1, 5)
    'with query $gt: 2, $lte: 5': testCursorApi({$gt: 2, $lte: 5}, 2, 5)
    'with query $gte: 2, $lt: 5': testCursorApi({$gte: 2, $lt: 5}, 1, 4)
    'with query $gt: 2, $lt: 5': testCursorApi({$gt: 2, $lt: 5}, 2, 4)
    'with query $like: ab': testCursorApi({$like: 'ab'}, 5, 7)
    'with query $like: abc': testCursorApi({$like: 'abc'}, 6, 7)
    'with query $like: [1, 2]': testCursorApi({$like: [1, 2]}, 7)
    'with query $like: [1, 2, 3]': testCursorApi({$like: [1, 2, 3]}, 8)
    'with query $like: [1, 2, 3, 4]': testCursorApi({$like: [1, 2, 3, 4]}, 9)
    'with query $eq: ab': testCursorApi({$eq: 'ab'}, 5, 6)


  run(suite)


module.exports = testApi
