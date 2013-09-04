{spawn} = require 'child_process'
path = require 'path'

module.exports = (grunt) ->
  data =
    # map used to store files with the debugger statement
    # used to automatically turn debugging on/off
    debug: null
    # current test runner process
    child: null

  grunt.initConfig
    pkg: grunt.file.readJSON('package.json')

    coffeelint:
      options:
        arrow_spacing: level: 'error'
        empty_constructor_needs_parens: level: 'error'
        non_empty_constructor_needs_parens: level: 'error'
        no_trailing_whitespace: level: 'error'
        no_empty_param_list: level: 'error'
        no_stand_alone_at: level: 'error'
        no_backticks: level: 'ignore'
        no_implicit_braces: level: 'ignore'
        no_implicit_parens: level: 'error'
        space_operators: level: 'error'
      src:
        src: 'src/**/*.coffee'
      test:
        src: 'test/**/*.coffee'

    coffee_build:
        options:
          wrap: true
          sourceMap: true
          disableModuleWrap: [
            'node_modules/setimmediate/setImmediate.js'
            'src/init.coffee'
            'platform/node_export.coffee'
            'platform/browser_export.coffee'
          ]
        browser:
          files: [{
            src: [
              'node_modules/setimmediate/setImmediate.js'
              'src/init.coffee'
              'src/**/*.coffee'
              'platform/browser/**/*.coffee'
            ]
            dest: 'build/browser/archdb.js'
          }, {
            src: [
              'test/runner.coffee'
              'node_modules/setimmediate/setImmediate.js'
              'src/init.coffee'
              'test/*.coffee'
              'test/acceptance/browser.coffee'
              'platform/browser/**/*.coffee'
            ]
            dest: 'build/browser/test.js'
          }]
        nodejs:
          files: [{
            src: [
              'platform/nodejs/init.coffee'
              'src/init.coffee'
              'src/**/*.coffee'
              'platform/nodejs/**/*.coffee'
            ]
            dest: 'build/node/archdb.js'
          }, {
            src: [
              'test/runner.coffee'
              'platform/nodejs/init.coffee'
              'src/init.coffee'
              'test/*.coffee'
              'test/acceptance/node.coffee'
              'test/acceptance/fs_storage.coffee'
              'test/acceptance/msgpack.coffee'
              'platform/nodejs/**/*.coffee'
            ]
            dest: 'build/node/test.js'
          }]

    check_debug:
      all: [
        'platform/**/*.js'
        'platform/**/*.coffee'
        'src/**/*.coffee'
        'test/**/*.coffee'
      ]

    test:
      all: [
        'test/index.js'
        # 'test/acceptance/10000.js'
        # 'test/acceptance/100000.js'
        'build/node/test.js'
      ]

    watch:
      options:
        nospawn: true
      browser:
        files: [
          'src/**/*.coffee'
          'test/**/*.coffee'
          'platform/browser/**/*.coffee'
        ]
        tasks: [
          'coffeelint:changed'
          'coffee_build:nodejs'
          'check_debug:changed'
          'test'
        ]
      nodejs:
        files: [
          'src/**/*.coffee'
          'test/**/*.coffee'
          'platform/nodejs/**/*.coffee'
        ]
        tasks: [
          'coffeelint:changed'
          'coffee_build:nodejs'
          'check_debug:changed'
          'test'
        ]

    connect:
      options:
        hostname: '0.0.0.0'
        middleware: (connect, options) -> [
          connect.static(options.base)
          connect.directory(options.base)
        ]
      project:
        options:
          port: 8000
          base: './'

    clean:
      all:
        ['build']

  grunt.loadNpmTasks 'grunt-contrib-watch'
  grunt.loadNpmTasks 'grunt-contrib-livereload'
  grunt.loadNpmTasks 'grunt-contrib-uglify'
  grunt.loadNpmTasks 'grunt-contrib-connect'
  grunt.loadNpmTasks 'grunt-contrib-clean'
  grunt.loadNpmTasks 'grunt-coffeelint'
  grunt.loadNpmTasks 'grunt-coffee-build'
  grunt.loadNpmTasks 'grunt-release'

  grunt.registerMultiTask 'check_debug', ->
    data.debug = {}
    files = @filesSrc
    for file in files
      code = grunt.file.read(file)
      if /^\s*debugger\s*/gm.test(code)
        data.debug[file] = true
      else delete data.debug[file]

  grunt.registerMultiTask 'test', ->
    done = @async()
    args = @filesSrc
    args = ['--compilers', 'coffee:coffee-script'].concat(args)
    # args.unshift('--check-leaks')
    if data.debug and Object.keys(data.debug).length
      args.unshift('--debug-brk')
    opts = stdio: 'inherit'
    data.child = spawn('./node_modules/.bin/mocha', args, opts)
    data.child.on 'close', (code) ->
      data.child = null
      done(code is 0)

  grunt.registerTask 'build', [
    'clean'
    'coffeelint'
    'coffee_build'
    'test'
    'uglify'
  ]

  grunt.registerTask 'common-rebuild', [
    'connect'
    'coffeelint'
  ]

  grunt.registerTask 'debug-browser', [
    'clean'
    'livereload-start'
    'common-rebuild'
    'coffee_build'
    'watch:browser'
  ]

  grunt.registerTask 'debug-nodejs', [
    'clean'
    'common-rebuild'
    'coffee_build'
    'check_debug'
    'test'
    'watch:nodejs'
  ]

  grunt.registerTask 'default', [
    'debug-nodejs'
  ]


  grunt.event.on 'watch', (action, filepath) ->
    coffeelint = grunt.config.getRaw('coffeelint')
    checkDebug = grunt.config.getRaw('check_debug')
    if /\.coffee$/.test filepath
      checkDebug.changed = [filepath]
      coffeelint.changed = src: filepath
      grunt.regarde = changed: ['test.js']
      if data.child
        data.child.kill('SIGTERM')
