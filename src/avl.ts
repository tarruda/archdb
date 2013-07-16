/// <reference path="./components.ts"/>

// using negative numbers as temporary node ids allow us to easily
// identify if the node is new(was not persisted yet)
var avlNodeId: number = -1;

class AvlNode implements DbObject {
  height: number;
  key: IndexKey;
  value: string;
  left: AvlNode;
  right: AvlNode;
  leftId: string;
  rightId: string;
  id: string;

  constructor(key: IndexKey, value: string) {
    this.key = key;
    this.value = value;
    this.left = null;
    this.right = null
    this.leftId = null;
    this.rightId = null;
    this.height = 0;
    this.id = (avlNodeId--).toString();
  }

  getType(): DbObjectType {
    return DbObjectType.IndexNode;
  }

  normalize(): Object {
    return [this.leftId, this.key.normalize(), this.rightId, this.value];
  }

  isNew(): boolean {
    return this.id[0] === '-';
  }

  clone(): AvlNode {
    var rv = new AvlNode(this.key.clone(), this.value);
    rv.left = this.left;
    rv.right = this.right;
    rv.leftId = this.leftId;
    rv.rightId = this.rightId;
    return rv; 
  }
}

interface AvlSearchCb {
  (err: Error, lastComparison: number, path: Array<AvlNode>);
}

class AvlTree implements DbIndexTree {
  dbStorage: DbStorage;
  rootId: string;
  root: AvlNode;

  constructor(dbStorage: DbStorage, rootId: string) {
    this.dbStorage = dbStorage;
    this.rootId = rootId;
    this.root = null;
  }

  get(key: IndexKey, cb: IdCb) {
    var searchCb = (err: Error, comp: number, path: Array<AvlNode>) => {
      if (err) return cb(err, null);
      if (comp === 0) return cb(null, path[path.length - 1].value);
      cb(null, null);
    };
    var getCb = (err: Error, node: AvlNode) => {
      this.root = node;
      this.search(node, key, searchCb);
    }

    if (!this.rootId) return cb(null, null);
    if (this.root) {
      this.search(this.root, key, searchCb);
    } else {
      this.dbStorage.get(this.rootId, getCb);
    }
  }

  set(key: IndexKey, value: string, cb: UpdateIndexCb) {
    var searchCb = (err: Error, comp: number, path: Array<AvlNode>) => {
      var node, oldValue;
      if (err) return cb(err, null);
      node = path[path.length - 1];
      if (!node.isNew()) node = node.clone();
      if (comp === 0) {
        oldValue = node.value;
        node.value = value;
        return cb(null, oldValue);
      }
      if (comp < 0) {
        node.left = new AvlNode(key, value);
        node.leftId = node.left.id;
      } else {
        node.right = new AvlNode(key, value);
        node.rightId = node.right.id;
      }
      ensureIsBalanced(path);
      cb(null, null);
    };
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      this.root = node;
      this.search(node, key, searchCb);
    };

