
# Imports
using Combinatorics, RowEchelon

# Convert the input string into a list of tokens
function lex_input(input_string)
    tokens = []
    # Token type for each regexp
    token_types = [:whitespace, :oparen, :cparen, :rator, :rator, :equals, :event]
    regexps = [
	r"^\s+",      # whitespace
	r"^\(",       # opening parenthesis
	r"^\)",       # closing parenthesis
	r"^and",      # the word "and"
	r"^or",       # the word "or"
                      # a number
	r"^=\s*([0-9]*\.?[0-9]+)",
	r"^[^\s)=]+"  # a word
    ]
    while input_string != ""
	match_found = false
        # Compare input_string against each regexp until a match is found
	for i in 1:length(token_types)
	    result_status = match(regexps[i], input_string)
	    if result_status != nothing
		match_found = true
		result = result_status.match
		if token_types[i] == :oparen || token_types[i] == :cparen
		    push!(tokens, [token_types[i] :none])
		elseif token_types[i] == :rator
		    if result == "and"
			push!(tokens, [:rator :n])
		    else
			push!(tokens, [:rator :u])
		    end
		elseif token_types[i] == :equals
		    result = result_status.captures[1]
		    push!(tokens, [:equals parse(Float64, result)])
		elseif token_types[i] == :event
		    push!(tokens, [:event Symbol(result)])
		end
                # Discard the matching part of input_string
		input_string = SubString(input_string, length(result) + 1, length(input_string))
		break
	    end
	end
	if match_found == false
	    break
	end
    end
    return tokens
end

# Convert a list of tokens to an AST

# Grammar for AST:
#   input_expr = expr_list
#   expr_list = expr expr_tail
#   expr_tail = empty | RATOR expr_list
#   expr = EVENT | OPAREN expr_list CPAREN

function is_next(type, tokens)
    if tokens == []
	return false
    else
	return tokens[1][1] == type
    end
end

function consume(type, tokens)
    if tokens == []
	# Throw an error
    elseif tokens[1][1] != type
	# Throw an error
    else
	value = tokens[1][2]
	popfirst!(tokens)
	return value
    end
end

function parse_input(tokens)
    result = parse_expr_list(tokens)
    return result
end

function parse_expr_list(tokens)
    expr_result = parse_expr(tokens)
    expr_list_result = parse_expr_tail(expr_result, tokens)
    return expr_list_result
end

function parse_expr_tail(expr_result, tokens)
    if is_next(:rator, tokens)
	result = []
	rator_result = [:rator, consume(:rator, tokens)]
	expr_list_result = parse_expr_list(tokens)
	push!(result, expr_result, rator_result)
	if expr_list_result[1] == :event
	    push!(result, expr_list_result)
	else
	    append!(result, expr_list_result)
	end
	return result
    elseif is_next(:equals, tokens)
	result = []
	equals_result = [:equals, consume(:equals, tokens)]
	push!(result, expr_result, equals_result)
    else
	return expr_result
    end
end

function parse_expr(tokens)
    if is_next(:event, tokens)
	return [:event, consume(:event, tokens)]
    elseif is_next(:oparen, tokens)
	consume(:oparen, tokens)
	result = parse_expr_list(tokens)
	consume(:cparen, tokens)
	return result
    end
end

# For each simple event in EVENTS, compute the set of
# all events which are its partitions
function get_se_psets(simple_events, intersections)
    se_psets = Dict()
    for simple_event in simple_events
	push!(se_psets, simple_event => [])
	for intersection in intersections
            # Whether intersection is a partition of simple_event
	    if in(simple_event, intersection)
		push!(se_psets[simple_event], true)
	    else
		push!(se_psets[simple_event], false)
	    end
	end
    end
    return se_psets
end

# Convert an input expression to the set of all events
# which are its partitions
function eval_expr(expr, intersections, se_psets)
    ie_pset = zeros(Bool, length(intersections))
    rator = :u
    value = 0
    for subexpr in expr
	if subexpr[1] == :rator
	    rator = subexpr[2]
	elseif subexpr[1] == :event
	    event = subexpr[2]
	    if rator == :u
		ie_pset = ie_pset .| se_psets[event]
	    else
		ie_pset = ie_pset .& se_psets[event]
	    end
        elseif subexpr[1] == :equals
            value = subexpr[2]
	else
	    # Recurse on subexpr
            subexpr_result, value = eval_expr(subexpr, intersections, se_psets)
	    if rator == :u
		ie_pset = ie_pset .| subexpr_result
	    else
		ie_pset = ie_pset .& subexpr_result
	    end
	end
    end
    return ie_pset, value
