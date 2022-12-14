
# Imports
using Combinatorics, RowEchelon

# Convert the input string into a list of tokens
function lex_input(input_string)
    tokens = []
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

# Convert EXPR to a list of disjoint intersections
function eval_expr(expr, intersections, single_disjoints)
    disjoints = zeros(Bool, length(intersections))
    rator = :u
    value = 0
    for subexpr in expr
	if subexpr[1] == :rator
	    rator = subexpr[2]
	elseif subexpr[1] == :event
	    event = subexpr[2]
	    if rator == :u
		disjoints = disjoints .| single_disjoints[event]
	    else
		disjoints = disjoints .& single_disjoints[event]
	    end
        elseif subexpr[1] == :equals
            value = subexpr[2]
	else
	    # Recurse on subexpr
            subexpr_result, value = eval_expr(subexpr, intersections, single_disjoints)
	    if rator == :u
		disjoints = disjoints .| subexpr_result
	    else
		disjoints = disjoints .& subexpr_result
	    end
	end
    end
    return disjoints, value
end

# For each possible event in INTERSECTIONS, record the number of
# all possible disjoint subset events
function max_fill_levels(single_events, intersections)
    max_fill_levels = []
    for intersection in intersections
	push!(max_fill_levels,
	      2^(length(single_events) - length(intersection)))
    end
    return max_fill_levels
end

# For each possible event in INTERSECTIONS, record the number of
# disjoint subset events that are "present", derived from one
# expression of user input.
function current_fill_levels(max_fill_levels, intersections, input_disjoints)
    current_fill_levels = zeros(Int64, length(intersections))
    for i in 1:length(input_disjoints)
	if input_disjoints[i] == true
	    temp_disjoint = intersections[i]
	    for j in 1:length(intersections)
		if issubset(intersections[j], temp_disjoint)
		    if current_fill_levels[i] < max_fill_levels[i]
			current_fill_levels[i] += 1
		    end
		end
	    end
	end
    end
    return current_fill_levels
end

# For each single event in EVENTS, record all events which are
# its disjoint constituents. That is, the sum of all disjoint
# constituents equals the event.
function create_single_disjoints(single_events, intersections)
    single_disjoints = Dict()
    for single_event in single_events
	push!(single_disjoints, single_event => [])
	for intersection in intersections
	    if in(single_event, intersection)
		push!(single_disjoints[single_event], true)
	    else
		push!(single_disjoints[single_event], false)
	    end
	end
    end
    return single_disjoints
end

# Find the probability of the unknown event
function find_probability(intersections, input_flevels, input_probabilities)
    # Convert the known fill levels to a system of linear equations
    unknown = Array{Int64, 1}(undef, length(intersections) + 1)
    known_system = Array{Int64, 2}(undef, length(input_flevels), length(intersections) + 1)
    num_cols = length(intersections)

    # Always true that the sum of the probabilities of all disjoints is 100%
    known_system[1, 1:(end - 1)] .= 1
    known_system[1, end] = 100

    for i in 1:length(input_flevels)
	input_fstatus = Array{Int64, 1}(undef, length(intersections))
	for j in 1:length(intersections)
	    if input_flevels[i][j] == max_flevels[j]
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

    return - unknown[end]
end

# Assumed input: a list of single events
single_events = [:A, :B, :C, :D]

input_strings = [
    "(A and C) or B and D",
    "B and D = 0.6",
    "A and C and D = 0.2",
    "A and B and C and D = 0.1"
]

input_exprs = []
for input_string in input_strings
    push!(input_exprs, parse_input(lex_input(input_string)))
end

# List representing all possible intersections of events
intersections = collect(powerset(single_events))

# For each single event, record all of its disjoint subsets
single_disjoints = create_single_disjoints(single_events, intersections)

# Disjoint set corresponding to each input expression
input_dsets = []
input_probabilities = []
for input_expr in input_exprs
    dset, probability = eval_expr(input_expr, intersections, single_disjoints)
    push!(input_dsets, dset)
    push!(input_probabilities, probability)
end

# Fill levels corresponding to each input expression
max_flevels = max_fill_levels(single_events, intersections)
input_flevels = []
for input_dset in input_dsets
    flevel = current_fill_levels(max_flevels, intersections, input_dset)
    push!(input_flevels, flevel)
end

find_probability(intersections, input_flevels, input_probabilities)
