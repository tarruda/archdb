MemoryStorage = require('../src/memory_storage')
BitArray = require('../src/bit_array')
{normalize, denormalize} = require('../src/util')
{AvlTree, AvlNode} = require('../src/avl')

tests =
  'AvlNode':
    '**setup**': ->
      @node = new AvlNode(5, 'value')
      @node.leftRef = 'abc'
      @node.rightRef = 'def'


    'normalizes to a simple array': ->
      expect(@node.normalize()).to.deep.eql([5, 'value', 'abc', 'def', 0])


    'has attributes correctly set': ->
      expect(@node.key.normalize()).to.eql(5)
      expect(@node.value).to.eql('value')
      expect(@node.leftRef).to.eql('abc')
      expect(@node.rightRef).to.eql('def')
      expect(@node.height).to.eql(0)


  'AvlTree':
    '**setup**': ->
      @dbStorage = new MemoryStorage()
      @tree = new AvlTree(@dbStorage)


    'manages committed and uncommitted data transparently': (done) ->
      insCommit(@tree, 1, 1, =>
        expect(@tree.count).to.eql(1)
        expect(inspectStorage(@dbStorage, @tree.rootRef)).to.deep.eql([1])
        insCommit(@tree, 2, 3, =>
          expect(@tree.count).to.eql(3)
          expect(inspectStorage(@dbStorage, @tree.rootRef)).to.deep.eql([
            2,
          1,  3
          ])
          insCommit(@tree, 4, 7, =>
            expect(@tree.count).to.eql(7)
            expect(inspectStorage(@dbStorage, @tree.rootRef)).to.deep.eql([
                  4,
              2,      6,
            1,  3,  5,  7
            ])
            insCommit(@tree, 8, 15, =>
              expect(@tree.count).to.eql(15)
              expect(inspectStorage(@dbStorage, @tree.rootRef)).to.deep.eql([
                             8,
                    4,               12,
                2,      6,      10,       14,
              1,  3,  5,  7,   9, 11,   13, 15
              ])
              rootRef = @tree.rootRef
              insTransaction(@tree, 16, 31, =>
                expect(@tree.count).to.eql(31)
                @tree.levelOrder((err, items) =>
                  # this state is only visible in the current transaction
                  expect(items).to.deep.eql([
                    16,
                    8, 24,
                    4, 12, 20, 28,
                    2, 6, 10, 14, 18, 22, 26, 30,
                    1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31
                  ])
                  # not committed, so the persisted tree state wasn't
                  # modified
                  expect(inspectStorage(@dbStorage, rootRef)).to.deep.eql([
                                 8,
                        4,               12,
                    2,      6,      10,       14,
                  1,  3,  5,  7,   9, 11,   13, 15
                  ])
                  @tree.commit(true, (err) =>
                    expect(inspectStorage(@dbStorage,
                      @tree.rootRef)).to.deep.eql([
                      16,
                      8, 24,
                      4, 12, 20, 28,
                      2, 6, 10, 14, 18, 22, 26, 30,
                      1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31
                    ])
                    done())))))))


