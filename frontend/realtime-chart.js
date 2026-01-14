// Real-time chart for visualization
class RealtimeChart {
    constructor(containerId, maxDataPoints = 100) {
        this.container = document.getElementById(containerId);
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = 200;
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
        // Add new data point
        this.data.healthy.push(stats.healthy);
        this.data.infected.push(stats.infected);
        this.data.recovered.push(stats.recovered);
        this.data.quarantined.push(stats.quarantined || 0);
        this.data.deceased.push(stats.deceased || 0);
        this.data.timestamps.push(step);
        
        // Limit data points
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
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        if (this.data.timestamps.length === 0) return;
        
        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        // Vertical grid lines
        const xStep = chartWidth / 10;
        for (let i = 0; i <= 10; i++) {
            ctx.beginPath();
            ctx.moveTo(padding + i * xStep, padding);
            ctx.lineTo(padding + i * xStep, height - padding);
            ctx.stroke();
        }
        
        // Horizontal grid lines
        const yStep = chartHeight / 5;
        for (let i = 0; i <= 5; i++) {
            ctx.beginPath();
            ctx.moveTo(padding, padding + i * yStep);
            ctx.lineTo(width - padding, padding + i * yStep);
            ctx.stroke();
        }
        
        // Find max value for scaling
        const allData = [
            ...this.data.healthy,
            ...this.data.infected,
            ...this.data.recovered,
            ...this.data.quarantined,
            ...this.data.deceased
        ];
        const maxValue = Math.max(...allData);
        
        // Function to draw a data series
        const drawSeries = (data, color, label) => {
            if (data.length === 0) return;
            
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            for (let i = 0; i < data.length; i++) {
                const x = padding + (i / (this.data.timestamps.length - 1)) * chartWidth;
                const y = height - padding - (data[i] / maxValue) * chartHeight;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            
            // Draw data points
            for (let i = 0; i < data.length; i++) {
                const x = padding + (i / (this.data.timestamps.length - 1)) * chartWidth;
                const y = height - padding - (data[i] / maxValue) * chartHeight;
                
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Draw legend
            const legendX = width - 150;
            const legendY = 20 + Object.keys(this.colors).indexOf(label) * 20;
            
            ctx.fillStyle = color;
            ctx.fillRect(legendX, legendY, 15, 10);
            
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.fillText(label.charAt(0).toUpperCase() + label.slice(1), legendX + 20, legendY + 10);
        };
        
        // Draw each series
        drawSeries(this.data.healthy, this.colors.healthy, 'healthy');
        drawSeries(this.data.infected, this.colors.infected, 'infected');
        drawSeries(this.data.recovered, this.colors.recovered, 'recovered');
        drawSeries(this.data.quarantined, this.colors.quarantined, 'quarantined');
        drawSeries(this.data.deceased, this.colors.deceased, 'deceased');
        
        // Draw axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
        
        // Y-axis
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.stroke();
        
        // Draw labels
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        
        // X-axis labels (time steps)
        for (let i = 0; i < this.data.timestamps.length; i += Math.ceil(this.data.timestamps.length / 5)) {
            const x = padding + (i / (this.data.timestamps.length - 1)) * chartWidth;
            ctx.fillText(`Step ${this.data.timestamps[i]}`, x, height - padding + 20);
        }
        
        // Y-axis labels (count)
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const y = padding + i * (chartHeight / 5);
            const value = Math.round((maxValue * (5 - i)) / 5);
            ctx.fillText(value.toString(), padding - 5, y + 4);
        }
        
        // Title
        ctx.textAlign = 'center';
        ctx.font = '14px Arial';
        ctx.fillText('Disease Spread Over Time', width / 2, 20);
    }
}