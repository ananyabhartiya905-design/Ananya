/**
 * Arcade Car Physics and Collisions.
 * [physics.js](file:///C:/Users/Ananya%20Bhartiya/Documents/antigravity/beautiful-euclid/src/engine/physics.js)
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { projectOnTrack, lerpAngle } from '../utils/helpers.js';
import { audio } from './audio.js';

// Constants
const GRAVITY = 25.0;
const DRAG = 0.015;
const BOUNCE_RESTITUTION = 0.4;
const OFFROAD_SLOWDOWN = 0.4; // Multiplier on acceleration/speed when off-road

export function updateCarPhysics(car, input, track, dt, particles) {
    if (dt <= 0) return;
    if (dt > 0.1) dt = 0.1; // Cap dt to avoid huge steps on lag spikes

    const halfW = track.width / 2;
    const carRadius = car.mesh.userData.dimensions.radius * 0.6; // Bounding sphere radius

    // ----------------------------------------------------
    // 1. INPUT HANDLING (Acceleration, Braking, Steer)
    // ----------------------------------------------------
    let throttle = 0;
    let steering = 0;
    let wantsDrift = false;

    if (!car.isAI) {
        // Player Inputs
        if (input.forward) throttle = 1;
        if (input.backward) throttle = -1;
        if (input.left) steering = 1;
        if (input.right) steering = -1;
        if (input.drift) wantsDrift = true;
    } else {
        // AI Inputs (Calculated in AI autopilot section below)
        throttle = car.aiThrottle;
        steering = car.aiSteering;
        wantsDrift = car.aiDrift;
    }

    // Boost state
    if (car.boostTimer > 0) {
        car.boostTimer -= dt;
        if (car.boostTimer <= 0) {
            car.boostTimer = 0;
            if (!car.isAI) audio.setBoostActive(false);
        }
    }

    // ----------------------------------------------------
    // 2. DRIFT CONTROLLER (Mario-Kart style sliding)
    // ----------------------------------------------------
    const absSpeed = Math.abs(car.speed);
    
    // Can only drift if moving fast enough and steering
    const canDrift = absSpeed > 10.0 && steering !== 0;
    
    if (wantsDrift && canDrift && !car.isDrifting) {
        // Start drifting
        car.isDrifting = true;
        // Lock drift direction: turning left (-1) or right (1)
        car.driftDirection = steering > 0 ? 1 : -1;
    }

    // Cancel drift if steer key is released, speed drops, or drift key released
    if (car.isDrifting && (!wantsDrift || absSpeed < 6.0 || steering === 0)) {
        car.isDrifting = false;
        
        // If drift was long enough, reward with boost!
        if (car.driftTime > 0.8) {
            // Trigger boost
            car.boostCharge = 1.0; 
            if (!car.isAI) {
                // Flash HUD message
                const hudMsg = document.getElementById('hud-message');
                if (hudMsg) {
                    hudMsg.classList.remove('hidden');
                    hudMsg.innerText = "DRIFT BOOST READY!";
                    setTimeout(() => hudMsg.classList.add('hidden'), 1500);
                }
            }
        }
        car.driftTime = 0.0;
        car.driftDirection = 0;
        if (!car.isAI) audio.setDriftIntensity(0);
    }

    // ----------------------------------------------------
    // 3. SPEED & ACCELERATION PHYSICS
    // ----------------------------------------------------
    
    // Check if offroad (lateral distance from track center is larger than road width)
    const isOffroad = Math.abs(car.lastLatDist) > (halfW - 0.2);
    
    // Performance stats
    let maxSpeed = car.isAI ? 28.0 : 33.0; // AI slightly slower for playability
    let acceleration = car.isAI ? 10.0 : 13.0;
    let braking = 25.0;

    if (car.boostTimer > 0) {
        maxSpeed = car.isAI ? 38.0 : 45.0; // Boost speed boost
        acceleration *= 1.8;
    } else if (isOffroad) {
        maxSpeed *= 0.45; // Offroad penalty
        acceleration *= 0.3;
    }

    // Apply engine forces
    if (throttle > 0) {
        // Accelerate
        if (car.speed < maxSpeed) {
            car.speed += acceleration * throttle * dt;
        } else {
            // Drag deceleration if speed exceeds boost max
            car.speed -= 5.0 * dt;
        }
    } else if (throttle < 0) {
        // Brake / Reverse
        if (car.speed > 0) {
            car.speed -= braking * dt; // Strong braking
        } else if (car.speed > -10.0) {
            car.speed -= 8.0 * dt; // Slow reverse
        }
    } else {
        // Friction slowdown
        if (car.speed > 0) car.speed -= 8.0 * dt;
        else if (car.speed < 0) car.speed += 8.0 * dt;
        
        if (Math.abs(car.speed) < 0.2) car.speed = 0;
    }

    // Apply natural speed-dependent drag
    car.speed -= car.speed * DRAG * dt;

    // ----------------------------------------------------
    // 4. STEERING & YAW ROTATION PHYSICS
    // ----------------------------------------------------
    // Steering response scales with speed (can't steer when stopped)
    const steerResponsiveness = Math.min(1.0, absSpeed / 12.0) * (car.speed >= 0 ? 1 : -1);
    let targetSteerAngle = 0;

    if (car.isDrifting) {
        // In a drift, the steering locks into the slide direction
        // Drifting turns the car sharper
        targetSteerAngle = car.driftDirection * 1.55 * steerResponsiveness;
        car.driftTime += dt;
        
        // Spawn smoke particles at tires
        if (particles) {
            const leftExhaust = new THREE.Vector3(-0.6, 0.1, -1.2).applyMatrix4(car.mesh.matrixWorld);
            const rightExhaust = new THREE.Vector3(0.6, 0.1, -1.2).applyMatrix4(car.mesh.matrixWorld);
            particles.emitDriftSmoke(leftExhaust, car.velocity);
            particles.emitDriftSmoke(rightExhaust, car.velocity);
        }
        
        // Screech SFX intensity
        if (!car.isAI) {
            audio.setDriftIntensity(Math.min(1.0, car.driftTime * 0.7));
        }
    } else {
        // Normal steering
        targetSteerAngle = steering * 1.05 * steerResponsiveness;
    }

    // Interpolate current steer velocity to target smoothly
    car.yawVelocity = THREE.MathUtils.lerp(car.yawVelocity, targetSteerAngle, 10 * dt);
    car.yaw += car.yawVelocity * dt;

    // ----------------------------------------------------
    // 5. UPDATE VELOCITY VECTOR
    // ----------------------------------------------------
    // Yaw angles: 0 is forward along Z axis
    const headingX = Math.sin(car.yaw);
    const headingZ = Math.cos(car.yaw);

    if (car.isDrifting) {
        // Slip angle physics: velocity lags behind heading.
        // We calculate heading angle and velocity angle separately
        const velocityAngle = Math.atan2(car.velocity.x, car.velocity.z);
        // Interpolate velocity direction towards body heading, but slowly (creating side slip)
        const driftTargetAngle = car.yaw + car.driftDirection * 0.4; // outward angle slide
        
        const newAngle = lerpAngle(velocityAngle, driftTargetAngle, 3.5 * dt);
        
        car.velocity.set(
            Math.sin(newAngle) * car.speed,
            car.velocity.y,
            Math.cos(newAngle) * car.speed
        );
    } else {
        // Normal alignment: velocity aligns with heading directly
        car.velocity.set(headingX * car.speed, car.velocity.y, headingZ * car.speed);
    }

    // Apply offroad dust emission
    if (isOffroad && absSpeed > 3.0 && particles) {
        const leftExhaust = new THREE.Vector3(-0.6, 0.1, -1.2).applyMatrix4(car.mesh.matrixWorld);
        const rightExhaust = new THREE.Vector3(0.6, 0.1, -1.2).applyMatrix4(car.mesh.matrixWorld);
        particles.emitTrackDust(leftExhaust, car.velocity, track.type);
        particles.emitTrackDust(rightExhaust, car.velocity, track.type);
    }

    // Apply Boost effects
    if (car.boostTimer > 0 && particles) {
        const exhaust = new THREE.Vector3(0, 0.15, -1.95).applyMatrix4(car.mesh.matrixWorld);
        const direction = new THREE.Vector3(headingX, 0, headingZ);
        particles.emitBoostFire(exhaust, direction, car.boostTimer > 1.5);
    }

    // ----------------------------------------------------
    // 6. TRACK PROJECTION & ELEVATION SNAP / JUMPS
    // ----------------------------------------------------
    // Temporary position prediction
    const nextPos = new THREE.Vector3().copy(car.position).addScaledVector(car.velocity, dt);

    // Project car's predicted position onto track curve
    const proj = projectOnTrack(nextPos, track.curve, track.samples, car.lastT);
    
    // Save projection variables
    car.lastT = proj.t;
    car.lastLatDist = proj.lateralDistance;
    car.lastProjectedPoint.copy(proj.point);
    car.lastTangent.copy(proj.tangent);
    car.lastNormal.copy(proj.normal);

    const roadY = proj.point.y;

    if (car.isAirborne) {
        // Under gravity acceleration
        car.verticalVelocity -= GRAVITY * dt;
        car.position.y += car.verticalVelocity * dt;

        // Check landing condition
        if (car.position.y <= roadY + 0.1) {
            car.position.y = roadY;
            car.isAirborne = false;
            
            // Impact penalty based on falling speed
            const landingImpact = Math.abs(car.verticalVelocity) / 20.0;
            car.verticalVelocity = 0.0;
            
            // Landing bounce / particle spark
            if (landingImpact > 0.2) {
                audio.playCrash(Math.min(1.0, landingImpact));
                if (particles) {
                    particles.emitSparks(car.position, new THREE.Vector3(0, 1, 0));
                }
                // Minor speed loss on rough landing
                car.speed *= (1.0 - Math.min(0.3, landingImpact * 0.5));
            }
        }
        
        // Keep moving on XZ plane
        car.position.x += car.velocity.x * dt;
        car.position.z += car.velocity.z * dt;
    } else {
        // Snapped to road surface
        // If elevation drops suddenly (e.g. going off a ramp), launch airborne!
        const heightDifference = car.position.y - roadY;
        
        // Ramp jump launcher check:
        // If we are moving forward fast and road drops below us, become airborne
        if (heightDifference > 0.3 && car.speed > 15.0) {
            car.isAirborne = true;
            // Vertical velocity matches the upward velocity from ramp
            car.verticalVelocity = car.velocity.y; 
        } else {
            // normal ground snapping
            car.position.x = nextPos.x;
            car.position.z = nextPos.z;
            
            // Snaps y to road height (with smooth slope transitions)
            car.position.y = THREE.MathUtils.lerp(car.position.y, roadY, 15 * dt);
        }
    }

    // ----------------------------------------------------
    // 7. GUARDRAIL WALL COLLISIONS
    // ----------------------------------------------------
    // Bounding guardrail radius
    const trackLimit = halfW - carRadius;

    if (Math.abs(car.lastLatDist) > trackLimit) {
        // COLLISION RESPOND! Push back inside boundaries
        const pushDir = Math.sign(car.lastLatDist);
        car.position.copy(proj.point).addScaledVector(proj.normal, pushDir * trackLimit);
        car.position.y = proj.point.y; // Match height at edge

        // Break velocities down into parallel (tangent) and perpendicular (normal) to track
        const vTang = car.velocity.dot(proj.tangent);
        const vNorm = car.velocity.dot(proj.normal);

        // Check if moving outwards into wall
        if (Math.sign(vNorm) === pushDir) {
            // Bounce: Reverse the normal speed components
            const revNorm = -vNorm * BOUNCE_RESTITUTION;
            
            // Wall scraping friction penalty
            car.speed = Math.max(0, car.speed * 0.72);
            
            // Recompute velocity vector
            car.velocity.copy(proj.tangent).multiplyScalar(vTang).addScaledVector(proj.normal, revNorm);
            
            // Trigger crash SFX and spark emitters
            const wallScrapeIntensity = Math.min(1.0, absSpeed / 25.0);
            if (wallScrapeIntensity > 0.15) {
                audio.playCrash(wallScrapeIntensity * 0.7);
                if (particles) {
                    const sparkLoc = new THREE.Vector3().copy(car.position).addScaledVector(proj.normal, pushDir * carRadius);
                    particles.emitSparks(sparkLoc, proj.normal.clone().multiplyScalar(-pushDir));
                }
            }
        }
    }

    // ----------------------------------------------------
    // 8. CHECKPOINT / LAP TICK CONTROLLER
    // ----------------------------------------------------
    // Divide track into 4 checkpoints to prevent cheating by going backwards
    const numCheckpoints = 4;
    const checkpointRange = 1.0 / numCheckpoints;
    const currentCheckpoint = Math.floor(car.lastT / checkpointRange);

    if (currentCheckpoint === (car.checkpoint + 1) % numCheckpoints) {
        // Pass checkpoint sequentially
        car.checkpoint = currentCheckpoint;
    } else if (car.checkpoint === numCheckpoints - 1 && currentCheckpoint === 0) {
        // Crossing Start/Finish line!
        car.currentLap++;
        car.checkpoint = 0;
        
        // Log lap completion message
        if (!car.isAI) {
            const hudMsg = document.getElementById('hud-message');
            if (hudMsg) {
                hudMsg.classList.remove('hidden');
                hudMsg.innerText = `LAP ${car.currentLap} / ${track.laps}`;
                setTimeout(() => hudMsg.classList.add('hidden'), 2000);
            }
        }
    }

    // Cumulative lap progress score (used for placement rankings)
    car.lapProgress = car.currentLap + car.lastT;

    // ----------------------------------------------------
    // 9. AI AUTOPILOT NAVIGATION
    // ----------------------------------------------------
    if (car.isAI) {
        // AI lookahead distance depends on speed (look further ahead when driving faster)
        const lookAheadFactor = 0.04 + (absSpeed / 45.0) * 0.04;
        let aiTTarget = car.lastT + lookAheadFactor;
        if (aiTTarget > 1.0) aiTTarget -= 1.0;

        const aiTargetPt = track.curve.getPointAt(aiTTarget);
        
        // Vector to target point
        const toTarget = new THREE.Vector3().subVectors(aiTargetPt, car.position);
        
        // Get target angle in XZ plane
        const targetYaw = Math.atan2(toTarget.x, toTarget.z);
        
        // Calculate steering angle needed (difference in angles)
        let angleDiff = targetYaw - car.yaw;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

        // Steering input between -1 and 1
        car.aiSteering = THREE.MathUtils.clamp(angleDiff * 4.0, -1, 1);

        // Curvature calculation: check angle differences between look-ahead points
        let curvatureLookAhead = car.lastT + 0.12;
        if (curvatureLookAhead > 1.0) curvatureLookAhead -= 1.0;
        const curPt = track.curve.getPointAt(curvatureLookAhead);
        const futureVector = new THREE.Vector3().subVectors(curPt, car.position);
        const futureYaw = Math.atan2(futureVector.x, futureVector.z);
        
        let curveDiff = Math.abs(futureYaw - car.yaw);
        while (curveDiff > Math.PI) curveDiff = Math.PI * 2 - curveDiff;

        // AI Target speed: slower for tight curves, fast on straights
        const maxCurveAngle = Math.PI / 4; // 45 degrees curve
        const curveRatio = Math.min(1.0, curveDiff / maxCurveAngle);
        
        const aiTargetSpeed = maxSpeed * (1.0 - curveRatio * 0.35); // Slow down up to 35% on corners

        // Throttle input to match target speed
        if (car.speed < aiTargetSpeed) {
            car.aiThrottle = 1.0;
        } else {
            car.aiThrottle = 0.0; // Coasting
        }

        // AI Drifting: turn on sharp corners
        if (curveRatio > 0.4 && absSpeed > 14.0 && Math.random() > 0.6) {
            car.aiDrift = true;
        } else {
            car.aiDrift = false;
        }

        // Randomly trigger Boost if they have it and are on straights
        if (car.boostCharge >= 1.0 && curveRatio < 0.15 && Math.random() > 0.98) {
            car.boostCharge = 0;
            car.boostTimer = 2.0; // 2 seconds boost
        }
    }
}

/**
 * Checks and resolves car-to-car elastic bumper collisions.
 * @param {Array<Object>} cars - Array of all car objects
 * @param {number} dt
 * @param {ParticleSystem} particles
 */