    if (!this.rootId) {
      this.root = new AvlNode(key, value);
      this.rootId = this.root.id;
      return cb(null, null);
    } else if (this.root) {
      this.search(this.root, key, searchCb);
    } else {
      this.dbStorage.get(this.rootId, getCb);
    }
  }

  del(key: IndexKey, cb: UpdateIndexCb) {
    var searchCb = (err: Error, comp: number, p: Array<AvlNode>) => {
      if (err) return cb(err, null);
      if (comp !== 0) return cb(null, null);
      path = p;
      this.delNode(path, delCb);
    };
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      this.root = node;
      this.search(node, key, searchCb);
    };
    var delCb = (err: Error, oldValue: string) => {
      if (err) return cb(err, null);
      ensureIsBalanced(path);
      cb(null, oldValue);
    };

    var path;

    if (!this.rootId) {
      return cb(null, null);
    } else if (this.root) {
      this.search(this.root, key, searchCb);
    } else {
      this.dbStorage.get(this.rootId, getCb);
    }
  }

  inOrder(minKey: IndexKey, cb: VisitNodeCb) { }
  revInOrder(maxKey: IndexKey, cb: VisitNodeCb) { }
  getRootId(cb: IdCb) { }
  setRootId(id: string, cb: DoneCb) { }
  commit(cb: DoneCb) { }

  private getLeft(from: AvlNode, cb: DbObjectCb) {
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      from.left = node;
      cb(null, node);
    }

    if (from.left) return cb(null, from.left);
    if (!from.leftId) return cb(null, null);
    this.dbStorage.get(from.leftId, getCb);
  }

  private getRight(from: AvlNode, cb: DbObjectCb) {
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      from.right = node;
      cb(null, node);
    }

    if (from.right) return cb(null, from.right);
    if (!from.rightId) return cb(null, null);
    this.dbStorage.get(from.rightId, getCb);
  }

  private search(root: AvlNode, key: IndexKey, cb: AvlSearchCb) {
    var nodeCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null, null);
      if (!node) return cb(null, comp, path);
      current = node;
      get();
    }
    var get = () => {
      path.push(current);
      comp = key.compareTo(current.key);
      if (comp < 0) {
        this.getLeft(current, nodeCb);
      } else if (comp > 0) {
        this.getRight(current, nodeCb);
      } else {
        cb(null, comp, path);
      }
    };
    var path = [];
    var current: AvlNode;
    var comp: number;

    current = root;
    get();
  }

  private delNode(path: Array<AvlNode>, cb: UpdateIndexCb) {
    var delCb = (err: Error, old: string) => {
      if (err) return cb(err, null);
      if (old !== node.value) {
        // FIXME remove debug assertion
        throw new Error('invalid expected value');
      }
      cb(null, oldValue);
    };
    var nodeCb = (err: Error, child: AvlNode) => {
      if (err) return cb(err, null);
      // replace the node with its child
      if (parent) {
        if (parent.leftId === node.id) parent.leftId = child.id; 
        else parent.rightId = child.id;
      } else {
        this.rootId = child.id;
        this.root = child;
      }
      node.key = child.key;
      node.value = child.value;
      node.id = child.id;
      node.left = child.left;
      node.leftId = child.leftId;
      node.right = child.right;
      node.rightId = child.rightId;
      cb(null, oldValue);
    };

    var inOrderPredecessor, oldValue;
    var node = path[path.length - 1];
    var parent = path[path.length - 2];

    oldValue = node.value;

    if (node.leftId && node.rightId) {
      inOrderPredecessor = this.findInOrderPredecessor(path);
      node.key = inOrderPredecessor.key;
      node.value = inOrderPredecessor.value;
      this.delNode(path, delCb);
    } else {
      if (!node.leftId && !node.rightId) {
        if (parent) {
          if (parent.leftId === node.id) {
            parent.leftId = null;
            parent.left = null;
          } else {
            parent.rightId = null; 
            parent.right = null;
          }
        } else {
          this.rootId = null; 
          this.root = null;
        }
        path.pop();
        cb(null, oldValue);
      } else if (!node.leftId) {
        this.getRight(node, nodeCb);
      } else if (!node.rightId) {
        this.getLeft(node, nodeCb);
      }
    }
  }

  private findInOrderPredecessor(path: Array<AvlNode>) {
    var node = path[path.length - 1];
    var current = node.left;

    if (current !== null) {
      while (current.right !== null) {
        path.push(current);
        current = current.right;
      }
    }

    return current;
  }
}

function ensureIsBalanced(path: Array<AvlNode>) {
  var bf, node;

  while (path.length) {
    node = path.pop();
    node.height = calculateHeight(node);
    bf = balanceFactor(node);

    if (bf === -2) {
      if (balanceFactor(node.right) === 1)
        rotateRight(node.right);
      rotateLeft(node);
    } else if (bf === 2) {
      if (balanceFactor(node.left) === -1)
        rotateLeft(node.left);
      rotateRight(node);
    } else if (bf > 2 || bf < -2) {
      // FIXME remove debug assertion
      throw new Error('Invalid tree state');
    }
  }
}

function rotateLeft(node: AvlNode) {
  var right = node.right;
  var left = node.left;
  var leftId = node.leftId;
  var newLeft = new AvlNode(node.key, node.value);

  if (!right) {
    // FIXME remove debug assertion
    throw new Error('left node not resolved!')
  }

  // update root
  node.key = right.key;
  node.value = right.value;
  // set new left
  newLeft.left = left;
  newLeft.leftId = leftId;
  node.left = newLeft;
  node.leftId = newLeft.id;
  // set new right
  node.right = right.right;
  node.rightId = right.rightId;
  // transfer the old right's left to the new left's right
  newLeft.right = right.left;
  newLeft.rightId = right.leftId;
  // recalculate heights;
  recalculateHeights(node);
}

function rotateRight(node: AvlNode) {
  var right = node.right;
  var rightId = node.rightId;
  var left = node.left;
  var newRight = new AvlNode(node.key, node.value);

  if (!left) {
    // FIXME remove debug assertion
    throw new Error('left node not resolved!')
  }

  // set new root
  node.key = left.key;
  node.value = left.value;
  // set new right
  newRight.right = right;
  newRight.rightId = rightId;
  node.right = newRight;
  node.rightId = newRight.id;
  // set new left
  node.left = left.left;
  node.leftId = left.leftId;
  // transfer the old left's right to the new right's left
  newRight.left = left.right;
  newRight.leftId = left.rightId;
  // recalculate heights;
  recalculateHeights(node);
}

function calculateHeight(node: AvlNode) {
  var rv = -1;
  rv = Math.max(rv, nodeHeight(node.left) + 1);
  rv = Math.max(rv, nodeHeight(node.right) + 1);
  return rv;
}

function recalculateHeights(node: AvlNode) {
  var left, right;

  if (node !== null) {
    left = node.left;
    right = node.right;
    if (left !== null)
      left.height = calculateHeight(left);
    if (right !== null)
      right.height = calculateHeight(right);
    node.height = calculateHeight(node);
  }
}

function balanceFactor(node) {
  var leftHeight = nodeHeight(node.left);
  var rightHeight = nodeHeight(node.right);

  return leftHeight - rightHeight;
}

function nodeHeight(node: AvlNode) {
  return node === null ? -1 : node.height;
}
