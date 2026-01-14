from flask import Flask, jsonify, request
from flask_cors import CORS
import networkx as nx
import random
import math
import os
import gzip

app = Flask(__name__)
CORS(app)

# Cache layouts per dataset to avoid recomputing expensive spring_layout
pos_cache = {}

class DiseaseSimulation:
    def __init__(self, network, infection_rate=0.3, recovery_rate=0.1, quarantine_rate=0.3, death_rate=0.02):
        self.network = network
        self.infection_rate = infection_rate
        self.recovery_rate = recovery_rate
        self.quarantine_rate = quarantine_rate
        self.death_rate = death_rate
        
        # Store original positions for nodes to return from quarantine
        self.original_positions = {}
        self.quarantine_positions = {}
        self.reset()
    
    def reset(self):
        """Reset the simulation state"""
        self.infected = set()
        self.recovered = set()
        self.deceased = set()
        self.quarantined = set()
        self.step_count = 0
        self.running = False
        
        # Reset all node positions
        self.node_positions = {}
        self.quarantine_positions = {}
        self.original_positions = {}
        # Track when nodes entered quarantine to reliably release them
        self.quarantine_enter_time = {}
        
    def initialize_network(self, positions):
        """Initialize node positions from network layout"""
        for node_id, pos in positions.items():
            self.node_positions[node_id] = {'x': pos[0], 'y': pos[1]}
            self.original_positions[node_id] = {'x': pos[0], 'y': pos[1]}
        
        # Create quarantine area positions
        self._setup_quarantine_area()
    
    def _setup_quarantine_area(self):
        """Set up organized positions in quarantine area"""
        nodes = list(self.network.nodes())
        num_nodes = len(nodes)
        
        # Create a grid for quarantine area
        # Calculate grid dimensions based on number of nodes
        cols = int(math.ceil(math.sqrt(num_nodes * 1.5)))  # More columns for horizontal layout
        rows = int(math.ceil(num_nodes / cols))
        
        # Spacing between nodes in quarantine
        cell_width = 0.25 / cols
        cell_height = 0.25 / rows
        
        for i, node in enumerate(nodes):
            row = i // cols
            col = i % cols
            
            # Position in quarantine area (0.7 to 0.95 range)
            x_quarantine = 0.7 + (col * cell_width) + (cell_width * 0.3)
            y_quarantine = 0.7 + (row * cell_height) + (cell_height * 0.3)
            
            # Ensure within bounds dont cross the border
            x_quarantine = min(0.95, max(0.7, x_quarantine))
            y_quarantine = min(0.95, max(0.7, y_quarantine))
            
            self.quarantine_positions[node] = {
                'x': x_quarantine,
                'y': y_quarantine
            }
    
    def initialize_infection(self, initial_count=5):
        """Initialize the simulation with infected nodes"""
        all_nodes = list(self.network.nodes())
        self.infected = set(random.sample(all_nodes, min(initial_count, len(all_nodes))))
        self.recovered = set()
        self.deceased = set()
        self.quarantined = set()
        self.step_count = 0
        
        # Initialize node state durations
        self.node_state_duration = {node: 0 for node in all_nodes}
    
    def step(self):
        #Perform one simulation step with quarantine movement
        if not self.running:
            return None
        
        new_infections = set()
        new_recoveries = set()
        new_deaths = set()
        new_quarantines = set()
        quarantine_releases = set()
        
        # Update state durations
        for node in self.network.nodes():
            self.node_state_duration[node] += 1
        
        # 1. Spread infection from infected nodes (only non-quarantined)
        for node in list(self.infected):
            if node not in self.quarantined:  # Only spread if not quarantined
                for neighbor in self.network.neighbors(node):
                    if (neighbor not in self.infected and 
                        neighbor not in self.recovered and
                        neighbor not in self.quarantined and
                        random.random() < self.infection_rate):
                        new_infections.add(neighbor)
        
        self.infected.update(new_infections)
        
        # 2. Check for quarantine -new infections might get quarantined
        for node in new_infections:
            if random.random() < self.quarantine_rate:
                new_quarantines.add(node)

        # Reset duration for newly quarantined nodes so release timing is correct
        for node in new_quarantines:
            self.node_state_duration[node] = 0
            # record quarantine enter time
            self.quarantine_enter_time[node] = self.step_count
        
        # Also check existing infected nodes for quarantine
        for node in list(self.infected):
            if node not in self.quarantined and random.random() < self.quarantine_rate * 0.1:
                new_quarantines.add(node)
                self.quarantine_enter_time[node] = self.step_count
        
        # 3. Release from quarantine after recovery or time limit
        for node in list(self.quarantined):
            # Release if recovered
            if node in self.recovered:
                quarantine_releases.add(node)
                continue

            # Release based on quarantine enter time (reliable)
            enter = self.quarantine_enter_time.get(node)
            if enter is not None and (self.step_count - enter) >= 10:
                quarantine_releases.add(node)
        
        # Process quarantine releases
        for node in quarantine_releases:
            self.quarantined.remove(node)
            # Reset duration for released nodes so they aren't immediately re-released
            self.node_state_duration[node] = 0
            # remove enter-time tracking
            if node in self.quarantine_enter_time:
                del self.quarantine_enter_time[node]
            # Snap released nodes back to their original positions immediately
            if node in self.original_positions:
                self.node_positions[node]['x'] = self.original_positions[node]['x']
                self.node_positions[node]['y'] = self.original_positions[node]['y']
        
        # 4. Recovery and death process
        for node in list(self.infected):
            # Recovery chance increases with time
            days_infected = self.node_state_duration[node]
            recovery_chance = min(self.recovery_rate * (1 + days_infected / 15), 0.8)
            # Death chance increases modestly with time infected
            death_chance = min(self.death_rate * (1 + days_infected / 20), 0.5)

            # Check death first 
            if random.random() < death_chance:
                new_deaths.add(node)
            elif random.random() < recovery_chance:
                new_recoveries.add(node)
        
        # Remove recovered nodes
        self.infected -= new_recoveries
        self.quarantined -= new_recoveries
        self.recovered.update(new_recoveries)
        # Clean up quarantine tracking and snap recovered nodes back to their original positions
        for node in new_recoveries:
            if node in self.quarantine_enter_time:
                del self.quarantine_enter_time[node]
            if node in self.original_positions:
                self.node_positions[node]['x'] = self.original_positions[node]['x']
                self.node_positions[node]['y'] = self.original_positions[node]['y']

        # Process deaths
        for node in new_deaths:
            if node in self.infected:
                self.infected.remove(node)
            if node in self.quarantined:
                self.quarantined.remove(node)
                if node in self.quarantine_enter_time:
                    del self.quarantine_enter_time[node]
            self.deceased.add(node)
        
        # 5. Add new quarantines
        self.quarantined.update(new_quarantines)
        
        # 6. Update node positions based on state
        self._update_node_positions()
        
        self.step_count += 1
        
        return self.get_stats()
    
    def _update_node_positions(self):
        """Update node positions: quarantined nodes move to quarantine area"""
        movement_speed = 0.6  # Faster movement
        
        for node in self.network.nodes():
            if node in self.quarantined:
                # Move towards quarantine area
                target_x = self.quarantine_positions[node]['x']
                target_y = self.quarantine_positions[node]['y']
                
                current_x = self.node_positions[node]['x']
                current_y = self.node_positions[node]['y']
                
                # Move towards target
                distance_x = target_x - current_x
                distance_y = target_y - current_y
                
                if abs(distance_x) > 0.001 or abs(distance_y) > 0.001:
                    self.node_positions[node]['x'] = current_x + distance_x * movement_speed
                    self.node_positions[node]['y'] = current_y + distance_y * movement_speed
                else:
                    # Snap to exact position
                    self.node_positions[node]['x'] = target_x
                    self.node_positions[node]['y'] = target_y
            else:
                # Any node that is not quarantined (healthy, infected, recovered)
                # should gradually return to its original position unless deceased.
                if node in self.deceased:
                    continue

                current_x = self.node_positions[node]['x']
                current_y = self.node_positions[node]['y']
                original_x = self.original_positions.get(node, {'x': 0.5})['x']
                original_y = self.original_positions.get(node, {'y': 0.5})['y']

                distance_x = original_x - current_x
                distance_y = original_y - current_y

                if abs(distance_x) > 0.001 or abs(distance_y) > 0.001:
                    self.node_positions[node]['x'] = current_x + distance_x * movement_speed
                    self.node_positions[node]['y'] = current_y + distance_y * movement_speed
                else:
                    self.node_positions[node]['x'] = original_x
                    self.node_positions[node]['y'] = original_y
    
    def get_stats(self):
        """Get current simulation statistics"""
        all_nodes = set(self.network.nodes())
        healthy = all_nodes - self.infected - self.recovered - self.quarantined
        
        return {
            'step': self.step_count,
            'healthy': len(healthy),
            'infected': len(self.infected),
            'recovered': len(self.recovered),
            'quarantined': len(self.quarantined),
            'deceased': len(self.deceased)
        }
    
    def get_node_states_and_positions(self):
        """Get the state and position of each node"""
        states = {}
        positions = {}
        
        for node in self.network.nodes():
            if node in self.deceased:
                states[node] = 'deceased'
            elif node in self.quarantined:
                states[node] = 'quarantined'
            elif node in self.infected:
                states[node] = 'infected'
            elif node in self.recovered:
                states[node] = 'recovered'
            else:
                states[node] = 'healthy'
            
            positions[node] = self.node_positions.get(node, {'x': 0.5, 'y': 0.5})
        
        return states, positions