export function resolveCarCollisions(cars, dt, particles) {
    const len = cars.length;
    for (let i = 0; i < len; i++) {
        const carA = cars[i];
        const radA = carA.mesh.userData.dimensions.radius * 0.4; // Slightly tighter collision circle
        
        for (let j = i + 1; j < len; j++) {
            const carB = cars[j];
            const radB = carB.mesh.userData.dimensions.radius * 0.4;
            
            // XZ distance (flat plane collision is safer)
            const dx = carB.position.x - carA.position.x;
            const dz = carB.position.z - carA.position.z;
            const distSq = dx * dx + dz * dz;
            const minDist = radA + radB;
            const minDistSq = minDist * minDist;

            if (distSq < minDistSq) {
                // COLLISION DETECTED!
                const dist = Math.sqrt(distSq);
                const overlap = minDist - dist;
                
                // Normal direction pointing from A to B
                const nx = dx / (dist || 1);
                const nz = dz / (dist || 1);
                
                // 1. Resolve overlap (push cars apart equally)
                carA.position.x -= nx * overlap * 0.5;
                carA.position.z -= nz * overlap * 0.5;
                
                carB.position.x += nx * overlap * 0.5;
                carB.position.z += nz * overlap * 0.5;

                // 2. Exchange momentum (elastic crash reflection along axis)
                // Project velocities onto collision normal
                const velNormalA = carA.velocity.x * nx + carA.velocity.z * nz;
                const velNormalB = carB.velocity.x * nx + carB.velocity.z * nz;

                // If moving towards each other, swap velocities
                if (velNormalA - velNormalB > 0) {
                    const restitution = 0.75;
                    const swapVal = (velNormalA - velNormalB) * restitution;
                    
                    // Subtract normal components
                    carA.velocity.x -= nx * swapVal;
                    carA.velocity.z -= nz * swapVal;
                    
                    carB.velocity.x += nx * swapVal;
                    carB.velocity.z += nz * swapVal;

                    // Adjust speeds
                    carA.speed = carA.velocity.dot(new THREE.Vector3(Math.sin(carA.yaw), 0, Math.cos(carA.yaw)));
                    carB.speed = carB.velocity.dot(new THREE.Vector3(Math.sin(carB.yaw), 0, Math.cos(carB.yaw)));

                    // Spasm crash sounds and particles
                    const impactScale = Math.min(1.0, Math.abs(velNormalA - velNormalB) / 25.0);
                    if (impactScale > 0.1) {
                        audio.playCrash(impactScale);
                        
                        if (particles) {
                            const crashPt = new THREE.Vector3()
                                .copy(carA.position)
                                .addScaledVector(new THREE.Vector3(nx, 0, nz), radA);
                            particles.emitSparks(crashPt, new THREE.Vector3(nx, 0, nz));
                        }
                    }
                }
            }
        }
    }
}
