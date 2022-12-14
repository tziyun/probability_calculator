
# Imports
using Combinatorics, RowEchelon

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
            subexpr_result, value = eval_expr(subexpr, single_disjoints)
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

# Assumed input: an AST from parsing an expression of events
# With the following grammar:
#   input_expr = rand_expr rator_expr rand_expr
#    rand_expr = event | OPAREN rand_expr rator_expr rand_expr CPAREN
#   rator_expr = UNION | INTERSECT

input_exprs = [
    # The unknown expression "(A n C) u B n D"
    [[[:event :A], [:rator :n], [:event :C]], [:rator :u], [:event :B], [:rator :n], [:event :D]],
    # The known expression "B n D"
    [[:event :B], [:rator :n], [:event :D], [:equals 0.6]],
    # The known expression "A n C n D"
    [[:event :A], [:rator :n], [:event :C], [:rator :n], [:event :D], [:equals 0.2]],
    # The known expression "A n B n C n D"
    [[:event :A], [:rator :n], [:event :B], [:rator :n], [:event :C], [:rator :n], [:event :D], [:equals 0.1]]
]

# List representing all possible intersections of events
intersections = collect(powerset(single_events))

# For each single event, record all of its disjoint subsets
single_disjoints = create_single_disjoints(single_events, intersections)

# Disjoint set corresponding to each input expression
input_dsets = []
input_probabilities = []
for input_expr in input_exprs
    dset, probability = eval_expr(input_expr, single_disjoints)
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