def load_dataset(dataset='synthetic', target_nodes=500):
    if dataset == 'real':
        data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
        data_dir = os.path.abspath(data_dir)
        try:
            for fname in os.listdir(data_dir):
                if fname.endswith('.txt') or fname.endswith('.txt.gz'):
                    path = os.path.join(data_dir, fname)
                    G = nx.Graph()
                    open_func = gzip.open if fname.endswith('.gz') else open
                    with open_func(path, 'rt', encoding='utf-8', errors='ignore') as fh:
                        for line in fh:
                            parts = line.strip().split()
                            if len(parts) >= 2:
                                try:
                                    u = int(parts[0])
                                    v = int(parts[1])
                                    G.add_edge(u, v)
                                except ValueError:
                                    continue

                    if G.number_of_nodes() == 0:
                        continue

                    # If larger than target, take a subgraph of target_nodes
                    if G.number_of_nodes() > target_nodes:
                        nodes = list(G.nodes())
                        sampled = set(random.sample(nodes, target_nodes))
                        G = G.subgraph(sampled).copy()

                    print(f"Loaded real dataset from {fname} ({G.number_of_nodes()} nodes, {G.number_of_edges()} edges)")
                    return G
        except Exception as e:
            print(f"Error loading real dataset: {e}")

        # Fallback to synthetic if loading failed
        print("No usable real dataset found; falling back to synthetic")

    # Synthetic dataset
    try:
        G = nx.barabasi_albert_graph(target_nodes, 2)
        print(f"Generated synthetic network ({target_nodes} nodes)")
        return G
    except Exception as e:
        print(f"Error generating synthetic network: {e}")
        return nx.erdos_renyi_graph(target_nodes, 0.02)