iterationHeightSuite =
  'height':
    'is logarithmic': (done) ->

      cb = (err, node) =>
        expect(@tree.count).to.eql(256)
        expect(node.height).to.eql(8)
        done()

      @ins(@tree, 1, 256, =>
        if @tree.root then cb(null, @tree.root)
        else @tree.resolveNode(@tree.rootRef, cb))


  'iterate':
    '**setup**': (done) ->
      @size = 80
      @ins(@tree, @size, 1, done)


    'in order': (done) ->
      inOrder(null, @tree, (items) =>
        expect(@tree.count).to.eql(80)
        expectFromTo(items, 1, @size)
        done())


    'in order with filter': (done) ->
      i = 1

      testFilter = =>
        inOrder(new BitArray(i), @tree, (items) =>
          expectFromTo(items, i, @size)
          i++
          if i <= @size then $yield(testFilter)
          else done())

      testFilter()


    'reverse in order': (done) ->
      revOrder(null, @tree, (items) =>
        expect(@tree.count).to.eql(80)
        expectFromTo(items, @size, 1)
        done())


    'reverse in order with filter': (done) ->
      i = @size

      testFilter = =>
        revOrder(new BitArray(i), @tree, (items) =>
          expectFromTo(items, i, 1)
          i++
          if i <= @size then $yield(testFilter)
          else done())

      testFilter()


  'random access':
    '**setup**': (done) -> @ins(@tree, 1, 80, done)


    'inserted keys': ->
      expect(lookup(@tree, 1)).to.eql('2')
      expect(lookup(@tree, 2)).to.eql('4')
      expect(lookup(@tree, 10)).to.eql('20')
      expect(lookup(@tree, 45)).to.eql('90')
      expect(lookup(@tree, 50)).to.eql('100')
      expect(lookup(@tree, 80)).to.eql('160')


    'updated keys': (done) ->
      @tree.set(1, 1, =>
        @tree.set(2, 2, =>
          @tree.set(10, 10, =>
            @tree.set(45, 45, =>
              expect(lookup(@tree, 1)).to.eql(1)
              expect(lookup(@tree, 2)).to.eql(2)
              expect(lookup(@tree, 10)).to.eql(10)
              expect(lookup(@tree, 45)).to.eql(45)
              done()))))


    'inexistent keys': ->
      expect(lookup(@tree, 0)).to.be.null
      expect(lookup(@tree, 81)).to.be.null
      expect(lookup(@tree, 100)).to.be.null


descendingInsertRotations =
  '24-22': [
    23,
    22, 24
  ]
  '24-20': [
    23,
    21, 24,
    20, 22
  ]
  '24-19': [
    21,
    20, 23,
    19, 22, 24
  ]
  '24-18': [
    21,
    19, 23,
    18, 20, 22, 24
  ]
  '24-16': [
    21,
    19, 23,
    17, 20, 22,24,
    16,18
  ]
  '24-15': [
    21,
    17, 23,
    16, 19, 22, 24,
    15, 18, 20
  ]
  '24-14': [
    21,
    17, 23,
    15, 19, 22, 24,
    14, 16, 18, 20
  ]
  '24-13': [
    17,
    15, 21,
    14, 16, 19, 23,
    13, 18, 20, 22, 24
  ]
  '24-12': [
    17,
    15, 21,
    13, 16, 19, 23,
    12, 14, 18, 20, 22, 24
  ]
  '24-11': [
    17,
    13, 21,
    12, 15, 19, 23,
    11, 14, 16, 18, 20, 22, 24
  ]
  '24-10': [
    17,
    13, 21,
    11, 15, 19, 23,
    10, 12, 14, 16, 18, 20, 22, 24
  ]
  '24-8': [
    17,
    13, 21,
    11, 15, 19, 23,
    9, 12, 14, 16, 18, 20, 22, 24,
    8, 10
  ]
  '24-7': [
    17,
    13, 21,
    9, 15, 19, 23,
    8, 11, 14, 16, 18, 20, 22, 24,
    7, 10, 12
  ]
  '24-6': [
    17,
    13, 21,
    9, 15, 19, 23,
    7, 11, 14, 16, 18, 20, 22, 24,
    6, 8, 10, 12
  ]
  '24-5': [
    17,
    9, 21,
    7, 13, 19, 23,
    6, 8, 11, 15, 18, 20, 22, 24,
    5, 10, 12, 14, 16
  ]
  '24-4': [
    17,
    9, 21,
    7, 13, 19, 23,
    5, 8, 11, 15, 18, 20, 22, 24,
    4, 6, 10, 12, 14, 16
  ]
  '24-3': [
    17,
    9, 21,
    5, 13, 19, 23,
    4, 7, 11, 15, 18, 20, 22, 24,
    3, 6, 8, 10, 12, 14, 16
  ]
  '24-2': [
    17,
    9, 21,
    5, 13, 19, 23,
    3, 7, 11, 15, 18, 20, 22, 24,
    2, 4, 6, 8, 10, 12, 14, 16
  ]
  '24-1': [
    9,
    5, 17,
    3, 7, 13, 21,
    2, 4, 6, 8, 11, 15, 19, 23,
    1, 10, 12, 14, 16, 18, 20, 22, 24
  ]


