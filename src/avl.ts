/// <reference path="./components.ts"/>
/// <reference path="./util.ts"/>

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
    this.leftId = null;
    this.right = null
    this.rightId = null;
    this.height = 0;
    this.id = (avlNodeId--).toString();
  }

  getType(): DbObjectType {
    return DbObjectType.IndexNode;
  }

  normalize(): Object {
    return [this.key.normalize(), normalize(this.value), this.leftId,
    this.rightId, this.height];
  }

  volatile(): boolean {
    return this.id[0] === '-';
  }

  clone(): AvlNode {
    var rv = new AvlNode(this.key.clone(), this.value);
    rv.left = this.left;
    rv.leftId = this.leftId;
    rv.right = this.right;
    rv.rightId = this.rightId;
    rv.height = this.height;
    return rv; 
  }

  refreshHeight() {
    var h = 0, left = this.left, right = this.right;

    h = Math.max(h, left === null ? 0 : (left.height + 1));
    h = Math.max(h, right === null ? 0 : (right.height + 1));

    this.height = h;
  }

  balanceFactor() {
    var left = this.left, right = this.right;
    var leftHeight = left === null ? -1 : left.height;
    var rightHeight = right === null ? -1 : right.height

    return leftHeight - rightHeight;
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
      this.search(false, key, searchCb);
    }

    if (!this.rootId) return cb(null, null);
    if (this.root) {
      this.search(false, key, searchCb);
    } else {
      this.resolveNode(this.rootId, getCb);
    }
  }

  set(key: IndexKey, value: string, cb: UpdateIndexCb) {
    var searchCb = (err: Error, comp: number, path: Array<AvlNode>) => {
      var node, oldValue;
      if (err) return cb(err, null);
      node = path[path.length - 1];
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
      this.ensureIsBalanced(oldValue, path, cb);
    };
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      this.root = node;
      this.search(true, key, searchCb);
    };

    if (!this.rootId) {
      this.root = new AvlNode(key, value);
      this.rootId = this.root.id;
      return cb(null, null);
    } else if (this.root) {
      this.search(true, key, searchCb);
    } else {
      this.resolveNode(this.rootId, getCb);
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
      this.search(true, key, searchCb);
    };
    var delCb = (err: Error, oldValue: string) => {
      if (err) return cb(err, null);
      this.ensureIsBalanced(oldValue, path, cb);
    };

    var path;

    if (!this.rootId) {
      return cb(null, null);
    } else if (this.root) {
      this.search(true, key, searchCb);
    } else {
      this.resolveNode(this.rootId, getCb);
    }
  }

  inOrder(minKey: IndexKey, cb: VisitNodeCb) { }
  revInOrder(maxKey: IndexKey, cb: VisitNodeCb) { }

  levelOrder(cb) {
    var leftCb = (err: Error, left: AvlNode) => {
      q.push(left);
      if (node.rightId) this.resolveRight(node, rightCb);
      else yield(nextNode);
    };
    var rightCb = (err: Error, right: AvlNode) => {
      q.push(right);
      yield(nextNode);
    };
    var nextNode = () => {
      if (!q.length) return cb(null, rv);
      node = q.shift();
      rv.push(node.key.normalize());
      if (node.leftId) this.resolveLeft(node, leftCb);
      else if (node.rightId) this.resolveRight(node, rightCb);
      else yield(nextNode);
    };
    var rv = [], q, node;

    if (!this.rootId) return cb(null, rv);

    q = [];

    if (!this.root) this.resolveNode(this.rootId, rightCb);
    else rightCb(null, this.root);
  }

  commit(cb: DoneCb) {
    var flushNodeCb = (err: Error, id: string) => {
      var parent, currentId;
      if (err) return cb(err);
      currentId = current.id;
      current.id = id; 
      if (parents.length) {
        parent = parents.pop();
        if (parent.leftId === currentId) {
          parent.leftId = current.id;
          parent.left = null; // make things easy for gc
        } else {
          parent.rightId = current.id;
          parent.right = null;
        }
        pending.push(parent);
        visit();
      } else {
        this.rootId = id;
        this.root = null;
        cb(null);
      }
    };
    var visit = () => {
      current = pending.pop();
      if (current.left && current.left.volatile()) {
        parents.push(current);
        pending.push(current.left);
        return yield(visit);
      } else if (current.right && current.right.volatile()) {
        parents.push(current);
        pending.push(current.right);
        return yield(visit);
      } else {
        this.dbStorage.save(current, flushNodeCb);
      }
    };

    var current, pending, parents;

    if (!this.root || !this.root.volatile()) return cb(null);

    pending = [this.root];
    parents = [];
    visit();
  }

  private search(copyPath: boolean, key: IndexKey, cb: AvlSearchCb) {
    var nodeCb = (err: Error, node: AvlNode) => {
      var nodeId;
      if (err) return cb(err, null, null);
      if (!node) return cb(null, comp, path);
      if (copyPath && !node.volatile()) {
        nodeId = node.id;
        node = node.clone();
        if (nodeId === current.leftId) {
          current.leftId = node.id;
          current.left = node;
        } else {
          current.rightId = node.id;
          current.right = node;
        }
      }
      current = node;
      get();
    }
    var get = () => {
      path.push(current);
      comp = key.compareTo(current.key);
      if (comp < 0) {
        this.resolveLeft(current, nodeCb);
      } else if (comp > 0) {
        this.resolveRight(current, nodeCb);
      } else {
        cb(null, comp, path);
      }
    };
    var comp, current;
    var path = [];

    if (copyPath && !this.root.volatile()) {
      this.root = this.root.clone();
      this.rootId = this.root.id;
    }
    current = this.root;
    get();
  }

  private delNode(path: Array<AvlNode>, cb: UpdateIndexCb) {
    var delCb = (err: Error, old: string) => {
      if (err) return cb(err, null);
      if (old !== node.value)
        // TODO remove debug assert
        throw new Error('invalid expected value');
      cb(null, oldValue);
    };
    var inOrderCb = (err: Error, inOrderPredecessor: AvlNode) => {
      if (err) return cb(err, null);
      node.key = inOrderPredecessor.key;
      node.value = inOrderPredecessor.value;
      this.delNode(path, delCb);
    };
    var nodeCb = (err: Error, child: AvlNode) => {
      if (err) return cb(err, null);
      // replace the node with its child
      if (parent) {
        if (parent.leftId === node.id) {
          parent.leftId = child.id; 
          parent.left = child;
        } else {
          parent.rightId = child.id;
          parent.right = child;
        }
      } else {
        this.rootId = child.id;
        this.root = child;
      }
      path.pop();
      cb(null, oldValue);
    };

    var oldValue;
    var node = path[path.length - 1];
    var parent = path[path.length - 2];

    oldValue = node.value;

    if (node.leftId && node.rightId) {
      this.findInOrderPredecessor(path, inOrderCb);
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
        this.resolveRight(node, nodeCb);
      } else if (!node.rightId) {
        this.resolveLeft(node, nodeCb);
      }
    }
  }

  private findInOrderPredecessor(path: Array<AvlNode>,
      cb: (err: Error, node: AvlNode) => any) {
    var currentCb = (err: Error, current: AvlNode) => {
      var currentId;
      if (err) return cb(err, null);
      if (current === null) 
        // TODO remove debug assert
        throw new Error('invalid tree state');
      if (!current.volatile()) {
        currentId = current.id;
        current = current.clone();
        if (parent.leftId === currentId) {
          parent.left = current;
          parent.leftId = current.id;
        } else {
          parent.right = current;
          parent.rightId = current.id;
        }
      }
      if (current.rightId !== null) {
        parent = current; 
        path.push(parent);
        return this.resolveRight(current, currentCb);
      }
      path.push(current);
      cb(null, current);
    };

    var parent = path[path.length - 1]

    this.resolveLeft(parent, currentCb);
  }

  private ensureIsBalanced(oldValue: string, path: Array<AvlNode>,
      cb: UpdateIndexCb) {
    var nextParent = (err: Error) => {
      if (!path.length) return cb(null, oldValue);
      node = path.pop();
      // it is possible one of the node's child was not retrieved
      // from db storage yet
      if (node.leftId && !node.left) this.resolveLeft(node, childCb);
      else if (node.rightId && !node.right) this.resolveRight(node, childCb);
      else checkBalance();
    };
    var childCb = (err: Error, child: AvlNode) => {
      if (err) return cb(err, null);
      if (child.id === node.leftId) node.left = child;
      else node.right = child;
      if ((node.leftId && !node.left) || (node.rightId && !node.right))
        // TODO remove debug assert
        throw new Error('invalid tree state');
      checkBalance();
    };
    var checkBalance = () => {
      var bf;
      node.refreshHeight();
      bf = node.balanceFactor();
      if (bf === -2) this.resolveLeft(node.right, rightLeftCb);
      else if (bf === 2) this.resolveLeft(node.left, leftLeftCb);
      else if (bf > 2 || bf < -2) 
        // TODO remove debug assert
        throw new Error('Invalid tree state');
      else yield(nextParent);
    };
    var rightLeftCb = (err: Error, rightLeft: AvlNode) => {
      if (err) return cb(err, null);
      this.resolveRight(node.right, rightRightCb);
    };
    var rightRightCb = (err: Error, rightRight: AvlNode) => {
      if (err) return cb(err, null);
      if (node.right.balanceFactor() === 1) {
        if (!node.right.volatile()) {
          node.right = node.right.clone();
          node.rightId = node.right.id;
        }
        this.rotateRight(node.right, rotateRightCb);
      } else {
        yield(rotateRightCb);
      }
    };
    var leftLeftCb = (err: Error, leftLeft: AvlNode) => {
      if (err) return cb(err, null);
      this.resolveRight(node.left, leftRightCb);
    };
    var leftRightCb = (err: Error, leftLeft: AvlNode) => {
      if (err) return cb(err, null);
      if (node.left.balanceFactor() === -1) {
        if (!node.left.volatile()) {
          node.left = node.left.clone();
          node.leftId = node.left.id;
        }
        this.rotateLeft(node.left, rotateLeftCb);
      } else {
        yield(rotateLeftCb);
      }
    };
    var rotateRightCb = (err: Error) => {
      if (err) return cb(err, null);
      this.rotateLeft(node, nextParent);
    };
    var rotateLeftCb = (err: Error) => {
      if (err) return cb(err, null);
      this.rotateRight(node, nextParent);
    };

    var node;

    nextParent(null);
  }

  private rotateLeft(node: AvlNode, cb: DoneCb) {
    var rightRightCb = (err: Error) => {
      if (err) return cb(err);
      // set new right
      node.right = right.right;
      node.rightId = right.rightId;
      this.resolveLeft(right, rightLeftCb);
    };
    var rightLeftCb = (err: Error) => {
      if (err) return cb(err);
      // transfer the old right's left to the new left's right
      newLeft.right = right.left;
      newLeft.rightId = right.leftId;
      // recalculate heights;
      newLeft.refreshHeight();
      node.refreshHeight();
      cb(null);
    };

    var right = node.right;
    var left = node.left;
    var leftId = node.leftId;
    var newLeft = new AvlNode(node.key, node.value);

    if (!right)
      // TODO remove debug assert
      throw new Error('right node not resolved!');

    // update key/value
    node.key = right.key;
    node.value = right.value;
    // set new left
    newLeft.left = left;
    newLeft.leftId = leftId;
    node.left = newLeft;
    node.leftId = newLeft.id;
    this.resolveRight(right, rightRightCb);
  }

  private rotateRight(node: AvlNode, cb: DoneCb) {
    var leftLeftCb = (err: Error) => {
      if (err) return cb(err);
      // set new left
      node.left = left.left;
      node.leftId = left.leftId;
      this.resolveRight(left, leftRightCb);
    };
    var leftRightCb = (err: Error) => {
      if (err) return cb(err);
      // transfer the old left's right to the new right's left
      newRight.left = left.right;
      newRight.leftId = left.rightId;
      // recalculate heights;
      newRight.refreshHeight();
      node.refreshHeight();
      cb(null);
    };

    var right = node.right;
    var rightId = node.rightId;
    var left = node.left;
    var newRight = new AvlNode(node.key, node.value);

    if (!left)
      // TODO remove debug assert
      throw new Error('left node not resolved!')

    // update key/value
    node.key = left.key;
    node.value = left.value;
    // set new right
    newRight.right = right;
    newRight.rightId = rightId;
    node.right = newRight;
    node.rightId = newRight.id;
    this.resolveLeft(left, leftLeftCb);
  }

  private resolveNode(id: string, cb: DbObjectCb) {
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      cb(null, node);
    };
    this.dbStorage.get(id, getCb);
  }

  private resolveLeft(from: AvlNode, cb: DbObjectCb) {
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      from.left = node;
      cb(null, node);
    }

    if (from.left) return cb(null, from.left);
    if (!from.leftId) return cb(null, null);
    this.resolveNode(from.leftId, getCb);
  }

  private resolveRight(from: AvlNode, cb: DbObjectCb) {
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      from.right = node;
      cb(null, node);
    }

    if (from.right) return cb(null, from.right);
    if (!from.rightId) return cb(null, null);
    this.resolveNode(from.rightId, getCb);
  }
}