# Initialize network
# Initialize with an empty network; actual network will be loaded per request
network = nx.Graph()
simulation = DiseaseSimulation(network)

@app.route('/')
def serve_frontend():
    return """
    <html>
        <head><title>Disease Spread Simulation</title></head>
        <body>
            <h1>Disease Spread Simulation Backend</h1>
            <p>Server is running. Use the frontend at index.html</p>
        </body>
    </html>
    """

@app.route('/api/network', methods=['GET'])
def get_network():
    """Return the network structure with initial positions"""
    # Determine requested dataset
    dataset = request.args.get('dataset', 'synthetic')

    # Load network according to dataset choice
    global network
    network = load_dataset(dataset=dataset, target_nodes=500)
    simulation.network = network

    # Use a layout algorithm but cache results to avoid recomputing on each request
    cache_key = f"network:{dataset}:{len(network.nodes())}"
    if cache_key in pos_cache:
        pos = pos_cache[cache_key]
    else:
        # Use higher-quality layout (more iterations) but cache it for subsequent requests
        pos = nx.spring_layout(network, k=0.5, iterations=100, scale=0.8)
        pos_cache[cache_key] = pos
    
    # Normalize positions to larger area (0.1 to 0.7 range) - increased from 0.6
    min_x = min(p[0] for p in pos.values())
    max_x = max(p[0] for p in pos.values())
    min_y = min(p[1] for p in pos.values())
    max_y = max(p[1] for p in pos.values())
    
    # Scale to fit in 0.1-0.7 range (more space, leaving room for quarantine)
    normalized_pos = {}
    for node, (x, y) in pos.items():
        if max_x != min_x:
            normalized_x = 0.05 + (x - min_x) / (max_x - min_x) * 0.6  # Increased from 0.5 to 0.6
        else:
            normalized_x = 0.4
        if max_y != min_y:
            normalized_y = 0.1 + (y - min_y) / (max_y - min_y) * 0.6  # Increased from 0.5 to 0.6
        else:
            normalized_y = 0.4
        normalized_pos[node] = (normalized_x, normalized_y)
    
    # Store positions in simulation
    simulation.initialize_network(normalized_pos)
    
    nodes = []
    for i in network.nodes():
        pos_data = simulation.node_positions.get(i, {'x': 0.4, 'y': 0.4})
        nodes.append({
            'id': i, 
            'x': pos_data['x'],
            'y': pos_data['y'],
            'state': 'healthy'
        })
    
    edges = [{'source': u, 'target': v} for u, v in network.edges()]
    
    return jsonify({
        'nodes': nodes,
        'edges': edges,
        'total_nodes': len(nodes),
        'total_edges': len(edges)
    })

