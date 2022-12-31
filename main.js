const { setPowerset } = require('mathjs')

var whitespace_sym = Symbol("whitespace")
var oparen_sym = Symbol("oparen")
var cparen_sym = Symbol("cparen")
var rator_sym = Symbol("rator")
var equals_sym = Symbol("equals")
var event_sym = Symbol("event")
var and_sym = Symbol("and")
var or_sym = Symbol("or")

// Convert the input string into a list of tokens
function lex_input(input_string) {
  const tokens = []

  // token type for each regexp
  const token_types = [whitespace_sym, oparen_sym, cparen_sym, rator_sym, rator_sym, equals_sym, event_sym]

  const regexps = [
    /^\s+/,                    // whitespace
    /^\(/,                     // opening parentheses
    /^\)/,                     // closing parentheses
    /^and/,                    // the word "and"
    /^or/,                     // the word "or"
    /^=\s*([0-9]*\.?[0-9]+)/,  // a number
    /^[^\s)=]+/                // a word
  ]

  while (input_string != "") {
    let match_found = false

    // Compare input_string against each regexp until a match is found
    for (let i = 0; i < token_types.length; i++) {
      let result_status = input_string.match(regexps[i])
      if (result_status != null) {
        match_found = true
        let result = result_status[0]

        switch (token_types[i]) {
          case oparen_sym:
          case cparen_sym:
            tokens.push([token_types[i], null])
            break
          case rator_sym:
            if (result === "and") {
              tokens.push([rator_sym, and_sym])
            } else {
              tokens.push([rator_sym, or_sym])
            }
            break
          case equals_sym:
            result = result_status[1]
            tokens.push([equals_sym, Number(result)])
            break
          case event_sym:
            tokens.push([event_sym, result])
            break
        }

        // Discard the matching part of input_string
        input_string = input_string.substring(result.length, input_string.length)
        break
      }
    }
    if (match_found == false) {
      break
    }
  }
  return tokens
}

// Convert a list of tokens to an AST

// Grammar for AST:
//   input_expr = expr_list
//   expr_list = expr expr_tail
//   expr_tail = empty | RATOR expr_list
//   expr = EVENT | OPAREN expr_list CPAREN

function is_next(type, tokens) {
  if (tokens.length == 0) {
    return false
  } else {
    return tokens[0][0] === type
  }
}

function consume(type, tokens) {
  if (tokens.length == 0) {
    // Throw an error
  } else if (tokens[0][0] !== type) {
    // Throw an error
  } else {
    let value = tokens[0][1]
    tokens.shift()
    return value
  }
}

function parse_input(tokens) {
  let result = parse_expr_list(tokens)
  return result
}

function parse_expr_list(tokens) {
  let expr_result = parse_expr(tokens)
  let expr_list_result = parse_expr_tail(expr_result, tokens)
  return expr_list_result
}

function parse_expr_tail(expr_result, tokens) {
  if (is_next(rator_sym, tokens)) {
    let result = []
    let rator_result = [rator_sym, consume(rator_sym, tokens)]
    let expr_list_result = parse_expr_list(tokens)
    result.push(expr_result, rator_result)
    if (expr_list_result[0] === event_sym) {
      result.push(expr_list_result)
    } else {
      result = result.concat(expr_list_result)
    }
    return result
  } else if (is_next(equals_sym, tokens)) {
    let result = []
    let equals_result = [equals_sym, consume(equals_sym, tokens)]
    result.push(expr_result, equals_result)
    return result
  } else {
    return expr_result
  }
}

function parse_expr(tokens) {
  if (is_next(event_sym, tokens)) {
    return [event_sym, consume(event_sym, tokens)]
  } else if (is_next(oparen_sym, tokens)) {
    consume(oparen_sym, tokens)
    result = parse_expr_list(tokens)
    consume(cparen_sym, tokens)
    return result
  }
}

// For each simple event in EVENTS, compute the set of
// all events which are its partitions
function get_se_psets(simple_events, intersections) {
  let se_psets = new Map()
  for (let simple_event of simple_events) {
    se_psets.set(simple_event, [])
    for (let intersection of intersections) {
      // Whether intersection is a partition of simple_event
      if (intersection.includes(simple_event)) {
        se_psets.get(simple_event).push(true)
      } else {
        se_psets.get(simple_event).push(false)
      }
    }
  }
  return se_psets
}
