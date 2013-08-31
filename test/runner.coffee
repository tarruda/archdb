global.run = (tests) ->
  for own k, v of tests
    if typeof v == 'function'
      if k == '**setup**'
        beforeEach(v)
      else
        if k.match(/^only:/)
          it.only(k.replace(/^only:/, ''), v)
        else if k.match(/^skip:/)
          it.skip(k.replace(/^skip:/, ''), v)
        else
          it(k, v)
    else
      suite = ->
        run(v)
      describe(k, suite)
