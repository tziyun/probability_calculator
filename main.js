const { setPowerset, bitAnd, bitOr, setIsSubset } = require('mathjs')

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
        se_psets.get(simple_event).push(1)
      } else {
        se_psets.get(simple_event).push(0)
      }
    }
  }
  return se_psets
}

// Convert an input expression to the set of all events
// which are its partitions
function eval_expr(expr, intersections, se_psets) {
  const ie_pset = new Array(intersections.length)
  for (let i = 0; i < intersections.length; i++) {
    ie_pset[i] = 0
  }
  let rator = or_sym
  let value
  let op
  for (let subexpr of expr) {
    switch (subexpr[0]) {
      case rator_sym:
        rator = subexpr[1]
        break
      case event_sym:
        let input_event = subexpr[1]
        op = (rator === or_sym) ? bitOr : bitAnd
        for (let i = 0; i < ie_pset.length; i++) {
          ie_pset[i] = op(ie_pset[i], se_psets.get(input_event)[i])
        }
        break
      case equals_sym:
        value = subexpr[1]
        break
      default:
        // Recurse on subexpr
        let subexpr_result
        [subexpr_result, value] = eval_expr(subexpr, intersections, se_psets)
        op = (rator === or_sym) ? bitOr : bitAnd
        for (let i = 0; i < ie_pset.length; i++) {
          ie_pset[i] = op(ie_pset[i], subexpr_result[i])
        }
        break
    }
  }
  return [ie_pset, value]
}

// For each possible event in INTERSECTIONS, compute the number of
// all possible partitions
function get_max_flevels(simple_events, intersections) {
  const max_flevels = []
  for (let intersection of intersections) {
    max_flevels.push(Math.pow(2, simple_events.length - intersection.length))
  }
  return max_flevels
}

// For each input expression, for each possible event in INTERSECTIONS,
// compute that number of partitions that are present in the expression
function get_ie_flevels(max_flevels, intersections, ie_pset) {
  const ie_flevels = new Array(intersections.length)
  set_array_range(ie_flevels, 0, intersections.length, 0)
  for (let i = 0; i < ie_pset.length; i++) {
    if (ie_pset[i] == true) {
      let ie_partition = intersections[i]
      for (let j = 0; j < intersections.length; j++) {
        // Increment flevel for current partition
        // Also increment flevel for each subset of current partition
        if (setIsSubset(intersections[j], ie_partition)) {
          if (ie_flevels[j] < max_flevels[j]) {
            ie_flevels[j] += 1
          }
        }
      }
    }
  }
  return ie_flevels
}

// Set all elements within some range of an array
function set_array_range(arr, start, end, value) {
  for (let i = start; i < end; i++) {
    arr[i] = value
  }
}

function rref(matrix) {
  let num_rows = matrix.length
  let num_cols = matrix[0].length
  let pivot_row = 0
  let pivots = []
  for (let j = 0; j < num_cols; j++) {
    for (let i = pivot_row; i < num_rows; i++) {
      let current = matrix[i][j]
      if (current != 0) {
        if (current != 1) {
          matrix[i] = matrix[i].map((entry) => {
            return entry / current
          })
        }
        let temp_row = matrix[pivot_row]
        matrix[pivot_row] = matrix[i]
        matrix[i] = temp_row
        for (let i = 0; i < num_rows; i++) {
          if (i != pivot_row) {
            let factor = matrix[i][j] / matrix[pivot_row][j]
            for (let k = 0; k < num_cols; k++) {
              matrix[i][k] = matrix[i][k] - (factor * matrix[pivot_row][k])
            }
          }
        }
        pivots.push(j)
        pivot_row++
        break
      }
    }
  }
  return pivots
}

// Find the probability of the unknown event
function flevels_to_probability(intersections, ie_flevels, max_ie_flevels, input_probabilities) {
  // Convert the known fill levels to a system of linear equations
  const unknown = new Array(intersections.length + 1)
  const known_system = new Array(ie_flevels.length)
  for (let i = 0; i < ie_flevels.length; i++) {
    known_system[i] = new Array(intersections.length + 1)
  }
  let num_cols = intersections.length + 1

  // Always true that the sum of the probabilities of all partitions is 100%
  set_array_range(known_system[0], 0, num_cols - 1, 1)
  known_system[0][num_cols - 1] = 1

  // Convert fill levels to fill status
  for (let i = 0; i < ie_flevels.length; i++) {
    let input_fstatus = new Array(num_cols - 1)
    for (let j = 0; j < num_cols - 1; j++) {
      if (ie_flevels[i][j] == max_ie_flevels[j]) {
        input_fstatus[j] = 1
      } else {
        input_fstatus[j] = 0
      }
    }
    if (i == 0) {
      for (let k = 0; k < num_cols - 1; k++) {
        unknown[k] = input_fstatus[k]
      }
      unknown[num_cols - 1] = 0
    } else {
      for (let k = 0; k < num_cols - 1; k++) {
        known_system[i][k] = input_fstatus[k]
      }
      known_system[i][num_cols - 1] = input_probabilities[i]
    }
  }

  // Solve the system of known linear equations
  pivots = rref(known_system)

  // Solve the system wrt the unknown linear equation
  let p = 0
  for (let i = 0; i < num_cols; i++) {
    if (unknown[i] != 0) {
      while (p < pivots.length && i != pivots[p]) {
        p++
      }
      if (p >= pivots.length) {
        // Inconsistent system of equations
        // Throw an error
        break
      } else {
        let factor = unknown[i]
        for (let k = 0; k < num_cols; k++) {
          unknown[k] = unknown[k] - (factor * known_system[p][k])
        }
      }
    }
  }

  // Return the probability
  return - unknown[num_cols - 1]
}

function find_probability(simple_events_string, input_strings) {
  const simple_events = simple_events_string.split(/[, ]+/)

  const input_exprs = []
  for (let input_string of input_strings) {
    input_exprs.push(parse_input(lex_input(input_string)))
  }

  // List of all possible intersections of events
  // Equivalently, of all partitions of the sample space
  const intersections = setPowerset(simple_events)

  // For each simple event, compute all partitions
  const se_psets = get_se_psets(simple_events, intersections)

  // For each input event, compute all partitions
  const ie_psets = []
  const ie_probabilities = []
  for (let input_expr of input_exprs) {
    let [ie_pset, ie_probability] = eval_expr(input_expr, intersections, se_psets)
    ie_psets.push(ie_pset)
    ie_probabilities.push(ie_probability)
  }

  // For each input event, compute all fill levels
  const max_ie_flevels = get_max_flevels(simple_events, intersections)
  const ie_flevels = []
  for (let ie_pset of ie_psets) {
    let ie_flevel = get_ie_flevels(max_ie_flevels, intersections, ie_pset)
    ie_flevels.push(ie_flevel)
  }

  return flevels_to_probability(intersections, ie_flevels, max_ie_flevels, ie_probabilities)
}

simple_events_string = "A, B, C, D"

input_strings = [
  "(A and C) or B and D",
  "B and D = 0.6",
  "A and C and D = 0.2",
  "A and B and C and D = 0.1"
]

console.log(find_probability(simple_events_string, input_strings))
