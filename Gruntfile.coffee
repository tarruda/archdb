path = require 'path'
{SourceMapConsumer, SourceMapGenerator} = require 'source-map'

module.exports = (grunt) ->

  grunt.initConfig
    typescript:
      options:
        module: 'commonjs'
        target: 'es3'
        base_path: 'src'
        sourcemap: true
      common:
        src: 'src/*.ts'
        dest: 'tmp'
      browser:
        src: 'src/platform/browser/*.ts'
        dest: 'tmp'

    copy:
      browser_include:
        files: [{
          expand: true
          cwd: 'src/'
          src: 'platform/browser/include/*.js'
          dest: 'tmp/'
        }, {
          src: 'node_modules/setimmediate/setImmediate.js'
          dest: 'tmp/platform/browser/include/setImmediate.js'
        }]
      nodejs_include:
        files: [{
          expand: true
          cwd: 'src/'
          src: 'platform/nodejs/include/*.js'
          dest: 'tmp/'
        }]

    mapcat:
      browser_test:
        cwd: 'tmp'
        src: [
          'platform/browser/include/*.js'
          'platform/browser/*.js'
          '*.js'
        ]
        dest: 'build/browser_test.js'
      nodejs_test:
        cwd: 'tmp'
        src: [
          'platform/nodejs/include/*.js'
          'platform/nodejs/*.js'
          '*.js'
        ]
        dest: 'build/nodejs_test.js'

    simplemocha:
      options:
        ignoreLeaks: true
        ui: 'bdd'
      all:
        src: [
          'test/init_node.js'
          'test/unit/*.js'
          'test/functional/*.js'
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

    watch:
      options:
        nospawn: true
      src:
        files: [
          'src/**/*.ts'
          'src/**/*.js'
          'test/**/*.js'
        ]
        tasks: [
          'typescript:changed'
          'copy'
          'mapcat'
          'simplemocha'
          'livereload'
        ]

    clean: ['tmp', 'build', 'dist']

  grunt.loadNpmTasks 'grunt-contrib-watch'
  grunt.loadNpmTasks 'grunt-contrib-clean'
  grunt.loadNpmTasks 'grunt-contrib-connect'
  grunt.loadNpmTasks 'grunt-contrib-livereload'
  grunt.loadNpmTasks 'grunt-contrib-copy'
  grunt.loadNpmTasks 'grunt-typescript'
  grunt.loadNpmTasks 'grunt-simple-mocha'

  grunt.registerMultiTask 'mapcat', ->
    # concatenate compiled javascript while generating a resulting
    # source map for the original typescript files
    # this is needed as the typescript compiler breaks when generating
    # source maps from multiple files:
    # https://typescript.codeplex.com/workitem/1032
    dest = @data.dest
    sourceMappingURL = "#{path.basename(dest)}.map"
    buffer = []
    lineOffset = 0
    cwd = path.resolve(@data.cwd)
    gen = new SourceMapGenerator { file: dest }
    visited = {}
    concatenated = {}
    files = @filesSrc.map (f) -> path.join(cwd, f)
    while files.length
      filepath = files.shift()
      if filepath of concatenated
        continue
      if /include/.test filepath
        src = grunt.file.read filepath
        buffer.push src.replace('\r', '')
        lineOffset += src.split('\n').length
        continue
      deps = []
      filename = path.relative(cwd, filepath)
      # ensure the files dependencies are concatenated first
      origname = filename.replace(/\.js$/, '.ts')
      origpath = path.join('src', origname)
      origdata = grunt.file.read origpath
      while match = /\/\/\/\s*\<reference\s*path="(.+)\.ts"\/\>/.exec(origdata)
        origdata = origdata.replace(match[0], '')
        dep = path.join(path.dirname(filepath), "#{match[1]}.js")
        if !(dep of concatenated)
          deps.push(dep)
      if deps.length && !(filepath of visited)
        # to avoid infinite loops due to circular deps, we mark this file
        # so its dependencies won't be resolved again
        visited[filepath] = null
        files.unshift(filepath)
        files = deps.concat(files)
        continue
      concatenated[filepath] = null
      sourceMapPath = filepath + ".map"
      src = grunt.file.read filepath
      src = src.replace(/\/\/@\ssourceMappingURL[^\r\n]*/g, '//')
      buffer.push src.replace(/\r/, '')
      orig = new SourceMapConsumer grunt.file.read(sourceMapPath)
      orig.eachMapping (m) ->
        gen.addMapping
          generated:
              line: m.generatedLine + lineOffset
              column: m.generatedColumn
          original:
              line: m.originalLine
              column: m.originalColumn
          source: m.source
      lineOffset += src.split('\n').length
    buffer.push "//@ sourceMappingURL=#{sourceMappingURL}"
    grunt.file.write dest, buffer.join('\n')
    grunt.file.write "#{dest}.map", gen.toString()

  grunt.registerTask 'default', [
    'typescript'
    'copy'
    'mapcat'
    'simplemocha'
    'connect'
    'livereload-start'
    'watch'
  ]

  grunt.event.on 'watch', (action, filepath) ->
    typescript = grunt.config.getRaw('typescript')
    typescript.changed = {}
    if /\.ts$/.test filepath
      tsFile = path.relative(typescript.options.base_path, filepath)
      typescript.changed.src = path.join('src', tsFile)
      typescript.changed.dest = 'tmp'
    grunt.regarde = changed: ['browser.js']
