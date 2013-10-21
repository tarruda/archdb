{spawn} = require 'child_process'
path = require 'path'

module.exports = (grunt) ->
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
            'platform/nodejs/export.coffee'
            'platform/browser/export.coffee'
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

    mocha_debug:
      options:
        reporter: 'dot'
        check:[
          'platform/**/*.js'
          'platform/**/*.coffee'
          'src/**/*.coffee'
          'test/**/*.coffee'
        ]
      nodejs:
        options:
          src: [
            'test/index.js'
            'test/acceptance/10000.js'
            'test/acceptance/100000.js'
            'build/node/test.js'
          ]
      browser:
        options:
          phantomjs: true
          listenAddress: '0.0.0.0'
          src: [
            'test/index.js'
            'test/acceptance/10000.js'
            'test/acceptance/100000.js'
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
          'mocha_debug'
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
  grunt.loadNpmTasks 'grunt-mocha-debug'
  grunt.loadNpmTasks 'grunt-release'

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
    'mocha_debug'
    'watch:nodejs'
  ]

  grunt.registerTask 'default', [
    'debug-nodejs'
  ]


  grunt.event.on 'watch', (action, filepath) ->
    coffeelint = grunt.config.getRaw('coffeelint')
    mochaDebug = grunt.config.getRaw('mocha_debug')
    if /\.coffee$/.test filepath
      mochaDebug.options.check = filepath
      coffeelint.changed = src: filepath
      grunt.regarde = changed: ['test.js']
