
# Imports
using Combinatorics

# Assumed input: a list of all possible events
events = [:A, :B, :C, :D]

# Assumed input: an AST from parsing an expression of events
# With the following grammar:
#   input_expr = rand_expr rator_expr rand_expr
#    rand_expr = event | OPAREN rand_expr rator_expr rand_expr CPAREN
#   rator_expr = UNION | INTERSECT
# The following represents the expression "(A n C) u B n D"
example_expr = [[[:event :A], [:rator :n], [:event :C]], [:rator :u], [:event :B], [:rator :n], [:event :D]]

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

function eval_expr(expr)
    # Convert EXPR to a list of disjoint intersections
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

eval_expr(example_expr)
