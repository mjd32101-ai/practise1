"""
Enhanced simulation with quarantine, death states, and social mobility patterns
"""
import networkx as nx
import random
import heapq
from collections import deque, defaultdict
from enum import Enum
import math

class HealthState(Enum):
    HEALTHY = "healthy"
    INFECTED = "infected"
    RECOVERED = "recovered"
    QUARANTINED = "quarantined"
    DECEASED = "deceased"

class Person:
    """Person class with enhanced attributes for social mobility"""
    def __init__(self, node_id, age, social_activity):
        self.id = node_id
        self.age = age
        self.social_activity = social_activity  # 0-1 scale
        self.state = HealthState.HEALTHY
        self.days_infected = 0
        self.days_quarantined = 0
        self.quarantine_compliance = random.uniform(0.5, 1.0)
        self.vaccinated = False
        self.immunity = 0.0
        self.mobility_pattern = self._generate_mobility_pattern()
        
    def _generate_mobility_pattern(self):
        """Generate weekly mobility pattern (time spent outside home)"""
        pattern = {}
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        for day in days:
            if day in ['Saturday', 'Sunday']:
                pattern[day] = random.uniform(0.3, 0.8) * self.social_activity
            else:
                pattern[day] = random.uniform(0.1, 0.5) * self.social_activity
        return pattern
    
    def get_daily_mobility(self, day_index):
        """Get mobility level for a specific day"""
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        day = days[day_index % 7]
        return self.mobility_pattern[day]

