undef = `void 0`
HISTORY = '$history'
HOOKS = '$hooks'
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


connect = (options) ->
  frontendClass = frontends[options.type]
  backendClass = backends[options.storage]
  return new frontendClass(new backendClass(options))
