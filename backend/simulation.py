import networkx as nx
import random
import time

class DiseaseSimulation:
    def __init__(self, network, infection_rate=0.3, recovery_rate=0.1):
        self.network = network
        self.infection_rate = infection_rate
        self.recovery_rate = recovery_rate
        self.reset()
    
    def reset(self):
        """Reset the simulation state"""
        self.infected = set()
        self.recovered = set()
        self.step_count = 0
        self.running = False
    
    def initialize_infection(self, initial_count=5):
        """Initialize the simulation with infected nodes"""
        all_nodes = list(self.network.nodes())
        self.infected = set(random.sample(all_nodes, initial_count))
        self.recovered = set()
        self.step_count = 0
    
    def step(self):
        """Perform one simulation step"""
        if not self.running:
            return
        
        # Spread infection to neighbors
        new_infections = set()
        for node in self.infected:
            for neighbor in self.network.neighbors(node):
                if (neighbor not in self.infected and 
                    neighbor not in self.recovered and
                    random.random() < self.infection_rate):
                    new_infections.add(neighbor)
        
        self.infected.update(new_infections)
        
        # Recover some infected nodes
        new_recoveries = set()
        for node in list(self.infected):
            if random.random() < self.recovery_rate:
                new_recoveries.add(node)
        
        self.infected -= new_recoveries
        self.recovered.update(new_recoveries)
        
        self.step_count += 1
        
        return self.get_stats()
    
    def get_stats(self):
        """Get current simulation statistics"""
        healthy = set(self.network.nodes()) - self.infected - self.recovered
        return {
            'step': self.step_count,
            'healthy': len(healthy),
            'infected': len(self.infected),
            'recovered': len(self.recovered)
        }
    
    def get_node_states(self):
        """Get the state of each node"""
        states = {}
        for node in self.network.nodes():
            if node in self.infected:
                states[node] = 'infected'
            elif node in self.recovered:
                states[node] = 'recovered'
            else:
                states[node] = 'healthy'
        return states

# Example usage
if __name__ == "__main__":
    # Create a sample network (replace with Facebook dataset)
    G = nx.erdos_renyi_graph(100, 0.1)
    
    # Initialize simulation
    sim = DiseaseSimulation(G, infection_rate=0.2, recovery_rate=0.05)
    sim.initialize_infection(initial_count=3)
    sim.running = True
    
    # Run simulation for 50 steps
    for _ in range(50):
        stats = sim.step()
        print(f"Step {stats['step']}: Healthy={stats['healthy']}, Infected={stats['infected']}, Recovered={stats['recovered']}")
        time.sleep(0.1)