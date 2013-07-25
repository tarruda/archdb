/// <reference path="./components.ts"/>
/// <reference path="./util.ts"/>

// using negative numbers as temporary node ids allow us to easily
// identify if the node is new(was not persisted yet)
var avlNodeId: number = -1;

class AvlNode implements IndexNode {
  height: number;
  key: IndexKey;
  value: any;
  left: AvlNode;
  right: AvlNode;
  leftRef: string;
  rightRef: string;
  ref: string;
  type: DbObjectType;

  constructor(key: IndexKey, value: any) {
    this.key = key instanceof BitArray ? key: new BitArray(key);
    this.value = value;
    this.left = null;
    this.leftRef = null;
    this.right = null
    this.rightRef = null;
    this.height = 0;
    this.ref = (avlNodeId--).toString();
    this.type = DbObjectType.IndexNode;
  }

  getKey(): IndexKey {
    return this.key;
  }

  getValue(): any {
    return this.value;
  }

  normalize(): any {
    return [this.key.normalize(), this.value, this.leftRef, this.rightRef,
           this.height];
  }

  volatile(): boolean {
    return this.ref[0] === '-';
  }

  clone(): AvlNode {
    var rv = new AvlNode(this.key.clone(), this.value);
    rv.left = this.left;
    rv.leftRef = this.leftRef;
    rv.right = this.right;
    rv.rightRef = this.rightRef;
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

class AvlTree implements IndexTree {
  dbStorage: DbStorage;
  rootRef: string;
  originalRootRef: string;
  root: AvlNode;

  constructor(dbStorage: DbStorage, rootRef: string) {
    this.dbStorage = dbStorage;
    this.rootRef = rootRef;
    this.originalRootRef = rootRef;
    this.root = null;
  }

  get(key: any, cb: ObjectCb) {
    var searchCb = (err: Error, comp: number, path: Array<AvlNode>) => {
      if (err) return cb(err, null);
      if (comp === 0) return cb(null, path[path.length - 1].value);
      cb(null, null);
    };
    var getCb = (err: Error, node: AvlNode) => {
      this.root = node;
      this.search(false, key, searchCb);
    };

    key = key instanceof BitArray ? key.clone() : new BitArray(key);
    if (!this.rootRef) return cb(null, null);

    if (this.root) {
      this.search(false, key, searchCb);
    } else {
      this.resolveNode(this.rootRef, getCb);
    }
  }

  set(key: any, value: any, cb: ObjectCb) {
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
        node.leftRef = node.left.ref;
      } else {
        node.right = new AvlNode(key, value);
        node.rightRef = node.right.ref;
      }
      this.ensureIsBalanced(oldValue, path, cb);
    };
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      this.root = node;
      this.search(true, key, searchCb);
    };

    key = key instanceof BitArray ? key.clone() : new BitArray(key);

