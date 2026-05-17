def is_safe(v, graph, path, pos):

    # Check if current vertex is adjacent
    # to the previous vertex
    if graph[path[pos - 1]][v] == 0:
        return False

    # Check if vertex already exists in path
    if v in path:
        return False

    return True


def hamiltonian_cycle_util(graph, path, pos, V):

    # All vertices are included
    if pos == V:

        # Check if last vertex connects to first
        if graph[path[pos - 1]][path[0]] == 1:
            return True
        else:
            return False

    # Try different vertices
    for v in range(1, V):

        if is_safe(v, graph, path, pos):

            path[pos] = v

            if hamiltonian_cycle_util(graph, path, pos + 1, V):
                return True

            # Backtrack
            path[pos] = -1

    return False


def hamiltonian_cycle(graph, V):

    path = [-1] * V

    # Start from vertex 0
    path[0] = 0

    if not hamiltonian_cycle_util(graph, path, 1, V):
        print("No Hamiltonian Cycle Exists")
        return

    print("Hamiltonian Cycle:")

    for vertex in path:
        print(vertex, end=" ")

    print(path[0])


# Main Program
V = int(input("Enter number of vertices: "))

print("Enter adjacency matrix:")

graph = []

for i in range(V):
    row = list(map(int, input().split()))
    graph.append(row)

hamiltonian_cycle(graph, V)