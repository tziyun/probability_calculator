const WHITESPACE = Symbol('whitespace');
const OPAREN = Symbol('oparen');
const CPAREN = Symbol('cparen');
const RATOR = Symbol('rator');
const EQUALS = Symbol('equals');
const EVENTS = Symbol('event');
const AND = Symbol('and');
const OR = Symbol('or');

/**
 * Converts the input string into a list of tokens
 * @param {string} inputString - The input event.
 * @param {Array} simpleEvents - The list of simple events.
 * @return {Array} tokens - The input event as a list of tokens.
 */
function lexInput(inputString, simpleEvents) {
  const tokens = [];

  // token type for each regexp
  const tokenTypes = [WHITESPACE, OPAREN, CPAREN, RATOR, RATOR, EQUALS, EVENTS];

  const regexps = [
    /^\s+/, // whitespace
    /^\(/, // opening parentheses
    /^\)/, // closing parentheses
    /^and/, // the word 'and'
    /^or/, // the word 'or'
    /^=\s*([0-9]*\.?[0-9]+)/, // a number
    /^[^\s)=]+/, // a word
  ];

  while (inputString != '') {
    let matchFound = false;

    // Compare inputString against each regexp until a match is found
    for (let i = 0; i < tokenTypes.length; i++) {
      const resultStatus = inputString.match(regexps[i]);
      if (resultStatus != null) {
        matchFound = true;
        const result = resultStatus[0];

        switch (tokenTypes[i]) {
          case OPAREN:
          case CPAREN:
            tokens.push([tokenTypes[i], null]);
            break;
          case RATOR:
            if (result === 'and') {
              tokens.push([RATOR, AND]);
            } else {
              tokens.push([RATOR, OR]);
            }
            break;
          case EQUALS: {
            const probability = resultStatus[1];
            tokens.push([EQUALS, Number(probability)]);
            break;
          }
          case EVENTS:
            if (simpleEvents.includes(result) == false) {
              throw new Error(`Unexpected event type: ${result}`);
            }
            tokens.push([EVENTS, result]);
            break;
        }

        // Discard the matching part of inputString
        inputString = inputString.substring(result.length, inputString.length);
        break;
      }
    }
    if (matchFound == false) {
      break;
    }
  }
  return tokens;
}

/**
 * Converts a list of tokens into an AST
 * Grammar for AST:
 *    inputExpr = exprList
 *    exprList = expr exprTail
 *    exprTail = empty | RATOR exprList | EQUALS number
 *    expr = EVENT | OPAREN exprList CPAREN
 * @param {Array} tokens - The list of tokens.
 * @return {Array} - The resulting AST.
 */
function parseInput(tokens) {
  const result = parseExprList(tokens);
  return result;
}

/**
 * @param {Symbol} type - The expected type of the next token.
 * @param {Array} tokens - The list of yet-to-be-seen tokens.
 * @return {boolean} - Whether the expected type matches.
 */
function isNext(type, tokens) {
  if (tokens.length == 0) {
    return false;
  } else {
    return tokens[0][0] === type;
  }
}

/**
 * Processes the next token.
 * @param {Symbol} type - The type of the next token.
 * @param {Array} tokens - The list of yet-to-be-seen tokens.
 * @return {Symbol | number} - The value of the next token.
 */
function consume(type, tokens) {
  if (tokens.length == 0) {
    throw new Error('Expected an additional token but none remaining');
  } else if (tokens[0][0] !== type) {
    throw new Error(
        `Expected token of type ${type} but received type ${tokens[0][0]}`);
  } else {
    const value = tokens[0][1];
    tokens.shift();
    return value;
  }
}

/**
 * @param {Array} tokens - The list of yet-to-be-seen tokens.
 * @return {Array} - The AST of the list of tokens.
 */
function parseExprList(tokens) {
  const exprResult = parseExpr(tokens);
  const exprListResult = parseExprTail(exprResult, tokens);
  return exprListResult;
}

/**
 * @param {Array} exprResult - The partial AST of the expr.
 * @param {Array} tokens - The list of yet-to-be-seen tokens.
 * @return {Array} - The AST of the list of tokens.
 */
function parseExprTail(exprResult, tokens) {
  if (isNext(RATOR, tokens)) {
    let result = [];
    const ratorResult = [RATOR, consume(RATOR, tokens)];
    const exprListResult = parseExprList(tokens);
    result.push(exprResult, ratorResult);
    if (exprListResult[0] === EVENTS) {
      result.push(exprListResult);
    } else {
      result = result.concat(exprListResult);
    }
    return result;
  } else if (isNext(EQUALS, tokens)) {
    const result = [];
    const equalsResult = [EQUALS, consume(EQUALS, tokens)];
    result.push(exprResult, equalsResult);
    return result;
  } else {
    return [exprResult];
  }
}

/**
 * @param {Array} tokens - The list of yet-to-be-seen tokens.
 * @return {Array} - The AST of the list of tokens.
 */