descendingDeleteRotations =
  '24-22': [
    9,
    5, 17,
    3, 7, 13, 19,
    2, 4, 6, 8, 11, 15, 18, 21,
    1, 10, 12, 14, 16, 20
  ]
  '24-19': [
    9,
    5, 13,
    3, 7, 11, 17,
    2, 4, 6, 8, 10, 12, 15, 18,
    1, 14, 16
  ]
  '24-16': [
    9,
    5, 13,
    3, 7, 11, 15,
    2, 4, 6, 8, 10, 12, 14,
    1
  ]
  '24-13': [
    5,
    3, 9,
    2, 4, 7, 11,
    1, 6, 8, 10, 12
  ]
  '24-10': [
    5,
    3, 7,
    2, 4, 6, 9,
    1, 8
  ]
  '24-7': [
    3,
    2, 5,
    1, 4, 6
  ]
  '24-4': [
    2,
    1, 3
  ]
  '24-2': [1]
  '24-1': []


ascendingInsertRotations =
  '1-3': [
    2,
    1, 3
  ]
  '1-5': [
    2,
    1, 4,
    3, 5
  ]
  '1-6': [
    4,
    2, 5,
    1, 3, 6
  ]
  '1-7': [
    4,
    2, 6,
    1, 3, 5, 7
  ]
  '1-9': [
    4,
    2, 6,
    1, 3, 5, 8,
    7, 9
  ]
  '1-10': [
    4,
    2, 8,
    1, 3, 6, 9,
    5, 7, 10
  ]
  '1-11': [
    4,
    2, 8,
    1, 3, 6, 10,
    5, 7, 9, 11
  ]
  '1-12': [
    8,
    4, 10,
    2, 6, 9, 11,
    1, 3, 5, 7, 12
  ]
  '1-13': [
    8,
    4, 10,
    2, 6, 9, 12,
    1, 3, 5, 7, 11, 13
  ]
  '1-14': [
    8,
    4, 12,
    2, 6, 10, 13,
    1, 3, 5, 7, 9, 11, 14
  ]
  '1-15': [
    8,
    4, 12,
    2, 6, 10, 14,
    1, 3, 5, 7, 9, 11, 13, 15
  ]
  '1-16': [
     8,
     4, 12,
     2, 6, 10, 14,
     1, 3, 5, 7, 9, 11, 13, 15,
     16
  ]
  '1-17': [
    8,
    4, 12,
    2, 6, 10, 14,
    1, 3, 5, 7, 9, 11, 13, 16,
    15, 17
  ]
  '1-18': [
    8,
    4, 12,
    2, 6, 10, 16,
    1, 3, 5, 7, 9, 11, 14, 17,
    13, 15, 18
  ]
  '1-19': [
    8,
    4, 12,
    2, 6, 10, 16,
    1, 3, 5, 7, 9, 11, 14, 18,
    13, 15, 17, 19
  ]
  '1-20': [
    8,
    4, 16,
    2, 6, 12, 18,
    1, 3, 5, 7, 10, 14, 17, 19,
    9, 11, 13, 15, 20
  ]
  '1-21': [
    8,
    4, 16,
    2, 6, 12, 18,
    1, 3, 5, 7, 10, 14, 17, 20,
    9, 11, 13, 15, 19, 21
  ]
  '1-22': [
    8,
    4, 16,
    2, 6, 12, 20,
    1, 3, 5, 7, 10, 14, 18, 21,
    9, 11, 13, 15, 17, 19, 22
  ]
  '1-23': [
    8,
    4, 16,
    2, 6, 12, 20,
    1, 3, 5, 7, 10, 14, 18, 22,
    9, 11, 13, 15, 17, 19, 21, 23
  ]
  '1-24': [
    16,
    8, 20,
    4, 12, 18, 22,
    2, 6, 10, 14, 17, 19, 21, 23,
    1, 3, 5, 7, 9, 11, 13, 15, 24
  ]


