const API_BASE = 'http://127.0.0.1:5000/api';

let simulation = {
    running: false,
    nodes: [],
    edges: [],
    step: 0,
    day: 0,
    backendConnected: false
};

// Animation system for quarantine movement
let nodeAnimations = new Map();
let animationFrameId = null;
const ANIMATION_DURATION = 1000; // 1 second animation
const QUARANTINE_AREA = { x: 0.7, y: 0.7, width: 0.25, height: 0.25 };

let realtimeChart = null;

class RealtimeChart {
    constructor(containerId, maxDataPoints = 100) {
        this.container = document.getElementById(containerId);
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = 300;
        this.container.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d');
        this.maxDataPoints = maxDataPoints;
        
        this.data = {
            healthy: [],
            infected: [],
            recovered: [],
            quarantined: [],
            deceased: [],
            timestamps: []
        };
        
        this.colors = {
            healthy: '#2ecc71',
            infected: '#e74c3c',
            recovered: '#3498db',
            quarantined: '#f39c12',
            deceased: '#7f8c8d'
        };
    }
    
    resize() {
        this.canvas.width = this.container.clientWidth;
        this.draw();
    }
    
    addDataPoint(stats, step) {
        this.data.healthy.push(stats.healthy);
        this.data.infected.push(stats.infected);
        this.data.recovered.push(stats.recovered);
        this.data.quarantined.push(stats.quarantined || 0);
        this.data.deceased.push(stats.deceased || 0);
        this.data.timestamps.push(step);
        
        if (this.data.healthy.length > this.maxDataPoints) {
            this.data.healthy.shift();
            this.data.infected.shift();
            this.data.recovered.shift();
            this.data.quarantined.shift();
            this.data.deceased.shift();
            this.data.timestamps.shift();
        }
        
        this.draw();
    }
    
    clear() {
        this.data = {
            healthy: [],
            infected: [],
            recovered: [],
            quarantined: [],
            deceased: [],
            timestamps: []
        };
        this.draw();
    }
    
    draw() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const padding = 40;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;
        
        ctx.clearRect(0, 0, width, height);
        
        if (this.data.timestamps.length === 0) return;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        const xStep = chartWidth / 10;
        for (let i = 0; i <= 10; i++) {
            ctx.beginPath();
            ctx.moveTo(padding + i * xStep, padding);
            ctx.lineTo(padding + i * xStep, height - padding);
            ctx.stroke();
        }
        
        const yStep = chartHeight / 5;
        for (let i = 0; i <= 5; i++) {
            ctx.beginPath();
            ctx.moveTo(padding, padding + i * yStep);
            ctx.lineTo(width - padding, padding + i * yStep);
            ctx.stroke();
        }
        
        const allData = [
            ...this.data.healthy,
            ...this.data.infected,
            ...this.data.recovered,
            ...this.data.quarantined,
            ...this.data.deceased
        ];
        const maxValue = allData.length > 0 ? Math.max(1, ...allData) : 1;
        
