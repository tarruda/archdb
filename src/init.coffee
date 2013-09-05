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
backends = {}
frontends = {}


$yield = setImmediate


if typeof Error.captureStackTrace == 'function'
  injectStackTrace = (err) ->
    Error.captureStackTrace(err, arguments.callee.caller)
else
  injectStackTrace = ->


registerBackend = (name, klass) -> backends[name] = klass


registerFrontend = (name, klass) ->
  frontends[name] = klass


_hasProp = Object.prototype.hasOwnProperty


hasProp = (obj, key) -> _hasProp.call(obj, key)


connect = (options) ->
  frontendClass = frontends[options.type]
  backendClass = backends[options.storage]
  return new frontendClass(new backendClass(options), options)
