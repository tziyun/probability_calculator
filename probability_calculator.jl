
# Imports
using Combinatorics

mutable struct intersection_stats
    num_disjoints
    max_disjoints
    full
end

# Convert EXPR to a list of disjoint intersections
function eval_expr(expr)
    disjoints = []
    rator = :u
    for subexpr in expr
        if subexpr[1] == :rator
            rator = subexpr[2]
        elseif subexpr[1] == :event
            event = subexpr[2]
            if rator == :u
                disjoints = union(disjoints, event_disjoints[event])
            else
                disjoints = intersect(disjoints, event_disjoints[event])
            end
        else
            # Recurse on subexpr
            if rator == :u
                disjoints = union(disjoints, eval_expr(subexpr))
            else
                disjoints = intersect(disjoints, eval_expr(subexpr))
            end
        end
    end
    return disjoints
end

function create_fill_levels(intersections)
    fill_levels = Dict()
    for intersection in intersections
        if intersection == []
            continue
        end
        push!(fill_levels,
            intersection => intersection_stats(0, 2^(length(events) - length(intersection)), false))
    end
    return fill_levels
end

function clear_fill_levels(fill_levels, intersections)
    for intersection in intersections
        fill_levels[intersection].num_disjoints = 0
    end
end

function write_fill_levels(fill_levels, intersections, disjoints)
    for disjoint in disjoints
        for intersection in intersections
            if intersection == []
                continue
            end
            #println("i: $intersection, j: $disjoint")
            if issubset(intersection, disjoint)
                current = fill_levels[intersection]
                if current.full == false
                    current.num_disjoints += 1
                    if current.num_disjoints == current.max_disjoints
                        current.full = true
                    end
                end
            end
        end
    end
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

disjoints1 = eval_expr(example_expr1)
disjoints2 = eval_expr(example_expr2)
disjoints3 = eval_expr(example_expr3)

# List representing all possible intersections of events
intersections = collect(powerset(events))

# For each event, list all intersections containing the event
event_disjoints = Dict()
for event in events
    push!(event_disjoints, event => [])
    for intersection in intersections
        if in(event, intersection)
            push!(event_disjoints[event], intersection)
        end
    end
end

fill_levels1 = create_fill_levels(intersections)
write_fill_levels(fill_levels1, intersections, disjoints1)
fill_levels2 = create_fill_levels(intersections)
write_fill_levels(fill_levels2, intersections, disjoints2)
fill_levels3 = create_fill_levels(intersections)
write_fill_levels(fill_levels3, intersections, disjoints3)
