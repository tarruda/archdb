BitArray = require('./bit_array')
{ObjectRef} = require('./util')

# using negative numbers as temporary node ids allow us to easily
# identify if the node is new(was not persisted yet)
avlNodeId = 1


refEquals = (a, b) ->
  if a instanceof ObjectRef
    return a.equals(b)
  return a == b


class AvlNode
  constructor: (key, value) ->
    @key = if key instanceof BitArray then key else new BitArray(key)
    @value = value
    @left = null
    @leftRef = null
    @right = null
    @rightRef = null
    @height = 0
    @ref = avlNodeId++


  getKey: -> @key


  getValue: -> @value


  normalize: -> [@key.normalize(), @value, @leftRef, @rightRef, @height]


  volatile: -> typeof @ref == 'number'


  clone: ->
    rv = new AvlNode(@key.clone(), @value)
    rv.left = @left
    rv.leftRef = @leftRef
    rv.right = @right
    rv.rightRef = @rightRef
    rv.height = @height
    return rv


  refreshHeight: ->
    h = 0; left = @left; right = @right
    h = Math.max(h, if left == null then 0 else left.height + 1)
    h = Math.max(h, if right == null then 0 else right.height + 1)
    @height = h


  balanceFactor: ->
    left = @left; right = @right
    leftHeight = if left == null then -1 else left.height
    rightHeight = if right == null then -1 else right.height
    return leftHeight - rightHeight


