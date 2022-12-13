
# Imports
using Combinatorics

# Convert EXPR to a list of disjoint intersections
function eval_expr(expr, single_disjoints)
    disjoints = zeros(Bool, length(intersections))
    rator = :u
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
	else
	    # Recurse on subexpr
	    if rator == :u
		disjoints = disjoints .| eval_expr(subexpr, single_disjoints)
	    else
		disjoints = disjoints .& eval_expr(subexpr, single_disjoints)
	    end
	end
    end
    return disjoints
end

# For each possible event in INTERSECTIONS, record the number of
# all possible disjoint subset events
function max_fill_levels(intersections)
    max_fill_levels = []
    for intersection in intersections
	push!(max_fill_levels,
	      2^(length(events) - length(intersection)))
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
function create_single_disjoints(events, intersections)
    single_disjoints = Dict()
    for single_event in events
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

# Assumed input: a list of all possible events
events = [:A, :B, :C, :D]

# Assumed input: an AST from parsing an expression of events
# With the following grammar:
#   input_expr = rand_expr rator_expr rand_expr
#    rand_expr = event | OPAREN rand_expr rator_expr rand_expr CPAREN
#   rator_expr = UNION | INTERSECT

# Example: the unknown expression "(A n C) u B n D"
example_expr1 = [[[:event :A], [:rator :n], [:event :C]], [:rator :u], [:event :B], [:rator :n], [:event :D]]
# Example: a known expression "B n D"
example_expr2 = [[:event :B], [:rator :n], [:event :D]]
# Example: a known expression "A n C n D"
example_expr3 = [[:event :A], [:rator :n], [:event :C], [:rator :n], [:event :D]]
# Example: a known expression "A n B n C n D"
example_expr4 = [[:event :A], [:rator :n], [:event :B], [:rator :n], [:event :C], [:rator :n], [:event :D]]

# List representing all possible intersections of events
intersections = collect(powerset(events))

# For each single event, record all of its disjoint subsets
single_disjoints = create_single_disjoints(events, intersections)

disjoints1 = eval_expr(example_expr1, single_disjoints)
disjoints2 = eval_expr(example_expr2, single_disjoints)
disjoints3 = eval_expr(example_expr3, single_disjoints)
disjoints4 = eval_expr(example_expr4, single_disjoints)

max = max_fill_levels(intersections)
fill_levels1 = current_fill_levels(max, intersections, disjoints1)
fill_levels2 = current_fill_levels(max, intersections, disjoints2)
fill_levels3 = current_fill_levels(max, intersections, disjoints3)
fill_levels4 = current_fill_levels(max, intersections, disjoints4)