ascendingDeleteRotations =
  '1-3': [
    16,
    8, 20,
    6, 12, 18, 22,
    4, 7, 10, 14, 17, 19, 21, 23,
    5, 9, 11, 13, 15, 24
  ]
  '1-5': [
    16,
    8, 20,
    6, 12, 18, 22,
    7, 10, 14, 17, 19, 21, 23,
    9, 11, 13, 15, 24
  ]
  '1-6': [
    16,
    12, 20,
    8, 14, 18, 22,
    7, 10, 13, 15, 17, 19, 21, 23,
    9, 11, 24
  ]
  '1-7': [
    16,
    12, 20,
    10, 14, 18, 22,
    8, 11, 13, 15, 17, 19, 21, 23,
    9, 24
  ]
  '1-9': [
    16,
    12, 20,
    10, 14, 18, 22,
    11, 13, 15, 17, 19, 21, 23,
    24
  ]
  '1-12': [
    20,
    16, 22,
    14, 18, 21, 23,
    13, 15, 17, 19, 24
  ]
  '1-15': [
    20,
    18, 22,
    16, 19, 21, 23,
    17, 24
  ]
  '1-18': [
    22,
    20, 23,
    19, 21, 24
  ]
  '1-21': [
    23,
    22, 24,
  ]
  '1-23': [24]
  '1-24': []


deleteInternalNodes =
  '20': [
    16,
    8, 19,
    4, 12, 18, 22,
    2, 6, 10, 14, 17, 21, 23,
    1, 3, 5, 7, 9, 11, 13, 15, 24
  ],
  '20,16': [
    15,
    8, 19,
    4, 12, 18, 22,
    2, 6, 10, 14, 17, 21, 23,
    1, 3, 5, 7, 9, 11, 13, 24
  ]
  '20,16,12': [
    15,
    8, 19,
    4, 11, 18, 22,
    2, 6, 10, 14, 17, 21, 23,
    1, 3, 5, 7, 9, 13, 24
  ]
  '20,16,12,11': [
    15,
    8, 19,
    4, 10, 18, 22,
    2, 6, 9, 14, 17, 21, 23,
    1, 3, 5, 7, 13, 24
  ]
  '20,16,12,11,10': [
    15,
    8, 19,
    4, 13, 18, 22,
    2, 6, 9, 14, 17, 21, 23,
    1, 3, 5, 7, 24
  ]
  '20,16,12,11,10,13': [
    15,
    8, 19,
    4, 9, 18, 22,
    2, 6, 14, 17, 21, 23,
    1, 3, 5, 7, 24
  ]
  '20,16,12,11,10,13,9': [
    15,
    4, 19,
    2, 8, 18, 22,
    1, 3, 6, 14, 17, 21, 23,
    5, 7, 24
  ]
  '20,16,12,11,10,13,9,19': [
    15,
    4, 22,
    2, 8, 18, 23,
    1, 3, 6, 14, 17, 21, 24,
    5, 7
  ]
  '20,16,12,11,10,13,9,19,22': [
    15,
    4, 21,
    2, 8, 18, 23,
    1, 3, 6, 14, 17, 24,
    5, 7
  ]
  '20,16,12,11,10,13,9,19,22,21': [
    15,
    4, 18,
    2, 8, 17, 23,
    1, 3, 6, 14, 24,
    5, 7
  ]
  '20,16,12,11,10,13,9,19,22,21,15': [
    14,
    4, 18,
    2, 6, 17, 23,
    1, 3, 5, 8, 24,
    7
  ]
  '20,16,12,11,10,13,9,19,22,21,15,18': [
    6,
    4, 14,
    2, 5, 8, 23,
    1, 3, 7, 17, 24
  ]
  '20,16,12,11,10,13,9,19,22,21,15,18,14': [
    6,
    4, 8,
    2, 5, 7, 23,
    1, 3, 17, 24
  ]
  '20,16,12,11,10,13,9,19,22,21,15,18,14,23': [
    6,
    4, 8,
    2, 5, 7, 17,
    1, 3, 24
  ]
  '20,16,12,11,10,13,9,19,22,21,15,18,14,23,8': [
    6,
    4, 17,
    2, 5, 7, 24,
    1, 3
  ]
  '20,16,12,11,10,13,9,19,22,21,15,18,14,23,8,17': [
    6,
    4, 7,
    2, 5, 24,
    1, 3
  ]
  '20,16,12,11,10,13,9,19,22,21,15,18,14,23,8,17,7': [
    4,
    2, 6,
    1, 3, 5, 24
  ]
  '20,16,12,11,10,13,9,19,22,21,15,18,14,23,8,17,7,4': [
    3,
    2, 6,
    1, 5, 24
  ]
  '20,16,12,11,10,13,9,19,22,21,15,18,14,23,8,17,7,4,3': [
    2,
    1, 6,
    5, 24
  ]
  '20,16,12,11,10,13,9,19,22,21,15,18,14,23,8,17,7,4,3,2': [
    6,
    1, 24,
    5
  ]
  '20,16,12,11,10,13,9,19,22,21,15,18,14,23,8,17,7,4,3,2,6': [
    5,
    1, 24
  ]


