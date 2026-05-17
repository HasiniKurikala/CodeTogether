#include <stdio.h>

#define MAX 20

int graph[MAX][MAX];
int path[MAX];
int V;

int isSafe(int v, int pos) {

    if (graph[path[pos - 1]][v] == 0)
        return 0;

    for (int i = 0; i < pos; i++) {
        if (path[i] == v)
            return 0;
    }

    return 1;
}

int hamCycleUtil(int pos) {

    if (pos == V) {

        if (graph[path[pos - 1]][path[0]] == 1)
            return 1;
        else
            return 0;
    }

    for (int v = 1; v < V; v++) {

        if (isSafe(v, pos)) {

            path[pos] = v;

            if (hamCycleUtil(pos + 1))
                return 1;

            path[pos] = -1;
        }
    }

    return 0;
}

void hamCycle() {

    for (int i = 0; i < V; i++)
        path[i] = -1;

    path[0] = 0;

    if (hamCycleUtil(1) == 0) {
        printf("No Hamiltonian Cycle Exists\n");
        return;
    }

    printf("Hamiltonian Cycle:\n");

    for (int i = 0; i < V; i++)
        printf("%d ", path[i]);

    printf("%d\n", path[0]);
}

int main() {

    printf("Enter number of vertices: ");
    scanf("%d", &V);

    printf("Enter adjacency matrix:\n");

    for (int i = 0; i < V; i++) {
        for (int j = 0; j < V; j++) {
            scanf("%d", &graph[i][j]);
        }
    }

    hamCycle();

    return 0;
}