@app.route('/api/simulation/start', methods=['POST'])
def start_simulation():
    """Start the simulation with given parameters"""
    data = request.get_json() or {}
    initial_infected = data.get('initialInfected', 5)
    infection_rate = data.get('infectionRate', 0.3)
    recovery_rate = data.get('recoveryRate', 0.1)
    quarantine_rate = data.get('quarantineRate', 0.3)
    death_rate = data.get('deathRate', 0.02)
    dataset = data.get('dataset')
    
    # Reset simulation
    simulation.reset()
    simulation.infection_rate = infection_rate
    simulation.recovery_rate = recovery_rate
    simulation.quarantine_rate = quarantine_rate
    simulation.death_rate = death_rate
    # If a dataset was provided, (re)load the network
    global network
    if dataset:
        network = load_dataset(dataset=dataset, target_nodes=500)
        simulation.network = network
    
    # Re-initialize network positions with better layout (cached)
    cache_key = f"network:{dataset or 'synthetic'}:{len(network.nodes())}"
    if cache_key in pos_cache:
        pos = pos_cache[cache_key]
    else:
        pos = nx.spring_layout(network, k=0.5, iterations=100, scale=0.8)
        pos_cache[cache_key] = pos
    
    # Normalize positions to larger area (0.1 to 0.7 range)
    min_x = min(p[0] for p in pos.values())
    max_x = max(p[0] for p in pos.values())
    min_y = min(p[1] for p in pos.values())
    max_y = max(p[1] for p in pos.values())
    
    # Scale to fit in 0.1-0.7 range
    normalized_pos = {}
    for node, (x, y) in pos.items():
        if max_x != min_x:
            normalized_x = 0.1 + (x - min_x) / (max_x - min_x) * 0.6
        else:
            normalized_x = 0.4
        if max_y != min_y:
            normalized_y = 0.1 + (y - min_y) / (max_y - min_y) * 0.6
        else:
            normalized_y = 0.4
        normalized_pos[node] = (normalized_x, normalized_y)
    
    simulation.initialize_network(normalized_pos)
    
    simulation.initialize_infection(initial_count=initial_infected)
    simulation.running = True
    
    stats = simulation.get_stats()
    node_states, node_positions = simulation.get_node_states_and_positions()
    
    # Update nodes with positions
    nodes = []
    node_states_dict = {}
    for node_id in network.nodes():
        nodes.append({
            'id': node_id,
            'x': node_positions[node_id]['x'],
            'y': node_positions[node_id]['y'],
            'state': node_states[node_id]
        })
        node_states_dict[node_id] = node_states[node_id]
    
    return jsonify({
        'status': 'started',
        **stats,
        'nodes': nodes,
        'node_states': node_states_dict
    })

@app.route('/api/simulation/step', methods=['GET'])
def simulation_step():
    """Perform one step of the simulation. If the simulation isn't running,
    return current stats instead of returning a 400 error.
    """
    if not simulation.running:
        # Return current stats (avoid 400) so frontend can poll safely
        stats = simulation.get_stats()
    else:
        stats = simulation.step()
        if stats is None:
            return jsonify({'error': 'Simulation error'}), 500
    
    node_states, node_positions = simulation.get_node_states_and_positions()
    
    # Update nodes with positions
    nodes = []
    node_states_dict = {}
    for node_id in network.nodes():
        nodes.append({
            'id': node_id,
            'x': node_positions[node_id]['x'],
            'y': node_positions[node_id]['y'],
            'state': node_states[node_id]
        })
        node_states_dict[node_id] = node_states[node_id]
    
    return jsonify({
        **stats,
        'nodes': nodes,
        'node_states': node_states_dict
    })

@app.route('/api/simulation/stop', methods=['POST'])
def stop_simulation():
    """Stop the simulation"""
    simulation.running = False
    return jsonify({'status': 'stopped'})

@app.route('/api/simulation/reset', methods=['POST'])
def reset_simulation():
    """Reset the simulation"""
    simulation.reset()
    return jsonify({'status': 'reset'})

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get current simulation status"""
    stats = simulation.get_stats()
    
    return jsonify({
        'running': simulation.running,
        **stats,
        'infection_rate': simulation.infection_rate,
        'recovery_rate': simulation.recovery_rate,
        'quarantine_rate': simulation.quarantine_rate,
        'death_rate': getattr(simulation, 'death_rate', 0.0)
    })

if __name__ == '__main__':
    print("Disease Spread Simulation Backend")
    print("=" * 40)
    print(f"Network: {len(network.nodes())} nodes, {len(network.edges())} edges")
    print("Features: Quarantine area, moving nodes, dynamic visualization")
    print("Server running on http://127.0.0.1:5000")
    print("Note: Using up to 500 nodes for visualization")
    app.run(debug=True, port=5000)