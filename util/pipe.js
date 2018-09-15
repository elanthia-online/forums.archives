function is_function (thing) {
  return typeof thing === "function"
}

function throw_not_function () {
  throw new Error("Function was expected as Argument[0]")
}

function Pipe (data) {
  if (!(this instanceof Pipe)) return new Pipe(data)
  
  var pipe = this
  /**
   * the current value of the pipeline
   */
  pipe.data = data
  /**
   * do something with the data but do not mutate the value
   * and discard the result
   */
  pipe.tap = function () {
    var args = [].slice.call(arguments)
      , fn   = args.shift()
    if (fn == Pipe.lift) return pipe.data
    if (is_function(fn)) {
      fn.apply(pipe, [pipe.data].concat(args))
      return pipe
    }
    throw_not_function()
  }
  /**
   * |>
   */
  pipe.into = pipe.fmap = function () {
    var args = [].slice.call(arguments)
      , fn   = args.shift()
    if (fn == Pipe.lift) return pipe.data
    if (is_function(fn)) return Pipe(fn.apply(pipe, [pipe.data].concat(args)))
    throw_not_function()
  }

  return pipe
}

Pipe.of = Pipe

Pipe.lift = function (p) {
  if (p instanceof Pipe) return p.data
  return p
}

module.exports = Pipe