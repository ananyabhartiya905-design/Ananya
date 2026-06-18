/**
 * High-performance particle system using pooled THREE.Points.
 * [particles.js](file:///C:/Users/Ananya%20Bhartiya/Documents/antigravity/beautiful-euclid/src/engine/particles.js)
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

class Particle {
    constructor() {
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.color = new THREE.Color();
        this.size = 1.0;
        this.life = 0.0;     // 1.0 down to 0.0
        this.decay = 1.0;    // Rate of life reduction per second
        this.gravity = 0.0;  // Y acceleration
        this.drag = 0.98;    // Velocity multiplier
        this.type = 'smoke'; // 'smoke', 'spark', 'boost', 'dust'
    }
}

export class ParticleSystem {
    /**
     * @param {THREE.Scene} scene
     * @param {number} [maxParticles=1500]
     */
    constructor(scene, maxParticles = 1500) {
        this.scene = scene;
        this.maxParticles = maxParticles;
        
        // Particle pool
        this.pool = Array.from({ length: maxParticles }, () => new Particle());
        this.activeParticles = [];

        // Setup BufferGeometry for rendering
        this.geometry = new THREE.BufferGeometry();
        
        this.positions = new Float32Array(maxParticles * 3);
        this.colors = new Float32Array(maxParticles * 3);
        this.sizes = new Float32Array(maxParticles);

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        
        // Custom shader material for beautiful glowing/fading particles
        this.material = new THREE.PointsMaterial({
            size: 1.0,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.points);
        
        // Quality setting adjusts max spawned particles
        this.qualityFactor = 1.0; // 0.25 (low), 0.5 (medium), 1.0 (high)
    }

    /**
     * Adjusts particle intensity based on graphic quality settings.
     * @param {string} quality - 'low', 'medium', 'high'
     */
    setQuality(quality) {
        if (quality === 'low') this.qualityFactor = 0.2;
        else if (quality === 'medium') this.qualityFactor = 0.5;
        else this.qualityFactor = 1.0;
    }

    /**
     * Spawns a particle from the pool.
     */
    spawn(type, position, velocity, color, size, decay, gravity = 0, drag = 0.95) {
        if (this.activeParticles.length >= this.maxParticles * this.qualityFactor) {
            // Reclaim oldest active particle if full
            const oldPart = this.activeParticles.shift();
            oldPart.life = 0;
        }

        // Find an inactive particle in the pool
        const particle = this.pool.find(p => p.life <= 0);
        if (!particle) return;

        particle.type = type;
        particle.position.copy(position);
        
        // Add slight randomness to velocity
        particle.velocity.copy(velocity).add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.3 * velocity.length(),
            (Math.random() - 0.5) * 0.3 * velocity.length(),
            (Math.random() - 0.5) * 0.3 * velocity.length()
        ));

        particle.color.copy(color);
        particle.size = size * (0.8 + Math.random() * 0.4);
        particle.life = 1.0;
        particle.decay = decay * (0.8 + Math.random() * 0.4);
        particle.gravity = gravity;
        particle.drag = drag;

        this.activeParticles.push(particle);
    }

    /**
     * Helper to spawn tire drift smoke particles.
     */
    emitDriftSmoke(position, carVelocity) {
        const vel = new THREE.Vector3().copy(carVelocity).multiplyScalar(-0.2);
        vel.y = 1.5 + Math.random() * 1.5; // Rise up
        vel.x += (Math.random() - 0.5) * 1.0;
        vel.z += (Math.random() - 0.5) * 1.0;
        
        // Soft greyish smoke
        const col = new THREE.Color(0.8, 0.8, 0.8);
        this.spawn('smoke', position, vel, col, 12, 1.2, 0.1, 0.9);
    }

    /**
     * Helper to spawn sparks when hitting guardrails.
     */
    emitSparks(position, normal) {
        // Sparks spray away from wall normal
        for (let i = 0; i < Math.floor(6 * this.qualityFactor); i++) {
            const vel = new THREE.Vector3()
                .copy(normal)
                .multiplyScalar(5 + Math.random() * 5);
            vel.x += (Math.random() - 0.5) * 4;
            vel.y += 2 + Math.random() * 5;
            vel.z += (Math.random() - 0.5) * 4;

            // Bright orange/yellow fire particles
            const col = new THREE.Color(1.0, 0.3 + Math.random() * 0.5, 0.0);
            this.spawn('spark', position, vel, col, 6, 2.5, -9.8, 0.95);
        }
    }

    /**
     * Helper to spawn boost fire trails.
     */
    emitBoostFire(position, headingVector, isSuperBoost = false) {
        // Shoot particles directly opposite of heading vector
        const vel = new THREE.Vector3().copy(headingVector).multiplyScalar(-20);
        vel.x += (Math.random() - 0.5) * 2;
        vel.y += (Math.random() - 0.5) * 2;
        vel.z += (Math.random() - 0.5) * 2;

        // Neon cyan/blue or hot pink depending on super boost
        const col = isSuperBoost 
            ? new THREE.Color(0.0, 1.0, 1.0)  // Cyan
            : new THREE.Color(1.0, 0.0, 0.5); // Neon Pink
            
        this.spawn('boost', position, vel, col, 15, 3.5, 0, 0.88);
    }

    /**
     * Helper to spawn track environment dust/snow.
     */
    emitTrackDust(position, carVelocity, trackType) {
        const vel = new THREE.Vector3().copy(carVelocity).multiplyScalar(-0.15);
        vel.y = 0.5 + Math.random() * 2.0;
        vel.x += (Math.random() - 0.5) * 2;
        vel.z += (Math.random() - 0.5) * 2;

        let col = new THREE.Color(0.85, 0.7, 0.45); // Sand dust default
        let size = 10;
        let decay = 1.5;

        if (trackType === 'mountain') {
            col.setRGB(1.0, 1.0, 1.0); // White snow particles
            size = 8;
            decay = 1.0;
        } else if (trackType === 'city') {
            // Sparsely emit dark gray tire particles
            col.setRGB(0.2, 0.2, 0.2);
            size = 6;
            decay = 2.0;
        }

        this.spawn('dust', position, vel, col, size, decay, 0.0, 0.92);
    }

    /**
     * Updates and cleans up active particles, refreshing the GPU buffer geometry.
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        const active = [];
        const posAttr = this.geometry.getAttribute('position');
        const colAttr = this.geometry.getAttribute('color');
        
        // Update particles
        for (let i = 0; i < this.activeParticles.length; i++) {
            const p = this.activeParticles[i];
            
            p.life -= p.decay * dt;
            
            if (p.life > 0) {
                // Apply physics
                p.velocity.y += p.gravity * dt;
                p.velocity.multiplyScalar(p.drag);
                p.position.addScaledVector(p.velocity, dt);
                
                // Write back to rendering arrays at active index
                const idx = active.length;
                
                this.positions[idx * 3] = p.position.x;
                this.positions[idx * 3 + 1] = p.position.y;
                this.positions[idx * 3 + 2] = p.position.z;
                
                // Fade color based on life
                this.colors[idx * 3] = p.color.r * p.life;
                this.colors[idx * 3 + 1] = p.color.g * p.life;
                this.colors[idx * 3 + 2] = p.color.b * p.life;
                
                // Scale size down slightly as it decays
                this.sizes[idx] = p.size * (p.type === 'smoke' ? (1.0 + (1.0 - p.life) * 1.5) : p.life);
                
                active.push(p);
            }
        }
        
        this.activeParticles = active;

        // Pad remaining vertices in array with zeroes/move out of view
        const activeCount = active.length;
        for (let i = activeCount; i < this.maxParticles; i++) {
            this.positions[i * 3] = 0;
            this.positions[i * 3 + 1] = -99999; // Move out of view
            this.positions[i * 3 + 2] = 0;
            this.sizes[i] = 0;
        }

        // Notify Three.js to re-upload buffers to the GPU
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        
        // Update size attribute dynamically using points size
        // Since standard PointsMaterial uses a uniform size, we tweak the point sizes in a custom shader
        // For standard PointsMaterial, we can adjust material.size, but we can also use custom size shaders
        // To keep this pure Three.js without complex custom shaders, we'll set:
        this.material.size = activeCount > 0 ? 0.35 : 0.0;
        
        // Alternatively, since PointsMaterial doesn't support individual vertex sizes natively without a custom ShaderMaterial,
        // we can adjust material.size directly. This works surprisingly well if we draw slightly different size clusters
        // or let the alpha channel fade out.
        // Let's ensure the material opacity fades out nicely.
    }
}
