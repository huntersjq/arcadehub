import { Game, Vector } from '../shared/engine.js';

class PhysicsMerger extends Game {
    constructor() {
        super('gameCanvas');
        this.score = 0;
        this.gravity = 0.5;
        this.entities = [];
        this.nextType = this.getRandomType();
        this.setup();
    }

    setup() {
        console.log("Physics Merger Initialized");
        // Initial state
    }

    getRandomType() {
        return Math.floor(Math.random() * 5) + 1;
    }

    update(dt) {
        // Handle input - click to drop
        if (this.input.mouse.isDown) {
            // Drop logic
        }

        // Simple physics integration
        this.entities.forEach(ent => {
            ent.velocity.y += this.gravity;
            ent.position.add(ent.velocity);
            
            // Basic floor collision
            if (ent.position.y + ent.radius > this.height) {
                ent.position.y = this.height - ent.radius;
                ent.velocity.y *= -0.4; // Bounce
            }
        });
    }

    draw() {
        const ctx = this.ctx;
        
        // Background Gradient
        const grad = ctx.createRadialGradient(
            this.width/2, this.height/2, 0,
            this.width/2, this.height/2, this.width
        );
        grad.addColorStop(0, '#1a1a2e');
        grad.addColorStop(1, '#0a0a12');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        // Draw entities
        this.entities.forEach(ent => {
            ctx.beginPath();
            ctx.arc(ent.position.x, ent.position.y, ent.radius, 0, Math.PI * 2);
            ctx.fillStyle = ent.color;
            ctx.fill();
            ctx.closePath();
        });
    }
}

const game = new PhysicsMerger();
game.start();