generateInsertSuite = (suite) ->
  rv = {}
  for own k, v of suite
    name = k
    if /^(?:only|skip):/.test(k)
      name = k.slice(5)
    [start, end] = name.split('-')
    start = parseInt(start)
    end = parseInt(end)
    do (start, end, k, v) ->
      rv[k] = (done) ->
        @ins(@tree, start, end, (err) =>
          expect(@tree.count).to.eql(v.length)
          expect(@inspect(@tree)).to.deep.eql(v)
          done())
  return rv


generateDeleteSuite = (suite, reverseInsert = false) ->
  if reverseInsert
    rv = '**setup**': (done) -> @ins(@tree, 24, 1, done)
  else
    rv = '**setup**': (done) -> @ins(@tree, 1, 24, done)
  for own k, v of suite
    name = k
    if /^(?:only|skip):/.test(k)
      name = k.slice(5)
    [start, end] = name.split('-')
    start = parseInt(start)
    end = parseInt(end)
    do (start, end, k, v) ->
      rv[k] = (done) ->
        @del(@tree, start, end, (err) =>
          expect(@tree.count).to.eql(v.length)
          expect(@inspect(@tree)).to.deep.eql(v)
          done())
  return rv


generateDeleteSeqSuite = (suite) ->
  rv = '**setup**': (done) -> @ins(@tree, 1, 24, done)
  for own k, v of suite
    name = k
    if /^(?:only|skip):/.test(k)
      name = k.slice(5)
    args = name.split(',').map((n) -> parseInt(n))
    do (args, k, v) ->
      rv[k] = (done) ->
        args.unshift(@tree)
        args.push((err) =>
          expect(@tree.count).to.eql(v.length)
          expect(@inspect(@tree)).to.deep.eql(v)
          done())
        @delSeq.apply(this, args)
  return rv