class EnhancedSimulation:
    def __init__(self, network, infection_rate=0.3, recovery_rate=0.1, 
                 death_rate=0.02, quarantine_rate=0.3, quarantine_effectiveness=0.8):
        
        # Graph structures
        self.network = network
        self.adjacency_list = self._build_adjacency_list()
        
        # Simulation parameters
        self.infection_rate = infection_rate
        self.recovery_rate = recovery_rate
        self.death_rate = death_rate
        self.quarantine_rate = quarantine_rate
        self.quarantine_effectiveness = quarantine_effectiveness
        
        # Data structures for efficient operations
        self.people = {}  # Node ID -> Person object
        self.quarantine_queue = deque()  # Queue for quarantine management
        self.infection_priority_queue = []  # Priority queue for infection spread
        self.day_schedule = defaultdict(list)  # Day-based activity schedule
        
        # Initialize people with attributes
        self._initialize_people()
        
        # Simulation state
        self.reset()
    
    def _build_adjacency_list(self):
        """Build adjacency list for efficient neighbor access"""
        adj_list = {}
        for node in self.network.nodes():
            adj_list[node] = list(self.network.neighbors(node))
        return adj_list
    
    def _initialize_people(self):
        """Initialize people with realistic attributes"""
        for node in self.network.nodes():
            age = random.randint(18, 80)
            social_activity = random.betavariate(2, 2)  # Beta distribution for social activity
            self.people[node] = Person(node, age, social_activity)
    
    def reset(self):
        """Reset simulation state"""
        self.infected = set()
        self.recovered = set()
        self.quarantined = set()
        self.deceased = set()
        self.step_count = 0
        self.running = False
        
        # Reset all people
        for person in self.people.values():
            person.state = HealthState.HEALTHY
            person.days_infected = 0
            person.days_quarantined = 0
    
    def initialize_infection(self, initial_count=5, seed_nodes=None):
        """Initialize infection with optional seed nodes"""
        if seed_nodes:
            self.infected = set(seed_nodes[:initial_count])
        else:
            all_nodes = list(self.network.nodes())
            self.infected = set(random.sample(all_nodes, min(initial_count, len(all_nodes))))
        
        for node in self.infected:
            self.people[node].state = HealthState.INFECTED
        
        self.step_count = 0
        self._update_day_schedule()
    
    def _update_day_schedule(self):
        """Update daily activity schedule based on mobility patterns"""
        self.day_schedule.clear()
        day_index = self.step_count % 7
        
        for node, person in self.people.items():
            if person.state not in [HealthState.QUARANTINED, HealthState.DECEASED]:
                mobility = person.get_daily_mobility(day_index)
                if mobility > 0.3:  # Only schedule if mobile enough
                    # Add to schedule with priority based on social activity
                    heapq.heappush(self.day_schedule[day_index], 
                                  (-mobility, node))  # Negative for max-heap
    
    def step(self):
        """Perform one simulation step with social mobility patterns"""
        if not self.running:
            return None
        
        day_index = self.step_count % 7
        new_infections = set()
        new_recoveries = set()
        new_deaths = set()
        new_quarantines = set()
        
        # Process infections based on daily schedule
        active_nodes = []
        for _, node in self.day_schedule[day_index]:
            if self.people[node].state not in [HealthState.QUARANTINED, HealthState.DECEASED]:
                active_nodes.append(node)
        
        # Spread infection from infected to their neighbors
        for infected_node in list(self.infected):
            person = self.people[infected_node]
            
            # Infection severity increases with time
            infection_pressure = min(1.0, 0.2 + (person.days_infected * 0.1))
            
            for neighbor in self.adjacency_list[infected_node]:
                neighbor_person = self.people[neighbor]
                
                # Skip if neighbor is not active or already infected/recovered/deceased
                if (neighbor_person.state != HealthState.HEALTHY or 
                    neighbor not in active_nodes):
                    continue
                
                # Calculate transmission probability
                base_prob = self.infection_rate
                social_factor = person.social_activity * neighbor_person.social_activity
                distance_factor = 1.0 / (1 + person.days_infected)  # Less infectious over time?
                age_risk = 1.0 + (neighbor_person.age - 40) / 100  # Higher risk for older
                
                transmission_prob = (base_prob * social_factor * 
                                   distance_factor * age_risk * infection_pressure)
                
                if random.random() < transmission_prob:
                    new_infections.add(neighbor)
                    
                    # Chance of immediate quarantine based on symptoms
                    if random.random() < self.quarantine_rate * neighbor_person.quarantine_compliance:
                        new_quarantines.add(neighbor)
            
            # Update infection duration
            person.days_infected += 1
            
            # Check for recovery or death
            if person.days_infected > 14:  # After 14 days
                age_risk_factor = 1.0 + (person.age - 40) / 200
                death_prob = self.death_rate * age_risk_factor
                
                if random.random() < death_prob:
                    new_deaths.add(infected_node)
                elif random.random() < self.recovery_rate:
                    new_recoveries.add(infected_node)
        
        # Process quarantine
        for node in list(self.quarantined):
            person = self.people[node]
            person.days_quarantined += 1
            
            # End quarantine after 14 days
            if person.days_quarantined >= 14:
                self.quarantined.remove(node)
                if person.state == HealthState.INFECTED:
                    # Check recovery after quarantine
                    if random.random() < self.recovery_rate:
                        new_recoveries.add(node)
        
        # Update states
        for node in new_infections:
            self.people[node].state = HealthState.INFECTED
            self.infected.add(node)
        
        for node in new_recoveries:
            self.people[node].state = HealthState.RECOVERED
            if node in self.infected:
                self.infected.remove(node)
            if node in self.quarantined:
                self.quarantined.remove(node)
            self.recovered.add(node)
        
        for node in new_deaths:
            self.people[node].state = HealthState.DECEASED
            if node in self.infected:
                self.infected.remove(node)
            if node in self.quarantined:
                self.quarantined.remove(node)
            self.deceased.add(node)
        
        for node in new_quarantines:
            if node not in self.deceased:
                self.people[node].state = HealthState.QUARANTINED
                self.quarantined.add(node)
        
        self.step_count += 1
        self._update_day_schedule()
        
        return self.get_stats()
    
    def get_stats(self):
        """Get current simulation statistics"""
        healthy_count = len([p for p in self.people.values() 
                           if p.state == HealthState.HEALTHY])
        
        return {
            'step': self.step_count,
            'day': self.step_count % 7,
            'healthy': healthy_count,
            'infected': len(self.infected),
            'recovered': len(self.recovered),
            'quarantined': len(self.quarantined),
            'deceased': len(self.deceased),
            'total': len(self.people)
        }
    
    def get_node_states(self):
        """Get the state of each node"""
        states = {}
        for node, person in self.people.items():
            states[node] = person.state.value
        return states
    
    def get_network_analysis(self):
        """Analyze network properties relevant to disease spread"""
        # Calculate centrality measures
        degree_centrality = nx.degree_centrality(self.network)
        betweenness_centrality = nx.betweenness_centrality(self.network, k=100)
        
        # Find super-spreaders (top 5% by degree)
        super_spreaders = sorted(degree_centrality.items(), 
                               key=lambda x: x[1], reverse=True)[:len(self.network)//20]
        
        # Calculate clustering coefficient
        clustering = nx.average_clustering(self.network)
        
        # Calculate shortest paths (approximate)
        avg_path_length = self._approximate_average_path_length()
        
        return {
            'avg_degree': sum(dict(self.network.degree()).values()) / len(self.network),
            'clustering_coefficient': clustering,
            'avg_path_length': avg_path_length,
            'super_spreaders': [node for node, _ in super_spreaders],
            'degree_centrality': degree_centrality,
            'betweenness_centrality': betweenness_centrality
        }
    
    def _approximate_average_path_length(self):
        """Approximate average path length for large networks"""
        if len(self.network) > 1000:
            # Sample nodes for approximation
            sample_size = min(100, len(self.network))
            sample_nodes = random.sample(list(self.network.nodes()), sample_size)
            
            total_path_length = 0
            count = 0
            
            for i in range(sample_size):
                for j in range(i+1, sample_size):
                    try:
                        path_length = nx.shortest_path_length(self.network, 
                                                            sample_nodes[i], 
                                                            sample_nodes[j])
                        total_path_length += path_length
                        count += 1
                    except nx.NetworkXNoPath:
                        continue
            
            return total_path_length / count if count > 0 else 0
        else:
            try:
                return nx.average_shortest_path_length(self.network)
            except:
                return 0
    
    def apply_intervention(self, intervention_type, strength=0.5):
        """Apply intervention measures"""
        if intervention_type == "social_distancing":
            # Reduce social activity
            for person in self.people.values():
                person.social_activity *= (1 - strength)
        
        elif intervention_type == "lockdown":
            # Quarantine random portion of population
            nodes_to_quarantine = random.sample(
                list(self.network.nodes()), 
                int(len(self.network) * strength)
            )
            for node in nodes_to_quarantine:
                if self.people[node].state == HealthState.HEALTHY:
                    self.people[node].state = HealthState.QUARANTINED
                    self.quarantined.add(node)
        
        elif intervention_type == "vaccination":
            # Vaccinate portion of healthy population
            healthy_nodes = [node for node, person in self.people.items() 
                           if person.state == HealthState.HEALTHY]
            nodes_to_vaccinate = random.sample(
                healthy_nodes, 
                int(len(healthy_nodes) * strength)
            )
            for node in nodes_to_vaccinate:
                self.people[node].vaccinated = True
                self.people[node].immunity = 0.9  # 90% immunity