        const drawSeries = (data, color, label) => {
            if (data.length === 0) return;
            
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            const divisor = Math.max(1, this.data.timestamps.length - 1);
            for (let i = 0; i < data.length; i++) {
                const x = padding + (i / divisor) * chartWidth;
                const y = height - padding - (data[i] / maxValue) * chartHeight;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            
            for (let i = 0; i < data.length; i++) {
                const x = padding + (i / divisor) * chartWidth;
                const y = height - padding - (data[i] / maxValue) * chartHeight;
                
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            
            const legendX = width - 150;
            const legendY = 20 + Object.keys(this.colors).indexOf(label) * 20;
            
            ctx.fillStyle = color;
            ctx.fillRect(legendX, legendY, 15, 10);
            
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.fillText(label.charAt(0).toUpperCase() + label.slice(1), legendX + 20, legendY + 10);
        };
        
        drawSeries(this.data.healthy, this.colors.healthy, 'healthy');
        drawSeries(this.data.infected, this.colors.infected, 'infected');
        drawSeries(this.data.recovered, this.colors.recovered, 'recovered');
        drawSeries(this.data.quarantined, this.colors.quarantined, 'quarantined');
        drawSeries(this.data.deceased, this.colors.deceased, 'deceased');
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.stroke();
        
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        
        const divisor = Math.max(1, this.data.timestamps.length - 1);
        for (let i = 0; i < this.data.timestamps.length; i += Math.ceil(this.data.timestamps.length / 5)) {
            const x = padding + (i / divisor) * chartWidth;
            ctx.fillText(`Step ${this.data.timestamps[i]}`, x, height - padding + 20);
        }
        
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const y = padding + i * (chartHeight / 5);
            const value = Math.round((maxValue * (5 - i)) / 5);
            ctx.fillText(value.toString(), padding - 5, y + 4);
        }
        
        ctx.textAlign = 'center';
        ctx.font = '14px Arial';
        ctx.fillText('Disease Spread Over Time', width / 2, 20);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('networkCanvas');
    const ctx = canvas.getContext('2d');
    const statusMessage = document.getElementById('statusMessage');
    const backendStatus = document.getElementById('backendStatus');
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resetBtn = document.getElementById('resetBtn');
    const stepCount = document.getElementById('stepCount');
    const dayCount = document.getElementById('dayCount');
    
    realtimeChart = new RealtimeChart('realtimeChart');
    
    function setCanvasSize() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
    
    setCanvasSize();
    window.addEventListener('resize', () => {
        setCanvasSize();
        realtimeChart.resize();
        drawNetwork();
    });
    
    async function checkBackendConnection() {
        try {
            const response = await fetch(`${API_BASE}/status`);
            if (response.ok) {
                simulation.backendConnected = true;
                statusMessage.textContent = 'Connected to enhanced simulation backend (SIRDQ Model)';
                statusMessage.className = 'status connected';
                backendStatus.textContent = 'Connected';
                return true;
            }
        } catch (error) {
            console.error('Backend connection failed:', error);
        }
        
        simulation.backendConnected = false;
        statusMessage.textContent = 'Backend server not available. Using fallback simulation.';
        statusMessage.className = 'status error';
        backendStatus.textContent = 'Disconnected';
        return false;
    }
    
    async function loadNetwork() {
        if (!simulation.backendConnected) {
            createFallbackNetwork();
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/network`);
            const data = await response.json();
            
            simulation.nodes = data.nodes;
            simulation.edges = data.edges;
            
            // Initialize node positions - backend handles positioning
            for (const node of simulation.nodes) {
                // Store original position if not quarantined
                if (node.state !== 'quarantined' && node.state !== 'deceased') {
                    if (!node.originalX) {
                        node.originalX = node.x;
                        node.originalY = node.y;
                    }
                }
            }
            
            document.getElementById('totalNodes').textContent = data.total_nodes || simulation.nodes.length;
            updateStats();
            drawNetwork();
        } catch (error) {
            console.error('Failed to load network:', error);
            createFallbackNetwork();
        }
    }
    
    function createFallbackNetwork() {
        simulation.nodes = [];
        simulation.edges = [];
        
        const nodeCount = 500;
        // Create nodes in smaller area (0.1 to 0.6) to leave space for quarantine
        for (let i = 0; i < nodeCount; i++) {
            simulation.nodes.push({
                id: i,
                x: Math.random() * 0.5 + 0.1,
                y: Math.random() * 0.5 + 0.1,
                state: 'healthy'
            });
        }
        
        // Create edges - more connections for larger network
        for (let i = 0; i < nodeCount; i++) {
            // Each node connects to ~3-5 neighbors
            const numConnections = Math.floor(Math.random() * 3) + 3;
            const connected = new Set();
            
            for (let j = 0; j < numConnections; j++) {
                let target = Math.floor(Math.random() * nodeCount);
                if (target !== i && !connected.has(target)) {
                    connected.add(target);
                    simulation.edges.push({
                        source: i,
                        target: target
                    });
                }
            }
        }
        
        document.getElementById('totalNodes').textContent = nodeCount;
        updateStats();
        drawNetwork();
    }
    
    async function startSimulation() {
        if (!simulation.backendConnected) {
            startFallbackSimulation();
            return;
        }
        
        const infectionRate = parseFloat(document.getElementById('infectionRate').value);
        const recoveryRate = parseFloat(document.getElementById('recoveryRate').value);
        const deathRate = parseFloat(document.getElementById('deathRate').value);
        const quarantineRate = parseFloat(document.getElementById('quarantineRate').value);
        const initialInfected = parseInt(document.getElementById('initialInfected').value);
        
        // Make UI responsive immediately while backend starts
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        resetBtn.disabled = true;
        statusMessage.textContent = 'Starting simulation...';
        animationLoop();

        try {
            const response = await fetch(`${API_BASE}/simulation/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    infectionRate: infectionRate,
                    recoveryRate: recoveryRate,
                    deathRate: deathRate,
                    quarantineRate: quarantineRate,
                    initialInfected: initialInfected
                })
            });
            
            const data = await response.json();
            
            if (data.status === 'started') {
                simulation.running = true;
                simulation.step = data.step;
                simulation.day = data.day || 0;
                
                // Update nodes from backend response
                if (data.nodes) {
                    for (const backendNode of data.nodes) {
                        const node = simulation.nodes.find(n => n.id === backendNode.id);
                        if (node) {
                            node.state = backendNode.state || 'healthy';
                            if (backendNode.x !== undefined && backendNode.y !== undefined) {
                                node.x = backendNode.x;
                                node.y = backendNode.y;
                            }
                        }
                    }
                } else if (data.node_states) {
                    // Fallback to old format
                    for (const node of simulation.nodes) {
                        node.state = data.node_states[node.id] || 'healthy';
                    }
                }
                
                updateStats(data);
                drawNetwork();
                updateControls();
                realtimeChart.clear();
                realtimeChart.addDataPoint(data, data.step);
                
                // Start main loops
                animationLoop();
                simulationLoop();
            }
        } catch (error) {
            console.error('Failed to start simulation:', error);
            startFallbackSimulation();
        }
    }
    
    function startFallbackSimulation() {
        const initialInfected = parseInt(document.getElementById('initialInfected').value);
        const infectionRate = parseFloat(document.getElementById('infectionRate').value);
        const recoveryRate = parseFloat(document.getElementById('recoveryRate').value);
        const deathRate = parseFloat(document.getElementById('deathRate').value);
        const quarantineRate = parseFloat(document.getElementById('quarantineRate').value);
        
        for (const node of simulation.nodes) {
            node.state = 'healthy';
            node.infectionTime = 0;
            node.quarantineTime = 0;
        }
        
        for (let i = 0; i < initialInfected; i++) {
            const randomIndex = Math.floor(Math.random() * simulation.nodes.length);
            simulation.nodes[randomIndex].state = 'infected';
            simulation.nodes[randomIndex].infectionTime = 0;
        }
        
        simulation.running = true;
        simulation.step = 0;
        simulation.day = 0;
        simulation.infectionRate = infectionRate;
        simulation.recoveryRate = recoveryRate;
        simulation.deathRate = deathRate;
        simulation.quarantineRate = quarantineRate;
        
        updateStats();
        drawNetwork();
        updateControls();
        realtimeChart.clear();
        animationLoop();
        fallbackSimulationLoop();
    }
    
    async function simulationLoop() {
        if (!simulation.running || !simulation.backendConnected) return;
        
        try {
            const response = await fetch(`${API_BASE}/simulation/step`);
            const data = await response.json();
            
            if (data.error) {
                console.error('Simulation error:', data.error);
                simulation.running = false;
                updateControls();
                return;
            }
            
            simulation.step = data.step;
            simulation.day = data.day || 0;
            
            // Update node positions and states from backend
            if (data.nodes) {
                for (const backendNode of data.nodes) {
                    const node = simulation.nodes.find(n => n.id === backendNode.id);
                    if (node) {
                        const oldState = node.state;
                        const newState = backendNode.state || 'healthy';
                        
                        // Update position from backend (backend handles movement)
                        if (backendNode.x !== undefined && backendNode.y !== undefined) {
                            // Only update if not currently animating
                            if (!nodeAnimations.has(node.id)) {
                                node.x = backendNode.x;
                                node.y = backendNode.y;
                            }
                        }
                        
                        // Handle quarantine animation
                        if (newState === 'quarantined' && oldState !== 'quarantined') {
                            startQuarantineAnimation(node);
                        } else if (oldState === 'quarantined' && newState !== 'quarantined') {
                            endQuarantineAnimation(node);
                        }
                        
                        node.state = newState;
                    }
                }
            } else if (data.node_states) {
                // Fallback to old format
                for (const node of simulation.nodes) {
                    const newState = data.node_states[node.id] || 'healthy';
                    const oldState = node.state;
                    
                    // Handle quarantine animation
                    if (newState === 'quarantined' && oldState !== 'quarantined') {
                        startQuarantineAnimation(node);
                    } else if (oldState === 'quarantined' && newState !== 'quarantined') {
                        endQuarantineAnimation(node);
                    }
                    
                    node.state = newState;
                }
            }
            
            updateStats(data);
            drawNetwork();
            stepCount.textContent = simulation.step;
            dayCount.textContent = simulation.day;
            
            realtimeChart.addDataPoint(data, simulation.step);
            
            if (!animationFrameId) {
                animationLoop();
            }
            
            if (simulation.running) {
                setTimeout(() => simulationLoop(), 1000);
            }
        } catch (error) {
            console.error('Simulation step failed:', error);
            simulation.running = false;
            updateControls();
        }
    }
    
    function fallbackSimulationLoop() {
        if (!simulation.running || simulation.backendConnected) return;
        
        for (const edge of simulation.edges) {
            const source = simulation.nodes[edge.source];
            const target = simulation.nodes[edge.target];
            
            if ((source.state === 'infected' && target.state === 'healthy') ||
                (target.state === 'infected' && source.state === 'healthy')) {
                
                if (Math.random() < simulation.infectionRate) {
                    if (source.state === 'healthy') {
                        source.state = 'infected';
                        source.infectionTime = 0;
                    } else {
                        target.state = 'infected';
                        target.infectionTime = 0;
                    }
                }
            }
        }
        
        for (const node of simulation.nodes) {
            const oldState = node.state;
            
            if (node.state === 'infected') {
                node.infectionTime++;
                
                if (node.infectionTime > 7 && Math.random() < simulation.quarantineRate) {
                    node.state = 'quarantined';
                    node.quarantineTime = 0;
                    if (oldState !== 'quarantined') {
                        startQuarantineAnimation(node);
                    }
                }
                
                if (node.infectionTime > 14) {
                    if (Math.random() < simulation.deathRate) {
                        node.state = 'deceased';
                    } else if (Math.random() < simulation.recoveryRate) {
                        node.state = 'recovered';
                    }
                }
            } else if (node.state === 'quarantined') {
                node.quarantineTime++;
                if (node.quarantineTime > 14) {
                    if (Math.random() < simulation.recoveryRate) {
                        node.state = 'recovered';
                        if (oldState === 'quarantined') {
                            endQuarantineAnimation(node);
                        }
                    }
                }
            }
        }
        
        simulation.step++;
        simulation.day = Math.floor(simulation.step / 3);
        
        updateStats();
        drawNetwork();
        stepCount.textContent = simulation.step;
        dayCount.textContent = simulation.day;
        
        const stats = {
            healthy: simulation.nodes.filter(n => n.state === 'healthy').length,
            infected: simulation.nodes.filter(n => n.state === 'infected').length,
            recovered: simulation.nodes.filter(n => n.state === 'recovered').length,
            quarantined: simulation.nodes.filter(n => n.state === 'quarantined').length,
            deceased: simulation.nodes.filter(n => n.state === 'deceased').length
        };
        
        realtimeChart.addDataPoint(stats, simulation.step);
        
        if (!animationFrameId) {
            animationLoop();
        }
        
        if (simulation.running) {
            setTimeout(() => fallbackSimulationLoop(), 1000);
        }
    }
    
    async function stopSimulation() {
        simulation.running = false;
        
        if (simulation.backendConnected) {
            try {
                await fetch(`${API_BASE}/simulation/stop`, { method: 'POST' });
            } catch (error) {
                console.error('Failed to stop simulation:', error);
            }
        }
        
        if (animationFrameId && nodeAnimations.size === 0) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        
        updateControls();
    }
    
    async function resetSimulation() {
        // Immediate UI reset for responsiveness
        simulation.running = false;
        nodeAnimations.clear();
        for (const node of simulation.nodes) {
            node.state = 'healthy';
            node.originalX = undefined;
            node.originalY = undefined;
        }
        simulation.step = 0;
        simulation.day = 0;
        stepCount.textContent = '0';
        dayCount.textContent = '0';
        updateStats();
        drawNetwork();

        // Send reset to backend but keep UI responsive while server updates
        if (simulation.backendConnected) {
            try {
                fetch(`${API_BASE}/simulation/reset`, { method: 'POST' })
                    .catch(err => console.error('Failed to reset backend:', err));
                // refresh network asynchronously (don't block UI)
                loadNetwork();
            } catch (error) {
                console.error('Failed to reset simulation:', error);
            }
        }
        
        if (realtimeChart) {
            realtimeChart.clear();
        }
        updateControls();
    }
    
    function updateStats(data = null) {
        if (data) {
            document.getElementById('healthyCount').textContent = data.healthy;
            document.getElementById('infectedCount').textContent = data.infected;
            document.getElementById('recoveredCount').textContent = data.recovered;
            document.getElementById('quarantinedCount').textContent = data.quarantined || 0;
            document.getElementById('deceasedCount').textContent = data.deceased || 0;
        } else {
            const healthyCount = simulation.nodes.filter(node => node.state === 'healthy').length;
            const infectedCount = simulation.nodes.filter(node => node.state === 'infected').length;
            const recoveredCount = simulation.nodes.filter(node => node.state === 'recovered').length;
            const quarantinedCount = simulation.nodes.filter(node => node.state === 'quarantined').length;
            const deceasedCount = simulation.nodes.filter(node => node.state === 'deceased').length;
            
            document.getElementById('healthyCount').textContent = healthyCount;
            document.getElementById('infectedCount').textContent = infectedCount;
            document.getElementById('recoveredCount').textContent = recoveredCount;
            document.getElementById('quarantinedCount').textContent = quarantinedCount;
            document.getElementById('deceasedCount').textContent = deceasedCount;
        }
    }
    
    function startQuarantineAnimation(node) {
        if (!node.originalX || !node.originalY) {
            node.originalX = node.x;
            node.originalY = node.y;
        }
        
        // Use exact quarantine area coordinates (matching backend)
        const targetX = QUARANTINE_AREA.x + (node.id % 10) * (QUARANTINE_AREA.width / 10) + QUARANTINE_AREA.width * 0.05;
        const targetY = QUARANTINE_AREA.y + Math.floor((node.id % 100) / 10) * (QUARANTINE_AREA.height / 10) + QUARANTINE_AREA.height * 0.05;
        
        // Ensure within bounds
        const finalX = Math.min(QUARANTINE_AREA.x + QUARANTINE_AREA.width - 0.01, Math.max(QUARANTINE_AREA.x + 0.01, targetX));
        const finalY = Math.min(QUARANTINE_AREA.y + QUARANTINE_AREA.height - 0.01, Math.max(QUARANTINE_AREA.y + 0.01, targetY));
        
        nodeAnimations.set(node.id, {
            startX: node.x,
            startY: node.y,
            targetX: finalX,
            targetY: finalY,
            startTime: Date.now(),
            duration: ANIMATION_DURATION
        });
    }
    
    function endQuarantineAnimation(node) {
        if (node.originalX !== undefined && node.originalY !== undefined) {
            nodeAnimations.set(node.id, {
                startX: node.x,
                startY: node.y,
                targetX: node.originalX,
                targetY: node.originalY,
                startTime: Date.now(),
                duration: ANIMATION_DURATION
            });
        }
    }
    
    function updateAnimations() {
        const now = Date.now();
        const toRemove = [];
        
        for (const [nodeId, anim] of nodeAnimations.entries()) {
            const node = simulation.nodes.find(n => n.id === nodeId);
            if (!node) {
                toRemove.push(nodeId);
                continue;
            }
            
            const elapsed = now - anim.startTime;
            const progress = Math.min(elapsed / anim.duration, 1);
            
            // Easing function for smooth animation
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            node.x = anim.startX + (anim.targetX - anim.startX) * easeProgress;
            node.y = anim.startY + (anim.targetY - anim.startY) * easeProgress;
            
            if (progress >= 1) {
                node.x = anim.targetX;
                node.y = anim.targetY;
                if (node.state !== 'quarantined') {
                    node.originalX = undefined;
                    node.originalY = undefined;
                }
                toRemove.push(nodeId);
            }
        }
        
        for (const nodeId of toRemove) {
            nodeAnimations.delete(nodeId);
        }
    }
    
    function drawNetwork() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw quarantine area
        const quarantineX = canvas.width * QUARANTINE_AREA.x;
        const quarantineY = canvas.height * QUARANTINE_AREA.y;
        const quarantineWidth = canvas.width * QUARANTINE_AREA.width;
        const quarantineHeight = canvas.height * QUARANTINE_AREA.height;
        
        ctx.fillStyle = 'rgba(243, 156, 18, 0.1)';
        ctx.fillRect(quarantineX, quarantineY, quarantineWidth, quarantineHeight);
        
        ctx.strokeStyle = 'rgba(243, 156, 18, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(quarantineX, quarantineY, quarantineWidth, quarantineHeight);
        ctx.setLineDash([]);
        
        // Draw quarantine label
        ctx.fillStyle = '#f39c12';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('QUARANTINE ZONE', quarantineX + quarantineWidth / 2, quarantineY + 20);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        
        for (const edge of simulation.edges) {
            const source = simulation.nodes[edge.source];
            const target = simulation.nodes[edge.target];
            
            // Don't draw edges to/from quarantined nodes
            if (source.state === 'quarantined' || target.state === 'quarantined') {
                continue;
            }
            
            ctx.beginPath();
            ctx.moveTo(source.x * canvas.width, source.y * canvas.height);
            ctx.lineTo(target.x * canvas.width, target.y * canvas.height);
            ctx.stroke();
        }
        
        for (const node of simulation.nodes) {
            let color;
            
            switch (node.state) {
                case 'healthy': color = '#2ecc71'; break;
                case 'infected': color = '#e74c3c'; break;
                case 'recovered': color = '#3498db'; break;
                case 'quarantined': color = '#f39c12'; break;
                case 'deceased': color = '#7f8c8d'; break;
                default: color = '#2ecc71';
            }
            
            const x = node.x * canvas.width;
            const y = node.y * canvas.height;
            
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
            
            if (node.state === 'infected') {
                ctx.shadowColor = '#e74c3c';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(x, y, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
            
            if (node.state === 'quarantined') {
                ctx.strokeStyle = '#f39c12';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        
    }
    
    function animationLoop() {
        if (simulation.running || nodeAnimations.size > 0) {
            updateAnimations();
            drawNetwork();
            animationFrameId = requestAnimationFrame(animationLoop);
        } else {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        }
    }
    
    function updateControls() {
        startBtn.disabled = simulation.running;
        pauseBtn.disabled = !simulation.running;
        resetBtn.disabled = simulation.running;
    }
    
    document.getElementById('infectionRate').addEventListener('input', function() {
        document.getElementById('infectionRateValue').textContent = this.value;
    });
    
    document.getElementById('recoveryRate').addEventListener('input', function() {
        document.getElementById('recoveryRateValue').textContent = this.value;
    });
    
    document.getElementById('deathRate').addEventListener('input', function() {
        document.getElementById('deathRateValue').textContent = this.value;
    });
    
    document.getElementById('quarantineRate').addEventListener('input', function() {
        document.getElementById('quarantineRateValue').textContent = this.value;
    });
    
    document.getElementById('initialInfected').addEventListener('input', function() {
        document.getElementById('initialInfectedValue').textContent = this.value;
    });
    
    document.getElementById('socialDistancingBtn').addEventListener('click', async () => {
        if (!simulation.backendConnected) return;
        
        try {
            await fetch(`${API_BASE}/simulation/intervention`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'social_distancing', strength: 0.5 })
            });
            console.log('Social distancing applied');
        } catch (error) {
            console.error('Failed to apply intervention:', error);
        }
    });
    
    document.getElementById('lockdownBtn').addEventListener('click', async () => {
        if (!simulation.backendConnected) return;
        
        try {
            await fetch(`${API_BASE}/simulation/intervention`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'lockdown', strength: 0.3 })
            });
            console.log('Lockdown applied');
        } catch (error) {
            console.error('Failed to apply intervention:', error);
        }
    });
    
    document.getElementById('vaccinationBtn').addEventListener('click', async () => {
        if (!simulation.backendConnected) return;
        
        try {
            await fetch(`${API_BASE}/simulation/intervention`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'vaccination', strength: 0.2 })
            });
            console.log('Vaccination applied');
        } catch (error) {
            console.error('Failed to apply intervention:', error);
        }
    });
    
    startBtn.addEventListener('click', startSimulation);
    pauseBtn.addEventListener('click', stopSimulation);
    resetBtn.addEventListener('click', resetSimulation);
    
    async function initialize() {
        await checkBackendConnection();
        await loadNetwork();
        updateControls();
    }
    
    initialize();
});