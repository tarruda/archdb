testApi = require('./api')


testApi(type: 'local', storage: 'memory')
testApi(type: 'local', storage: 'dom', (cb) ->
  localStorage.clear()
  cb())