function parseExpr(tokens) {
  if (isNext(EVENTS, tokens)) {
    return [EVENTS, consume(EVENTS, tokens)];
  } else if (isNext(OPAREN, tokens)) {
    consume(OPAREN, tokens);
    const result = parseExprList(tokens);
    consume(CPAREN, tokens);
    return result;
  } else {
    throw new Error('Expected event or open parenthesis but found none');
  }
}

/**
 * Computes the partitions of each simple event.
 * @param {Array} simpleEvents - The list of simple events.
 * @param {Array} intersections - The list of intersections.
 * @return {Array} - The probability-set of each simple event.
 */
function getSimplePsets(simpleEvents, intersections) {
  const simplePsets = new Map();
  for (const simpleEvent of simpleEvents) {
    simplePsets.set(simpleEvent, []);
    for (const intersection of intersections) {
      // Whether intersection is a partition of simpleEvent
      if (intersection.includes(simpleEvent)) {
        simplePsets.get(simpleEvent).push(1);
      } else {
        simplePsets.get(simpleEvent).push(0);
      }
    }
  }
  return simplePsets;
}

/**
 * Computes the partitions of an input event.
 * @param {Array} expr - The input event, as an expr.
 * @param {Array} intersections - The list of intersections.
 * @param {Array} simplePsets - The probability-set of each simple event.
 * @return {Array} - The probability-set of the input event.
 */
function evalExpr(expr, intersections, simplePsets) {
  const inputPset = new Array(intersections.length);
  for (let i = 0; i < intersections.length; i++) {
    inputPset[i] = 0;
  }
  let rator = OR;
  let value;
  let op;
  for (const subexpr of expr) {
    switch (subexpr[0]) {
      case RATOR:
        rator = subexpr[1];
        break;
      case EVENTS: {
        const inputEvent = subexpr[1];
        op = (rator === OR) ? math.bitOr : math.bitAnd;
        for (let i = 0; i < inputPset.length; i++) {
          inputPset[i] = op(inputPset[i], simplePsets.get(inputEvent)[i]);
        }
        break;
      }
      case EQUALS:
        value = subexpr[1];
        break;
      default: {
        // Recurse on subexpr
        let subexprResult;
        [subexprResult, value] = evalExpr(subexpr, intersections, simplePsets);
        op = (rator === OR) ? math.bitOr : math.bitAnd;
        for (let i = 0; i < inputPset.length; i++) {
          inputPset[i] = op(inputPset[i], subexprResult[i]);
        }
        break;
      }
    }
  }
  return [inputPset, value];
}

/**
 * Computes the maximum fill level (how many partitions in each
 * powerset-region) for each powerset-region.
 * @param {Array} simpleEvents - The list of simple events.
 * @param {Array} intersections - The list of intersections.
 * @return {Array} - The maximum fill levels.
 */
function getMaxFlevels(simpleEvents, intersections) {
  const maxFlevels = [];
  for (const intersection of intersections) {
    maxFlevels.push(Math.pow(2, simpleEvents.length - intersection.length));
  }
  return maxFlevels;
}

/**
 * Computes the actual fill levels (how many partitions occupied in each
 * powerset-region) of an input event.
 * @param {Array} maxFlevels - The maximum fill level for the powerset-region.
 * @param {Array} intersections - The list of intersections.
 * @param {Array} inputPset - The probability-set of the input event.
 * @return {Array} - The fill level for each intersection.
 */
function getInputFlevels(maxFlevels, intersections, inputPset) {
  const inputFlevels = new Array(intersections.length);
  setArrayRange(inputFlevels, 0, intersections.length, 0);
  for (let i = 0; i < inputPset.length; i++) {
    if (inputPset[i] == true) {
      const inputPartition = intersections[i];
      for (let j = 0; j < intersections.length; j++) {
        // Increment flevel for current partition
        // Also increment flevel for each subset of current partition
        if (math.setIsSubset(intersections[j], inputPartition)) {
          if (inputFlevels[j] < maxFlevels[j]) {
            inputFlevels[j] += 1;
          }
        }
      }
    }
  }
  return inputFlevels;
}

/**
 * Set all elements within some range of an array
 * @param {Array} arr - The array to be modified.
 * @param {number} start - The starting index (inclusive).
 * @param {number} end - The ending index (exclusive).
 * @param {number} value - The value to set the range to.
 */
function setArrayRange(arr, start, end, value) {
  for (let i = start; i < end; i++) {
    arr[i] = value;
  }
}

/**
 * Convert a matrix to row-reduced echelon form.
 * @param {Array} matrix - The matrix to be converted.
 * @return {Array} - The index of each pivot.
 */