class AvlTree
  constructor: (@dbStorage, @rootRef, @count = 0) ->
    @originalRootRef = rootRef
    @root = null


  get: (key, cb) ->
    searchCb = (err, comp, path) =>
      if err then return cb(err, null)
      if comp == 0 then return cb(null, path[path.length - 1].value)
      cb(null, null)

    getCb = (err, node) =>
      @root = node
      @search(false, key, searchCb)

    key = if key instanceof BitArray then key.clone() else new BitArray(key)

    if not @rootRef then return cb(null, null)

    if @root
      @search(false, key, searchCb)
    else
      @resolveNode(@rootRef, getCb)
    return


  set: (key, value, cb) ->
    searchCb = (err, comp, path) =>
      if err then return cb(err, null)
      node = path[path.length - 1]
      if comp == 0
        oldValue = node.value
        node.value = value
        return cb(null, oldValue)
      if comp < 0
        node.left = new AvlNode(key, value)
        node.leftRef = node.left.ref
      else
        node.right = new AvlNode(key, value)
        node.rightRef = node.right.ref
      @count++
      @ensureIsBalanced(oldValue, path, cb)

    getCb = (err, node) =>
      if err then return cb(err, null)
      @root = node
      @search(true, key, searchCb)

    key = if key instanceof BitArray then key.clone() else new BitArray(key)

    if not @rootRef
      @root = new AvlNode(key, value)
      @rootRef = @root.ref
      @count++
      return cb(null, null)
    else if @root
      @search(true, key, searchCb)
    else
      @resolveNode(@rootRef, getCb)


  del: (key, cb) ->
    path = null

    searchCb = (err, comp, p) =>
      if err then return cb(err, null)
      if comp != 0 then return cb(null, null)
      path = p
      @delNode(path, delCb)

    getCb = (err, node) =>
      if err then return cb(err, null)
      @root = node
      @search(true, key, searchCb)

    delCb = (err, oldValue) =>
      if err then return cb(err, null)
      @count--
      @ensureIsBalanced(oldValue, path, cb)

    key = if key instanceof BitArray then key.clone() else new BitArray(key)

    if not @rootRef
      return cb(null, null)
    else if @root
      @search(true, key, searchCb)
    else
      @resolveNode(@rootRef, getCb)


  getCount: -> @count


  inOrder: (minKey, cb) ->
    nextNode = null; paused = null; path = []

    rootCb = (err, root) =>
      if err then return cb(err, null, null)
      if minKey then searchMinCb(null, root)
      else nodeCb(null, root)

    nextNodeCb = (stop) =>
      if paused then throw new Error('called too many times')
      paused = true
      if stop then return cb(null, null, null)
      $yield(visitNext)

    visitNext = => @resolveRight(nextNode, nodeCb)

    searchMinCb = (err, node) =>
      if err then return cb(err, null, null)
      if not node then return nodeCb(null, null)
      comp = minKey.compareTo(node.key)
      if comp < 0
        path.push(node)
        @resolveLeft(node, searchMinCb)
      else if comp > 0
        @resolveRight(node, searchMinCb)
      else
        nextNode = node
        cb(null, nextNodeCb, node)

    nodeCb = (err, node) =>
      if err then return cb(err, null, null)
      if not node and not path.length then return cb(null, null, null)
      if node
        path.push(node)
        return @resolveLeft(node, nodeCb)
      node = path.pop()
      nextNode = node
      paused = false
      cb(null, nextNodeCb, node)

    if not @rootRef then return cb(null, null, null)
    if not @root then return @resolveNode(@rootRef, rootCb)
    rootCb(null, @root)


  revInOrder: (maxKey, cb) ->
    nextNode = null; paused = null; path = []

    rootCb = (err, root) =>
      if err then return cb(err, null, null)
      if maxKey then searchMinCb(null, root)
      else nodeCb(null, root)

    nextNodeCb = (stop) =>
      if paused then throw new Error('called too many times')
      paused = true
      if stop then return cb(null, null, null)
      $yield(visitNext)

    visitNext = => @resolveLeft(nextNode, nodeCb)

    searchMinCb = (err, node) =>
      if err then return cb(err, null, null)
      if not node then return nodeCb(null, null)
      comp = maxKey.compareTo(node.key)
      if comp > 0
        path.push(node)
        @resolveRight(node, searchMinCb)
      else if comp < 0
        @resolveLeft(node, searchMinCb)
      else
        nextNode = node
        cb(null, nextNodeCb, node)

    nodeCb = (err, node) =>
      if err then return cb(err, null, null)
      if not node and not path.length then return cb(null, null, null)
      if node
        path.push(node)
        return @resolveRight(node, nodeCb)
      node = path.pop()
      nextNode = node
      paused = false
      cb(null, nextNodeCb, node)

    if not @rootRef then return cb(null, null, null)
    if not @root then return @resolveNode(@rootRef, rootCb)
    rootCb(null, @root)


  levelOrder: (cb) ->
    q = null; node = null; rv = []

    leftCb = (err, left) =>
      q.push(left)
      if node.rightRef then @resolveRight(node, rightCb)
      else $yield(nextNode)

    rightCb = (err, right) =>
      q.push(right)
      $yield(nextNode)

    nextNode = =>
      if not q.length then return cb(null, rv)
      node = q.shift()
      rv.push(node.key.normalize())
      if node.leftRef then @resolveLeft(node, leftCb)
      else if node.rightRef then @resolveRight(node, rightCb)
      else $yield(nextNode)

    if not @rootRef then return cb(null, rv)

    q = []

    if not @root then @resolveNode(@rootRef, rightCb)
    else rightCb(null, @root)


  commit: (releaseCache, cb) ->
    current = pending = parents = null

    flushNodeCb = (err, ref) =>
      if err then return cb(err)
      currentRef = current.ref
      current.ref = ref
      if parents.length
        parent = parents.pop()
        if parent.leftRef and refEquals(parent.leftRef, currentRef)
          parent.leftRef = current.ref
          if releaseCache then parent.left = null
        else
          parent.rightRef = current.ref
          if releaseCache then parent.right = null
        pending.push(parent)
        visit()
      else
        @rootRef = @originalRootRef = ref
        if releaseCache then @root = null
        cb(null)

    visit = =>
      current = pending.pop()
      if current.left and current.left.volatile()
        parents.push(current)
        pending.push(current.left)
        return $yield(visit)
      else if current.right and current.right.volatile()
        parents.push(current)
        pending.push(current.right)
        return $yield(visit)
      else
        @dbStorage.saveIndexNode(current.normalize(), flushNodeCb)

    if not @root or not @root.volatile() then return cb(null)

    pending = [@root]
    parents = []
    visit()


  getRootRef: -> @rootRef


  getOriginalRootRef: -> @originalRootRef


  setOriginalRootRef: (ref) -> @originalRootRef = ref


  modified: -> @rootRef != @originalRootRef


  search: (copyPath, key, cb) ->
    comp = current = null; path = []

    nodeCb = (err, node) =>
      if err then return cb(err, null, null)
      if not node then return cb(null, comp, path)
      if copyPath and not node.volatile()
        nodeId = node.ref
        node = node.clone()
        if nodeId == current.leftRef
          current.leftRef = node.ref
          current.left = node
        else
          current.rightRef = node.ref
          current.right = node
      current = node
      get()

    get = =>
      path.push(current)
      comp = key.compareTo(current.key)
      if comp < 0
        @resolveLeft(current, nodeCb)
      else if comp > 0
        @resolveRight(current, nodeCb)
      else
        cb(null, comp, path)

    if copyPath and not @root.volatile()
      @root = @root.clone()
      @rootRef = @root.ref

    current = @root
    get()


  delNode: (path, cb) ->
    oldValue = null
    node = path[path.length - 1]
    parent = path[path.length - 2]
    oldValue = node.value

    delCb = (err, old) =>
      if err then return cb(err, null)
      if old != node.value
        # TODO remove debug assert
        throw new Error('invalid expected value')
      cb(null, oldValue)

    inOrderCb = (err, inOrderPredecessor) =>
      if err then return cb(err, null)
      node.key = inOrderPredecessor.key
      node.value = inOrderPredecessor.value
      @delNode(path, delCb)

    nodeCb = (err, child) =>
      if err then return cb(err, null)
      # replace the node with its child
      if parent
        if parent.leftRef and refEquals(parent.leftRef, node.ref)
          parent.leftRef = child.ref
          parent.left = child
        else
          parent.rightRef = child.ref
          parent.right = child
      else
        @rootRef = child.ref
        @root = child
      path.pop()
      cb(null, oldValue)

    if node.leftRef and node.rightRef
      @findInOrderPredecessor(path, inOrderCb)
    else
      if not node.leftRef and not node.rightRef
        if parent
          if parent.leftRef and refEquals(parent.leftRef, node.ref)
            parent.leftRef = null
            parent.left = null
          else
            parent.rightRef = null
            parent.right = null
        else
          @rootRef = null
          @root = null
        path.pop()
        cb(null, oldValue)
      else if not node.leftRef
        @resolveRight(node, nodeCb)
      else if not node.rightRef
        @resolveLeft(node, nodeCb)


  findInOrderPredecessor: (path, cb) ->
    parent = path[path.length - 1]

    currentCb = (err, current) =>
      if err then return cb(err, null)
      if current == null
        # TODO remove debug assert
        throw new Error('invalid tree state')
      if not current.volatile()
        currentRef = current.ref
        current = current.clone()
        if parent.leftRef and refEquals(parent.leftRef, currentRef)
          parent.left = current
          parent.leftRef = current.ref
        else
          parent.right = current
          parent.rightRef = current.ref
      if current.rightRef != null
        parent = current
        path.push(parent)
        return @resolveRight(current, currentCb)
      path.push(current)
      cb(null, current)

    @resolveLeft(parent, currentCb)


  ensureIsBalanced: (oldValue, path, cb) ->
    node = null

    nextParent = (err) =>
      if not path.length then return cb(null, oldValue)
      node = path.pop()
      # it is possible one of the node's child was not retrieved
      # from db storage yet
      if node.leftRef and not node.left
        @resolveLeft(node, childCb)
      else if node.rightRef and not node.right
        @resolveRight(node, childCb)
      else
        checkBalance()

    childCb = (err, child) =>
      if err then return cb(err, null)
      if refEquals(child.ref, node.leftRef) then node.left = child
      else node.right = child
      if (node.leftRef and not node.left) or (node.rightRef and not node.right)
        # TODO remove debug assert
        throw new Error('invalid tree state')
      checkBalance()

    checkBalance = =>
      node.refreshHeight()
      bf = node.balanceFactor()
      if bf == -2
        @resolveLeft(node.right, rightLeftCb)
      else if bf == 2
        @resolveLeft(node.left, leftLeftCb)
      else if bf > 2 or bf < -2
        # TODO remove debug assert
        throw new Error('Invalid tree state')
      else
        $yield(nextParent)

    rightLeftCb = (err, rightLeft) =>
      if err then return cb(err, null)
      @resolveRight(node.right, rightRightCb)

    rightRightCb = (err, rightRight) =>
      if err then return cb(err, null)
      if node.right.balanceFactor() == 1
        if not node.right.volatile()
          node.right = node.right.clone()
          node.rightRef = node.right.ref
        @rotateRight(node.right, rotateRightCb)
      else
        $yield(rotateRightCb)

    leftLeftCb = (err, leftLeft) =>
      if err then return cb(err, null)
      @resolveRight(node.left, leftRightCb)

    leftRightCb = (err, leftLeft) =>
      if err then return cb(err, null)
      if node.left.balanceFactor() == -1
        if not node.left.volatile()
          node.left = node.left.clone()
          node.leftRef = node.left.ref
        @rotateLeft(node.left, rotateLeftCb)
      else
        $yield(rotateLeftCb)

    rotateRightCb = (err) =>
      if err then return cb(err, null)
      @rotateLeft(node, nextParent)

    rotateLeftCb = (err) =>
      if err then return cb(err, null)
      @rotateRight(node, nextParent)

    nextParent(null)


  rotateLeft: (node, cb) ->
    right = node.right
    left = node.left
    leftRef = node.leftRef
    newLeft = new AvlNode(node.key, node.value)

    rightRightCb = (err) =>
      if err then return cb(err)
      # set new right
      node.right = right.right
      node.rightRef = right.rightRef
      @resolveLeft(right, rightLeftCb)

    rightLeftCb = (err) =>
      if err then return cb(err)
      # transfer the old right's left to the new left's right
      newLeft.right = right.left
      newLeft.rightRef = right.leftRef
      # recalculate heights
      newLeft.refreshHeight()
      node.refreshHeight()
      cb(null)

    if not right
      # TODO remove debug assert
      throw new Error('right node not resolved!')

    # update key/value
    node.key = right.key
    node.value = right.value
    # set new left
    newLeft.left = left
    newLeft.leftRef = leftRef
    node.left = newLeft
    node.leftRef = newLeft.ref
    @resolveRight(right, rightRightCb)


  rotateRight: (node, cb) ->
    right = node.right
    rightRef = node.rightRef
    left = node.left
    newRight = new AvlNode(node.key, node.value)

    leftLeftCb = (err) =>
      if err then return cb(err)
      # set new left
      node.left = left.left
      node.leftRef = left.leftRef
      @resolveRight(left, leftRightCb)

    leftRightCb = (err) =>
      if err then return cb(err)
      # transfer the old left's right to the new right's left
      newRight.left = left.right
      newRight.leftRef = left.rightRef
      # recalculate heights
      newRight.refreshHeight()
      node.refreshHeight()
      cb(null)

    if not left
      # TODO remove debug assert
      throw new Error('left node not resolved!')

    # update key/value
    node.key = left.key
    node.value = left.value
    # set new right
    newRight.right = right
    newRight.rightRef = rightRef
    node.right = newRight
    node.rightRef = newRight.ref
    @resolveLeft(left, leftLeftCb)


  resolveNode: (ref, cb) ->
    getCb = (err, array) =>
      if err then return cb(err, null)
      node = new AvlNode(array[0], array[1])
      node.leftRef = array[2]
      node.rightRef = array[3]
      node.height = array[4]
      node.ref = ref
      cb(null, node)

    @dbStorage.getIndexNode(ref, getCb)


  resolveLeft: (from, cb) ->
    getCb = (err, node) =>
      if err then return cb(err, null)
      from.left = node
      cb(null, node)

    if from.left then return cb(null, from.left)
    if not from.leftRef then return cb(null, null)
    @resolveNode(from.leftRef, getCb)


  resolveRight: (from, cb) ->
    getCb = (err, node) =>
      if err then return cb(err, null)
      from.right = node
      cb(null, node)

    if from.right then return cb(null, from.right)
    if not from.rightRef then return cb(null, null)
    @resolveNode(from.rightRef, getCb)


exports.AvlNode = AvlNode
exports.AvlTree = AvlTree
