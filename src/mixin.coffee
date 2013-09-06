class Mixin
  @merge: (other) ->
    for k, v of @prototype
      other.prototype[k] = v


module.exports = Mixin
