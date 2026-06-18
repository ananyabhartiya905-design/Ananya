import sys

# 1. Define the Graph using a nested dictionary
# This matches the graph structure shown in your first screenshot
neighbours = {
    'A': {'C': 3, 'F': 2},
    'B': {'D': 1, 'E': 2, 'F': 6, 'G': 2},
    'C': {'A': 3, 'D': 4, 'E': 1, 'F': 2},
    'D': {'B': 1, 'C': 4},
    'E': {'B': 2, 'C': 1, 'F': 3},
    'F': {'A': 2, 'B': 6, 'C': 2, 'E': 3, 'G': 5},
    'G': {'B': 2, 'F': 5}
}

def find_path(start, target):
    shortestPath = {}
    previousCity = {}
    unexplored = []
    
    # 2. Initialization phase
    for node in neighbours:
        shortestPath[node] = sys.maxsize  # Using system maxsize as infinity
        previousCity[node] = ""
        unexplored.append(node)
        
    shortestPath[start] = 0
    
    # 3. Main Dijkstra Algorithm loop
    while unexplored:
        minCity = None
        
        # Find the node with the smallest distance in the unexplored list
        for node in unexplored:
            if minCity is None:
                minCity = node
            elif shortestPath[node] < shortestPath[minCity]:
                minCity = node
                
        # If the minimum distance is infinity, the remaining nodes are unreachable
        if shortestPath[minCity] == sys.maxsize:
            break
            
        # Remove the current city from the unexplored list
        unexplored.remove(minCity)
        
        # Break early if we have reached our target destination
        if minCity == target:
            break
            
        # Update shortest path values for all neighbors of minCity
        for childNode, weight in neighbours[minCity].items():
            if shortestPath[minCity] + weight < shortestPath[childNode]:
                shortestPath[childNode] = shortestPath[minCity] + weight
                previousCity[childNode] = minCity

    # 4. Reconstruct the shortest path from target back to start
    path = []
    currentCity = target
    
    while currentCity != start:
        if currentCity == "":
            return "Path not found", None
        path.insert(0, currentCity)
        currentCity = previousCity[currentCity]
        
    path.insert(0, start)
    
    return " -> ".join(path), shortestPath[target]

# 5. Execution Block
# Finding the path from 'B' to 'F' as per your original problem
path, distance = find_path('B', 'F')

print(f"Shortest Distance: {distance}")
print(f"Shortest Path: {path}")