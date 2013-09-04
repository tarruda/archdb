fs = require('fs')
wrench = require('wrench')

testApi = require('./api')


dbPath = '.tmpdb'


testApi(type: 'local', storage: 'memory')
# testApi(type: 'local', storage: 'fs', path: dbPath, (cb) ->
#   if fs.existsSync(dbPath) then wrench.rmdirSyncRecursive(dbPath)
#   fs.mkdirSync(dbPath)
#   cb())
