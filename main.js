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
            if (result == "and") {
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
            tokens.push([event_sym, Symbol(result)])
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
