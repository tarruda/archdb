undef = `void 0`
HISTORY = '$history'
BEFORE_QUERY_HOOKS = '$on-before-query'
BEFORE_INSERT_HOOKS = '$on-before-insert'
BEFORE_UPDATE_HOOKS = '$on-before-update'
BEFORE_DELETE_HOOKS = '$on-before-delete'
AFTER_QUERY_HOOKS = '$on-after-query'
AFTER_INSERT_HOOKS = '$on-after-insert'
AFTER_UPDATE_HOOKS = '$on-after-update'
AFTER_DELETE_HOOKS = '$on-after-delete'
HOOKS_DOMAIN = /^\$on-(before|after)-(query|insert|update|delete):(.+)$/
storages = {}
frontends = {}


$yield = setImmediate


if typeof Error.captureStackTrace == 'function'
  injectStackTrace = Error.captureStackTrace
else
  injectStackTrace = ->


registerStorage = (name, klass) -> storages[name] = klass


registerFrontend = (name, klass) -> frontends[name] = klass


_hasProp = Object.prototype.hasOwnProperty


hasProp = (obj, key) -> _hasProp.call(obj, key)


db = (options = {}) ->
  frontendClass = frontends[options.type]
  storageClass = storages[options.storage]

  if typeof storageClass == 'function'
    storage = new storageClass(options)
    frontend = new frontendClass(storage, options)
  else
    frontend = new frontendClass(options)

  return frontend