end

# For each possible event in INTERSECTIONS, compute the number of
# all possible partitions
function get_max_flevels(simple_events, intersections)
    max_flevels = []
    for intersection in intersections
	push!(max_flevels,
	      2^(length(simple_events) - length(intersection)))
    end
    return max_flevels
end

# For each input expression, for each possible event in INTERSECTIONS,
# compute that number of partitions that are present in the expression
function get_ie_flevels(max_flevels, intersections, ie_pset)
    ie_flevels = zeros(Int64, length(intersections))
    for i in 1:length(ie_pset)
	if ie_pset[i] == true
	    ie_partition = intersections[i]
	    for j in 1:length(intersections)
                # Increment flevel for current partition
                # Also increment flevel for each subset of current partition
		if issubset(intersections[j], ie_partition)
		    if ie_flevels[i] < max_flevels[i]
			ie_flevels[i] += 1
		    end
		end
	    end
	end
    end
    return ie_flevels
end

# Find the probability of the unknown event
function flevels_to_probability(intersections, ie_flevels, max_ie_flevels, input_probabilities)
    # Convert the known fill levels to a system of linear equations
    unknown = Array{Int64, 1}(undef, length(intersections) + 1)
    known_system = Array{Int64, 2}(undef, length(ie_flevels), length(intersections) + 1)
    num_cols = length(intersections)

    # Always true that the sum of the probabilities of all partitions is 100%
    known_system[1, 1:(end - 1)] .= 1
    known_system[1, end] = 100

    # Convert fill levels to fill status
    for i in 1:length(ie_flevels)
	input_fstatus = Array{Int64, 1}(undef, length(intersections))
	for j in 1:length(intersections)
	    if ie_flevels[i][j] == max_ie_flevels[j]
		input_fstatus[j] = 1
	    else
		input_fstatus[j] = 0
	    end
	end
	if i == 1
	    unknown[1:(end - 1)] = input_fstatus
	    unknown[end] = input_probabilities[i] * 100
	else
	    known_system[i, 1:(end - 1)] = input_fstatus
	    known_system[i, end] = input_probabilities[i] * 100
	end
    end

    # Solve the system of known linear equations
    known_rref, pivots = rref_with_pivots(known_system)
    known_rref = Int.(known_rref)

    # Solve the system wrt the unknown linear equation
    p = 1
    for i in 1:length(intersections)
	if unknown[i] != 0
	    while p <= length(pivots) && i != pivots[p]
		p += 1
	    end
	    if p > length(pivots)
		# Throw an error
		println("Inconsistent system of equations")
		break
	    else
		unknown = @. unknown - unknown[i] * known_rref[p, :]
	    end
	end
    end

    # Return the probability
    return - unknown[end]
end

function find_probability(simple_events, input_strings)
    input_exprs = []
    for input_string in input_strings
        push!(input_exprs, parse_input(lex_input(input_string)))
    end

    # List of all possible intersections of events
    # Equivalently, of all partitions of the sample space
    intersections = collect(powerset(simple_events))

    # For each simple event, compute all partitions
    se_psets = get_se_psets(simple_events, intersections)

    # For each input event, compute all partitions
    ie_psets = []
    ie_probabilities = []
    for input_expr in input_exprs
        ie_pset, ie_probability = eval_expr(input_expr, intersections, se_psets)
        push!(ie_psets, ie_pset)
        push!(ie_probabilities, ie_probability)
    end

    # For each input event, compute all fill levels
    max_ie_flevels = get_max_flevels(simple_events, intersections)
    ie_flevels = []
    for ie_pset in ie_psets
        ie_flevel = get_ie_flevels(max_ie_flevels, intersections, ie_pset)
        push!(ie_flevels, ie_flevel)
    end

    return flevels_to_probability(intersections, ie_flevels, max_ie_flevels, ie_probabilities)
end

# Assumed input: a list of simple events
simple_events = [:A, :B, :C, :D]

input_strings = [
    "(A and C) or B and D",
    "B and D = 0.6",
    "A and C and D = 0.2",
    "A and B and C and D = 0.1"
]

find_probability(simple_events, input_strings)