function rref(matrix) {
  const numRows = matrix.length;
  const numCols = matrix[0].length;
  let pivotRow = 0;
  const pivots = [];
  for (let j = 0; j < numCols; j++) {
    for (let i = pivotRow; i < numRows; i++) {
      const current = matrix[i][j];
      if (current != 0) {
        if (current != 1) {
          matrix[i] = matrix[i].map((entry) => {
            return entry / current;
          });
        }
        const tempRow = matrix[pivotRow];
        matrix[pivotRow] = matrix[i];
        matrix[i] = tempRow;
        for (let i = 0; i < numRows; i++) {
          if (i != pivotRow) {
            const factor = matrix[i][j] / matrix[pivotRow][j];
            for (let k = 0; k < numCols; k++) {
              matrix[i][k] = matrix[i][k] - (factor * matrix[pivotRow][k]);
            }
          }
        }
        pivots.push(j);
        pivotRow++;
        break;
      }
    }
  }
  return pivots;
}

/**
 * Convert the fill level of each input event, and the probabilities of the
 * known events, to a probability of the unknown event.
 * @param {Array} intersections - The list of intersections.
 * @param {Array} inputFlevels - The actual fill level for the powerset-region.
 * @param {Array} maxInputFlevels - The max fill level for the powerset-region.
 * @param {Array} inputProbabilities - The probability-set of the input event.
 * @return {number} - The probability of the unknown event.
 */
function flevelsToProbability(
    intersections, inputFlevels, maxInputFlevels, inputProbabilities) {
  // Convert the known fill levels to a system of linear equations
  const unknown = new Array(intersections.length + 1);
  const knownSystem = new Array(inputFlevels.length);
  for (let i = 0; i < inputFlevels.length; i++) {
    knownSystem[i] = new Array(intersections.length + 1);
  }
  const numCols = intersections.length + 1;

  // Always true that the sum of the probabilities of all partitions is 100%
  setArrayRange(knownSystem[0], 0, numCols - 1, 1);
  knownSystem[0][numCols - 1] = 1;

  // Convert fill levels to fill status
  for (let i = 0; i < inputFlevels.length; i++) {
    const inputFstatus = new Array(numCols - 1);
    for (let j = 0; j < numCols - 1; j++) {
      if (inputFlevels[i][j] == maxInputFlevels[j]) {
        inputFstatus[j] = 1;
      } else {
        inputFstatus[j] = 0;
      }
    }
    if (i == 0) {
      for (let k = 0; k < numCols - 1; k++) {
        unknown[k] = inputFstatus[k];
      }
      unknown[numCols - 1] = 0;
    } else {
      for (let k = 0; k < numCols - 1; k++) {
        knownSystem[i][k] = inputFstatus[k];
      }
      knownSystem[i][numCols - 1] = inputProbabilities[i];
    }
  }

  // Solve the system of known linear equations
  const pivots = rref(knownSystem);

  // Solve the system wrt the unknown linear equation
  let p = 0;
  for (let i = 0; i < numCols - 1; i++) {
    if (unknown[i] != 0) {
      while (p < pivots.length && i != pivots[p]) {
        p++;
      }
      if (p >= pivots.length) {
        // Inconsistent system of equations
        throw new Error('Insufficient or conflicting information');
      } else {
        const factor = unknown[i];
        for (let k = 0; k < numCols; k++) {
          unknown[k] = unknown[k] - (factor * knownSystem[p][k]);
        }
      }
    }
  }

  // Return the probability
  return - unknown[numCols - 1];
}

/**
 * Find the probability of a uknown event.
 * @param {string} simpleEventsString - The list of simple events, as a string.
 * @param {Array} inputStrings - The list of input events, as a string.
 * @return {number} - The probability of the unknown event.
 */
function findProbability(simpleEventsString, inputStrings) {
  const simpleEvents = simpleEventsString.split(/[, ]+/);

  const inputExprs = [];
  for (const inputString of inputStrings) {
    inputExprs.push(parseInput(lexInput(inputString, simpleEvents)));
  }

  // List of all possible intersections of events
  // Equivalently, of all partitions of the sample space
  const intersections = math.setPowerset(simpleEvents);

  // For each simple event, compute all partitions
  const simplePsets = getSimplePsets(simpleEvents, intersections);

  // For each input event, compute all partitions
  const inputPsets = [];
  const inputProbabilities = [];
  for (const inputExpr of inputExprs) {
    const [inputPset, inputProbability] =
      evalExpr(inputExpr, intersections, simplePsets);
    inputPsets.push(inputPset);
    inputProbabilities.push(inputProbability);
  }

  // For each input event, compute all fill levels
  const maxInputFlevels = getMaxFlevels(simpleEvents, intersections);
  const inputFlevels = [];
  for (const inputPset of inputPsets) {
    const inputFlevel =
      getInputFlevels(maxInputFlevels, intersections, inputPset);
    inputFlevels.push(inputFlevel);
  }

  return flevelsToProbability(
      intersections,
      inputFlevels,
      maxInputFlevels,
      inputProbabilities);
}

const answer = findProbability(
    'A,B,C,D',
    ['(A and C) or B and D',
      'B and D = 0.6',
      'A and C and D = 0.2',
      'A and B and C and D = 0.1'],
);

console.log(answer);