    if (!this.rootRef) {
      this.root = new AvlNode(key, value);
      this.rootRef = this.root.ref;
      return cb(null, null);
    } else if (this.root) {
      this.search(true, key, searchCb);
    } else {
      this.resolveNode(this.rootRef, getCb);
    }
  }

  del(key: IndexKey, cb: ObjectCb) {
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

    key = key instanceof BitArray ? key.clone() : new BitArray(key);

    if (!this.rootRef) {
      return cb(null, null);
    } else if (this.root) {
      this.search(true, key, searchCb);
    } else {
      this.resolveNode(this.rootRef, getCb);
    }
  }

  inOrder(minKey: IndexKey, cb: VisitNodeCb) {
    var rootCb = (err: Error, root: AvlNode) => {
      if (err) return cb(err, null, null);
      if (minKey) searchMinCb(null, root);
      else nodeCb(null, root);
    };
    var nextNodeCb = (stop?: boolean) => {
      if (paused) throw new Error('called too many times');
      paused = true;
      if (stop) return cb(null, null, null);
      yield(visitNext);
    };
    var visitNext = () => {
      this.resolveRight(nextNode, nodeCb);
    };
    var searchMinCb = (err: Error, node: AvlNode) => {
      var comp;
      if (err) return cb(err, null, null);
      if (!node) return nodeCb(null, null);
      comp = minKey.compareTo(node.key);
      if (comp < 0) {
        path.push(node);
        this.resolveLeft(node, searchMinCb);
      } else if (comp > 0) {
        this.resolveRight(node, searchMinCb);
      } else {
        nextNode = node;
        cb(null, nextNodeCb, node)
      }
    };
    var nodeCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null, null);
      if (!node && !path.length) return cb(null, null, null);
      if (node) {
        path.push(node);
        return this.resolveLeft(node, nodeCb);
      }
      node = path.pop();
      nextNode = node;
      paused = false;
      cb(null, nextNodeCb, node);
    };

    var nextNode, paused, path = [];

    if (!this.rootRef) return cb(null, null, null);
    if (!this.root) return this.resolveNode(this.rootRef, rootCb);
    rootCb(null, this.root);
  }

  revInOrder(maxKey: IndexKey, cb: VisitNodeCb) {
    var rootCb = (err: Error, root: AvlNode) => {
      if (err) return cb(err, null, null);
      if (maxKey) searchMinCb(null, root);
      else nodeCb(null, root);
    };
    var nextNodeCb = (stop?: boolean) => {
      if (paused) throw new Error('called too many times');
      paused = true;
      if (stop) return cb(null, null, null);
      yield(visitNext);
    };
    var visitNext = () => {
      this.resolveLeft(nextNode, nodeCb);
    };
    var searchMinCb = (err: Error, node: AvlNode) => {
      var comp;
      if (err) return cb(err, null, null);
      if (!node) return nodeCb(null, null);
      comp = maxKey.compareTo(node.key);
      if (comp > 0) {
        path.push(node);
        this.resolveRight(node, searchMinCb);
      } else if (comp < 0) {
        this.resolveLeft(node, searchMinCb);
      } else {
        nextNode = node;
        cb(null, nextNodeCb, node)
      }
    };
    var nodeCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null, null);
      if (!node && !path.length) return cb(null, null, null);
      if (node) {
        path.push(node);
        return this.resolveRight(node, nodeCb);
      }
      node = path.pop();
      nextNode = node;
      paused = false;
      cb(null, nextNodeCb, node);
    };

    var nextNode, paused, path = [];

    if (!this.rootRef) return cb(null, null, null);
    if (!this.root) return this.resolveNode(this.rootRef, rootCb);
    rootCb(null, this.root);
  }

  levelOrder(cb) {
    var leftCb = (err: Error, left: AvlNode) => {
      q.push(left);
      if (node.rightRef) this.resolveRight(node, rightCb);
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
      if (node.leftRef) this.resolveLeft(node, leftCb);
      else if (node.rightRef) this.resolveRight(node, rightCb);
      else yield(nextNode);
    };
    var rv = [], q, node;

    if (!this.rootRef) return cb(null, rv);

    q = [];

    if (!this.root) this.resolveNode(this.rootRef, rightCb);
    else rightCb(null, this.root);
  }

  commit(releaseCache: boolean, cb: DoneCb) {
    var flushNodeCb = (err: Error, ref: string) => {
      var parent, currentRef;
      if (err) return cb(err);
      currentRef = current.ref;
      current.ref = ref; 
      if (parents.length) {
        parent = parents.pop();
        if (parent.leftRef === currentRef) {
          parent.leftRef = current.ref;
          if (releaseCache) parent.left = null;
        } else {
          parent.rightRef = current.ref;
          if (releaseCache) parent.right = null;
        }
        pending.push(parent);
        visit();
      } else {
        this.rootRef = this.originalRootRef = ref;
        if (releaseCache) this.root = null;
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
        this.dbStorage.save(DbObjectType.IndexNode, current.normalize(),
            flushNodeCb);
      }
    };

    var current, pending, parents;

    if (!this.root || !this.root.volatile()) return cb(null);

    pending = [this.root];
    parents = [];
    visit();
  }

  getRootRef(): string { return this.rootRef; }
  getOriginalRootRef(): string { return this.originalRootRef; }
  setOriginalRootRef(ref: string) { this.originalRootRef = ref; }
  modified(): boolean { return this.rootRef !== this.originalRootRef; }

  private search(copyPath: boolean, key: IndexKey, cb: AvlSearchCb) {
    var nodeCb = (err: Error, node: AvlNode) => {
      var nodeId;
      if (err) return cb(err, null, null);
      if (!node) return cb(null, comp, path);
      if (copyPath && !node.volatile()) {
        nodeId = node.ref;
        node = node.clone();
        if (nodeId === current.leftRef) {
          current.leftRef = node.ref;
          current.left = node;
        } else {
          current.rightRef = node.ref;
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
      this.rootRef = this.root.ref;
    }
    current = this.root;
    get();
  }

  private delNode(path: Array<AvlNode>, cb: ObjectCb) {
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
        if (parent.leftRef === node.ref) {
          parent.leftRef = child.ref; 
          parent.left = child;
        } else {
          parent.rightRef = child.ref;
          parent.right = child;
        }
      } else {
        this.rootRef = child.ref;
        this.root = child;
      }
      path.pop();
      cb(null, oldValue);
    };

    var oldValue;
    var node = path[path.length - 1];
    var parent = path[path.length - 2];

    oldValue = node.value;

    if (node.leftRef && node.rightRef) {
      this.findInOrderPredecessor(path, inOrderCb);
    } else {
      if (!node.leftRef && !node.rightRef) {
        if (parent) {
          if (parent.leftRef === node.ref) {
            parent.leftRef = null;
            parent.left = null;
          } else {
            parent.rightRef = null; 
            parent.right = null;
          }
        } else {
          this.rootRef = null; 
          this.root = null;
        }
        path.pop();
        cb(null, oldValue);
      } else if (!node.leftRef) {
        this.resolveRight(node, nodeCb);
      } else if (!node.rightRef) {
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
        currentId = current.ref;
        current = current.clone();
        if (parent.leftRef === currentId) {
          parent.left = current;
          parent.leftRef = current.ref;
        } else {
          parent.right = current;
          parent.rightRef = current.ref;
        }
      }
      if (current.rightRef !== null) {
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
      cb: ObjectCb) {
    var nextParent = (err: Error) => {
      if (!path.length) return cb(null, oldValue);
      node = path.pop();
      // it is possible one of the node's child was not retrieved
      // from db storage yet
      if (node.leftRef && !node.left) this.resolveLeft(node, childCb);
      else if (node.rightRef && !node.right) this.resolveRight(node, childCb);
      else checkBalance();
    };
    var childCb = (err: Error, child: AvlNode) => {
      if (err) return cb(err, null);
      if (child.ref === node.leftRef) node.left = child;
      else node.right = child;
      if ((node.leftRef && !node.left) || (node.rightRef && !node.right))
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
          node.rightRef = node.right.ref;
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
          node.leftRef = node.left.ref;
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
      node.rightRef = right.rightRef;
      this.resolveLeft(right, rightLeftCb);
    };
    var rightLeftCb = (err: Error) => {
      if (err) return cb(err);
      // transfer the old right's left to the new left's right
      newLeft.right = right.left;
      newLeft.rightRef = right.leftRef;
      // recalculate heights;
      newLeft.refreshHeight();
      node.refreshHeight();
      cb(null);
    };

    var right = node.right;
    var left = node.left;
    var leftRef = node.leftRef;
    var newLeft = new AvlNode(node.key, node.value);

    if (!right)
      // TODO remove debug assert
      throw new Error('right node not resolved!');

    // update key/value
    node.key = right.key;
    node.value = right.value;
    // set new left
    newLeft.left = left;
    newLeft.leftRef = leftRef;
    node.left = newLeft;
    node.leftRef = newLeft.ref;
    this.resolveRight(right, rightRightCb);
  }

  private rotateRight(node: AvlNode, cb: DoneCb) {
    var leftLeftCb = (err: Error) => {
      if (err) return cb(err);
      // set new left
      node.left = left.left;
      node.leftRef = left.leftRef;
      this.resolveRight(left, leftRightCb);
    };
    var leftRightCb = (err: Error) => {
      if (err) return cb(err);
      // transfer the old left's right to the new right's left
      newRight.left = left.right;
      newRight.leftRef = left.rightRef;
      // recalculate heights;
      newRight.refreshHeight();
      node.refreshHeight();
      cb(null);
    };

    var right = node.right;
    var rightRef = node.rightRef;
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
    newRight.rightRef = rightRef;
    node.right = newRight;
    node.rightRef = newRight.ref;
    this.resolveLeft(left, leftLeftCb);
  }

  private resolveNode(ref: string, cb: ObjectCb) {
    var getCb = (err: Error, array: Array) => {
      var node;
      if (err) return cb(err, null);
      node = new AvlNode(array[0], array[1]);
      node.leftRef = array[2];
      node.rightRef = array[3];
      node.height = array[4];
      node.ref = ref;
      cb(null, node);
    };
    this.dbStorage.get(DbObjectType.IndexNode, ref, getCb);
  }

  private resolveLeft(from: AvlNode, cb: ObjectCb) {
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      from.left = node;
      cb(null, node);
    }

    if (from.left) return cb(null, from.left);
    if (!from.leftRef) return cb(null, null);
    this.resolveNode(from.leftRef, getCb);
  }

  private resolveRight(from: AvlNode, cb: ObjectCb) {
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      from.right = node;
      cb(null, node);
    }

    if (from.right) return cb(null, from.right);
    if (!from.rightRef) return cb(null, null);
    this.resolveNode(from.rightRef, getCb);
  }
}