generateSuite = (title, ins, del, delSeq, inspect) ->
  rv = {}
  rv[title] =
    '**setup**': ->
      @dbStorage = new MemoryStorage()
      @tree = new AvlTree(@dbStorage)
      @ins = (args...) => ins.apply(this, args)
      @del = del
      @delSeq = delSeq
      @inspect = inspect
    'iteration/height': iterationHeightSuite
    'descending insert rotations': generateInsertSuite(
      descendingInsertRotations)
    'descending delete rotations': generateDeleteSuite(
      descendingDeleteRotations, true)
    'ascending insert rotations': generateInsertSuite(
      ascendingInsertRotations)
    'ascending delete rotations': generateDeleteSuite(
      ascendingDeleteRotations)
    'delete internal nodes': generateDeleteSeqSuite(
      deleteInternalNodes)

  return rv


inspectStorage = (dbStorage, rootRef) ->
  rv = []

  if not rootRef then return rv

  q = []
  q.push(rootRef)

  while q.length
    val = q.shift().valueOf()
    data = dbStorage.indexNode[val]
    rv.push(data[0])
    if data[2] then q.push(denormalize(data[2]))
    if data[3] then q.push(denormalize(data[3]))

  return rv


inspectStorageTree = (tree) ->
  inspectStorage(@dbStorage, tree.rootRef)


inspect = (tree) ->
  # level-order iteration for inspecting/debugging the tree
  rv = []

  if not tree.root
    return rv

  q = []
  q.push(tree.root)

  while q.length
    node = q.shift()
    rv.push(node.key.normalize())
    if node.left then q.push(node.left)
    if node.right then q.push(node.right)

  return rv


insCommit = (tree, from, to, cb) ->
  i = from

  next = (err) ->
    if (from < to and i > to) or (from >= to and i < to)
      return tree.commit(true, cb)
    tree.set(i, ((if from < to then i++ else i--) * 2).toString(), next)

  next()


delCommit = (tree, from, to, cb) ->
  i = from

  next = (err) ->
    if (from < to and i > to) or (from >= to and i < to)
      return tree.commit(true, cb)
    tree.del((if (from < to) then i++ else i--), next)

  next()


delSeqCommit = ->
  args = arguments
  tree = args[0]
  cb = args[arguments.length - 1]
  i = 1

  next = (err) ->
    if i == args.length - 1
      return tree.commit(true, cb)
    tree.del(args[i++], next)

  next()


insTransaction = (tree, from, to, cb) ->
  i = from

  next = (err) ->
    if (from < to and i > to) or (from >= to and i < to) then return cb()
    tree.set(i, ((if from < to then i++ else i--) * 2).toString(), next)

  next()


delTransaction = (tree, from, to, cb) ->
  i = from

  next = (err) ->
    if (from < to and i > to) or (from >= to and i < to) then return cb()
    tree.del((if (from < to) then i++ else i--), next)

  next()


delSeqTransaction = ->
  args = arguments
  tree = args[0]
  cb = args[arguments.length - 1]
  i = 1

  next = (err) ->
    if i == args.length - 1
      return cb()
    tree.del(args[i++], next)

  next()


inOrder = (min, tree, cb) ->
  rv = []

  tree.inOrder(min, (err, next, node) ->
    if not next then return cb(rv)
    rv.push(node.key.normalize())
    next())


revOrder = (max, tree, cb) ->
  rv = []

  tree.revInOrder(max, (err, next, node) ->
    if not next then return cb(rv)
    rv.push(node.key.normalize())
    next())


expectFromTo = (items, from, to) ->
  expected = []

  for i in [from..to]
    expected.push(i)

  expect(expected).to.deep.eql(items)


lookup = (tree, key) ->
  rv = null
  tree.get(key, (err, value) -> rv = value)
  return rv


run(tests)
run(generateSuite('uncommitted', insTransaction, delTransaction,
  delSeqTransaction, inspect))
run(generateSuite('committed', insCommit, delCommit, delSeqCommit,
  inspectStorageTree))
