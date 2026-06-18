/**
 * Main game coordinator and loop engine.
 * [main.js](file:///C:/Users/Ananya%20Bhartiya/Documents/antigravity/beautiful-euclid/src/main.js)
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { createCarModel } from './world/car.js';
import { tracks } from './world/track.js';
import { updateCarPhysics, resolveCarCollisions } from './engine/physics.js';
import { ParticleSystem } from './engine/particles.js';
import { audio } from './engine/audio.js';

// Game States
const STATES = {
    MENU: 'menu',
    COUNTDOWN: 'countdown',
    RACING: 'racing',
    PAUSED: 'paused',
    GAMEOVER: 'gameover'
};

class Game {
    constructor() {
        this.state = STATES.MENU;
        this.clock = new THREE.Clock();
        this.particleSystem = null;
        
        // Settings
        this.activeTrackIndex = 0;
        this.playerColor = '#ff3b30'; // Red default
        this.shadowsEnabled = true;
        
        // Race Data
        this.cars = [];
        this.playerCar = null;
        
        // Time tracking
        this.raceTimer = 0.0;
        this.lapTimes = [];
        this.currentLapStartTime = 0.0;
        this.bestLapTime = Infinity;
        
        // Game Modes
        this.gameMode = 'quick'; // 'quick', 'trial', 'championship'
        this.championshipActive = false;
        this.championshipTrackIndex = 0;
        this.championshipPoints = [0, 0, 0, 0, 0]; // Player, AI1, AI2, AI3, AI4
        
        // Inputs
        this.keys = { forward: false, backward: false, left: false, right: false, drift: false };
        
        // Camera Views
        // 0: Third Person Chase (Close), 1: Third Person Chase (Far), 2: First Person Bumper
        this.cameraViewIndex = 0;
        this.cameraChaseLag = 0.12;

        this.initThree();
        this.initUI();
        this.bindEvents();
        this.animate();
    }

    /**
     * Set up the core Three.js rendering stack
     */
    initThree() {
        const container = document.getElementById('canvas-container');
        
        // 1. Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = this.shadowsEnabled;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        container.appendChild(this.renderer.domElement);

        // 2. Scene
        this.scene = new THREE.Scene();

        // 3. Camera
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 10, 20);

        // 4. Lights
        this.ambientLight = new THREE.HemisphereLight(0xffffff, 0x444455, 0.5);
        this.scene.add(this.ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.dirLight.position.set(50, 100, 50);
        this.dirLight.castShadow = this.shadowsEnabled;
        this.dirLight.shadow.camera.top = 150;
        this.dirLight.shadow.camera.bottom = -150;
        this.dirLight.shadow.camera.left = -150;
        this.dirLight.shadow.camera.right = 150;
        this.dirLight.shadow.camera.near = 0.1;
        this.dirLight.shadow.camera.far = 400;
        this.dirLight.shadow.mapSize.width = 1024;
        this.dirLight.shadow.mapSize.height = 1024;
        this.scene.add(this.dirLight);

        // Particle System
        this.particleSystem = new ParticleSystem(this.scene);
    }

    /**
     * Setup user interfaces and selection values
     */
    initUI() {
        // Hide scrollbars on body
        document.body.style.overflow = 'hidden';
    }

    /**
     * Bind button clicks, inputs, and browser events
     */
    bindEvents() {
        // Window Resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Key Listeners
        window.addEventListener('keydown', (e) => this.handleKey(e, true));
        window.addEventListener('keyup', (e) => this.handleKey(e, false));

        // UI Buttons - Main Menu
        document.getElementById('btn-quick-race').addEventListener('click', () => {
            audio.init();
            this.gameMode = 'quick';
            this.championshipActive = false;
            this.startRaceCountdown();
        });
        
        document.getElementById('btn-time-trial').addEventListener('click', () => {
            audio.init();
            this.gameMode = 'trial';
            this.championshipActive = false;
            this.startRaceCountdown();
        });

        document.getElementById('btn-championship').addEventListener('click', () => {
            audio.init();
            this.gameMode = 'championship';
            this.championshipActive = true;
            this.championshipTrackIndex = 0;
            this.championshipPoints = [0, 0, 0, 0, 0];
            this.activeTrackIndex = 0;
            this.startRaceCountdown();
        });

        document.getElementById('btn-settings').addEventListener('click', () => {
            document.getElementById('settings-panel').classList.remove('hidden');
        });
        
        document.getElementById('btn-pause-settings').addEventListener('click', () => {
            document.getElementById('settings-panel').classList.remove('hidden');
        });

        // Track selector cards
        const trackCards = document.querySelectorAll('.track-card');
        trackCards.forEach(card => {
            card.addEventListener('click', (e) => {
                trackCards.forEach(c => c.classList.remove('active'));
                const targetCard = e.currentTarget;
                targetCard.classList.add('active');
                this.activeTrackIndex = parseInt(targetCard.getAttribute('data-track'));
                
                // Show ambient theme update on background immediately
                this.loadTrackBackground();
            });
        });

        // Car customizer colors
        const colorDots = document.querySelectorAll('.color-dot');
        colorDots.forEach(dot => {
            dot.addEventListener('click', (e) => {
                colorDots.forEach(d => d.classList.remove('active'));
                const target = e.currentTarget;
                target.classList.add('active');
                this.playerColor = target.getAttribute('data-color');
            });
        });

        // Settings BACK Button
        document.getElementById('btn-settings-back').addEventListener('click', () => {
            document.getElementById('settings-panel').classList.add('hidden');
        });

        // Pause Menu actions
        document.getElementById('btn-resume').addEventListener('click', () => this.resumeGame());
        document.getElementById('btn-restart').addEventListener('click', () => this.restartRace());
        document.getElementById('btn-exit').addEventListener('click', () => this.exitToMenu());

        // Game Over buttons
        document.getElementById('btn-retry').addEventListener('click', () => this.restartRace());
        document.getElementById('btn-game-over-menu').addEventListener('click', () => this.exitToMenu());
        document.getElementById('btn-next-race').addEventListener('click', () => {
            this.championshipTrackIndex++;
            this.activeTrackIndex = this.championshipTrackIndex;
            this.startRaceCountdown();
        });

        // Settings sliders
        const volMusic = document.getElementById('vol-music');
        const volSFX = document.getElementById('vol-sfx');
        const gfxShadows = document.getElementById('gfx-shadows');
        const gfxParticles = document.getElementById('gfx-particles');

        volMusic.addEventListener('input', (e) => {
            audio.setMusicVolume(parseFloat(e.target.value) / 100);
        });
        
        volSFX.addEventListener('input', (e) => {
            audio.setSFXVolume(parseFloat(e.target.value) / 100);
        });

        gfxShadows.addEventListener('change', (e) => {
            this.shadowsEnabled = e.target.checked;
            this.renderer.shadowMap.enabled = this.shadowsEnabled;
            this.dirLight.castShadow = this.shadowsEnabled;
            // Recompile materials
            this.scene.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = this.shadowsEnabled;
                    child.receiveShadow = this.shadowsEnabled;
                    if (child.material) child.material.needsUpdate = true;
                }
            });
        });

        gfxParticles.addEventListener('change', (e) => {
            this.particleSystem.setQuality(e.target.value);
        });

        // Load background theme initially
        this.loadTrackBackground();
    }

    /**
     * Handles keyboard controls
     */
    handleKey(e, isPressed) {
        // Toggle pauses with Escape or P key
        if (isPressed && (e.code === 'Escape' || e.code === 'KeyP')) {
            if (this.state === STATES.RACING) {
                this.pauseGame();
            } else if (this.state === STATES.PAUSED) {
                this.resumeGame();
            }
            return;
        }

        // Camera view toggle with V key
        if (isPressed && e.code === 'KeyV' && (this.state === STATES.RACING || this.state === STATES.COUNTDOWN)) {
            this.cameraViewIndex = (this.cameraViewIndex + 1) % 3;
            return;
        }

        // Driving Inputs
        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.keys.forward = isPressed;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keys.backward = isPressed;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.keys.left = isPressed;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keys.right = isPressed;
                break;
            case 'Space':
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.drift = isPressed;
                
                // Manual activation of Boost charge
                if (isPressed && this.playerCar && this.playerCar.boostCharge >= 1.0 && this.state === STATES.RACING) {
                    this.playerCar.boostCharge = 0.0;
                    this.playerCar.boostTimer = 2.0; // 2 seconds boost
                    audio.setBoostActive(true);
                }
                break;
        }
    }

    /**
     * Updates fog and ambient background scene colors based on active track selection
     */
    loadTrackBackground() {
        const track = tracks[this.activeTrackIndex];
        this.scene.background = new THREE.Color(track.config.skyColor);
        this.scene.fog = new THREE.FogExp2(track.config.fogColor, track.config.fogDensity);
        
        // Update directional light intensity / color
        if (track.type === 'city') {
            this.dirLight.intensity = 0.25; // Dark night
            this.ambientLight.color.setHex(0x333355);
            this.dirLight.color.setHex(0x00f0ff); // Neon sky light
        } else if (track.type === 'desert') {
            this.dirLight.intensity = 1.4; // Sun-baked
            this.ambientLight.color.setHex(0xffebcc);
            this.dirLight.color.setHex(0xffeaad);
        } else { // Mountain
            this.dirLight.intensity = 1.0; // White snowy bounce
            this.ambientLight.color.setHex(0xeef5fa);
            this.dirLight.color.setHex(0xffffff);
        }
    }

    /**
     * Start the countdown sequence before the race starts
     */
    startRaceCountdown() {
        this.state = STATES.COUNTDOWN;
        this.raceTimer = 0.0;
        this.lapTimes = [];
        this.currentLapStartTime = 0.0;
        this.bestLapTime = Infinity;

        // Hide menus, show HUD
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('pause-menu').classList.add('hidden');
        document.getElementById('game-over').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');

        // Load Track
        const track = tracks[this.activeTrackIndex];
        track.build(this.scene);
        this.loadTrackBackground();

        // Spawn Cars
        this.spawnCars(track);

        // Setup Countdown UI
        const cdOverlay = document.getElementById('countdown');
        const cdText = document.getElementById('countdown-text');
        cdOverlay.classList.remove('hidden');
        
        let count = 3;
        cdText.innerText = count;
        audio.playCountdownBeep(false);

        const countdownInterval = setInterval(() => {
            count--;
            if (count > 0) {
                cdText.innerText = count;
                audio.playCountdownBeep(false);
            } else if (count === 0) {
                cdText.innerText = 'GO!';
                audio.playCountdownBeep(true);
                
                // Release cars to start racing!
                this.state = STATES.RACING;
                this.clock.getDelta(); // Reset clock
                audio.startMusic();
            } else {
                clearInterval(countdownInterval);
                cdOverlay.classList.add('hidden');
            }
        }, 1000);
    }

    /**
     * Pre-allocates and places Player and AI vehicles on grid starts
     */
    spawnCars(track) {
        // Cleanup old cars from scene
        this.cars.forEach(car => {
            this.scene.remove(car.mesh);
            car.mesh.traverse(child => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
        });
        this.cars = [];

        // 1. CREATE PLAYER CAR
        const pModel = createCarModel(this.playerColor, track.type === 'city'); // Add headlights on night city
        this.scene.add(pModel);

        this.playerCar = {
            isAI: false,
            mesh: pModel,
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            speed: 0.0,
            yaw: 0.0,
            yawVelocity: 0.0,
            boostCharge: 0.0,
            boostTimer: 0.0,
            isDrifting: false,
            driftTime: 0.0,
            driftDirection: 0,
            isAirborne: false,
            verticalVelocity: 0.0,
            lastT: 0.0,
            lastLatDist: 0.0,
            currentLap: 1,
            checkpoint: 0,
            lapProgress: 1.0,
            rank: 1,
            // Cache helper structures
            lastProjectedPoint: new THREE.Vector3(),
            lastTangent: new THREE.Vector3(),
            lastNormal: new THREE.Vector3()
        };
        this.cars.push(this.playerCar);

        // 2. CREATE AI CARS (Skip in Time Trial)
        const numAI = this.gameMode === 'trial' ? 0 : 4;
        const aiColors = ['#007aff', '#ffcc00', '#af52de', '#34c759']; // Blue, Yellow, Purple, Green
        const aiNames = ['CHALLENGER X', 'SPEED DEMON', 'VECTOR ONE', 'APEX RIDER'];

        for (let i = 0; i < numAI; i++) {
            const aiModel = createCarModel(aiColors[i], false);
            this.scene.add(aiModel);

            const aiCar = {
                isAI: true,
                name: aiNames[i],
                color: aiColors[i],
                mesh: aiModel,
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                speed: 0.0,
                yaw: 0.0,
                yawVelocity: 0.0,
                boostCharge: 0.0,
                boostTimer: 0.0,
                isDrifting: false,
                driftTime: 0.0,
                driftDirection: 0,
                isAirborne: false,
                verticalVelocity: 0.0,
                lastT: 0.0,
                lastLatDist: 0.0,
                currentLap: 1,
                checkpoint: 0,
                lapProgress: 1.0,
                rank: i + 2,
                // AI behavior attributes
                aiThrottle: 0.0,
                aiSteering: 0.0,
                aiDrift: false,
                // Cache helper structures
                lastProjectedPoint: new THREE.Vector3(),
                lastTangent: new THREE.Vector3(),
                lastNormal: new THREE.Vector3()
            };
            this.cars.push(aiCar);
        }

        // 3. POSITION CARS ON GRID (Start line t = 0)
        // Position player in center, AIs stacked behind
        const w = track.width;
        
        this.cars.forEach((car, index) => {
            // Stack cars at slightly back progress parameters (-0.005, -0.010, etc.)
            // Wraps correctly as spline parameter spans 0 to 1
            let startT = 0.0 - index * 0.008;
            if (startT < 0) startT += 1.0;
            
            // Get position on curve
            const pt = track.curve.getPointAt(startT);
            const tangent = track.curve.getTangentAt(startT).normalize();
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

            // Alternate left and right side offsets on track lane grid
            const side = index === 0 ? 0 : (index % 2 === 0 ? 1 : -1);
            const sideOffset = side * (w * 0.23); // Offset lateral lanes

            car.position.copy(pt).addScaledVector(normal, sideOffset);
            car.position.y += 0.5; // Slight drop room
            
            car.yaw = Math.atan2(tangent.x, tangent.z);
            car.mesh.position.copy(car.position);
            car.mesh.rotation.y = car.yaw;
            car.lastT = startT;
            car.lastLatDist = sideOffset;
        });
    }

    /**
     * Pauses the game loop
     */
    pauseGame() {
        this.state = STATES.PAUSED;
        document.getElementById('pause-menu').classList.remove('hidden');
        audio.stopMusic();
    }

    /**
     * Resumes the game loop
     */
    resumeGame() {
        this.state = STATES.RACING;
        document.getElementById('pause-menu').classList.add('hidden');
        document.getElementById('settings-panel').classList.add('hidden');
        this.clock.getDelta(); // Reset clock
        audio.resume();
        audio.startMusic();
    }

    /**
     * Instantly restarts the current race
     */
    restartRace() {
        this.startRaceCountdown();
    }

    /**
     * Exits race to main menu screen
     */
    exitToMenu() {
        this.state = STATES.MENU;
        audio.stopMusic();
        audio.setDriftIntensity(0);
        audio.setBoostActive(false);

        document.getElementById('hud').classList.add('hidden');
        document.getElementById('pause-menu').classList.add('hidden');
        document.getElementById('settings-panel').classList.add('hidden');
        document.getElementById('game-over').classList.add('hidden');
        document.getElementById('main-menu').classList.remove('hidden');

        // Clear scene props and cars
        const track = tracks[this.activeTrackIndex];
        track.cleanup(this.scene);
        
        this.cars.forEach(car => this.scene.remove(car.mesh));
        this.cars = [];
        this.playerCar = null;

        // Reset camera positions
        this.camera.position.set(0, 10, 20);
        this.camera.lookAt(0, 0, 0);
    }

    /**
     * Computes real-time positions of cars along the track
     */
    updateLeaderboardRankings() {
        // Sort cars by cumulative progress (higher lapProgress = further along track)
        // Since closed curves wrap at t=1, lapProgress handles lap ticks nicely
        const rankedCars = [...this.cars].sort((a, b) => b.lapProgress - a.lapProgress);
        
        rankedCars.forEach((car, index) => {
            car.rank = index + 1;
        });

        // Set player HUD position
        if (this.playerCar) {
            const totalRankCount = this.gameMode === 'trial' ? 1 : this.cars.length;
            
            const suffixes = ["th", "st", "nd", "rd", "th", "th"];
            let suffix = suffixes[this.playerCar.rank] || "th";
            if (this.playerCar.rank >= 11 && this.playerCar.rank <= 13) suffix = "th"; // 11th, 12th, 13th exception
            
            document.getElementById('hud-position').innerHTML = `${this.playerCar.rank}<span class="sub-value">/${totalRankCount}</span>`;
            document.getElementById('hud-lap').innerHTML = `${Math.min(tracks[this.activeTrackIndex].laps, this.playerCar.currentLap)}<span class="sub-value">/${tracks[this.activeTrackIndex].laps}</span>`;
        }
    }

    /**
     * Handles race finishing logic when player completes all laps
     */
    finishRace() {
        this.state = STATES.GAMEOVER;
        audio.stopMusic();
        audio.setDriftIntensity(0);
        audio.setBoostActive(false);

        const track = tracks[this.activeTrackIndex];
        const finishPosition = this.playerCar.rank;

        // Update UI panels
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('game-over').classList.remove('hidden');
        
        document.getElementById('result-position').innerText = 
            finishPosition === 1 ? "1st 🏆" : (finishPosition === 2 ? "2nd" : (finishPosition === 3 ? "3rd" : `${finishPosition}th`));
        
        // Calculate times
        const totalFormatted = this.formatTime(this.raceTimer);
        document.getElementById('result-total-time').innerText = totalFormatted;
        
        const bestFormatted = this.bestLapTime === Infinity ? "--:--" : this.formatTime(this.bestLapTime);
        document.getElementById('result-best-lap').innerText = bestFormatted;

        // Populate Leaderboard list
        const leaderboardBody = document.getElementById('leaderboard-body');
        leaderboardBody.innerHTML = '';

        // Championship points reward list: 1st=10pts, 2nd=8pts, 3rd=6pts, 4th=4pts, 5th=2pts
        const ptRewards = [10, 8, 6, 4, 2];

        // Sort race results
        const sortedResults = [...this.cars].sort((a, b) => b.lapProgress - a.lapProgress);

        if (this.championshipActive) {
            // Apply points
            sortedResults.forEach((car, index) => {
                const pts = ptRewards[index] || 0;
                if (!car.isAI) {
                    this.championshipPoints[0] += pts;
                } else {
                    // Match AI index to points array
                    // AI cars created sequentially, so mapping is 1 + index
                    const aiIdx = this.cars.indexOf(car);
                    this.championshipPoints[aiIdx] += pts;
                }
            });

            // Display Championship points standings
            document.getElementById('race-result-title').innerText = "CHAMPIONSHIP STANDINGS";
            
            // Build table sorted by championship points accumulated
            const scoreBoard = this.cars.map((car, idx) => {
                return {
                    name: car.isAI ? car.name : "YOU",
                    pts: this.championshipPoints[idx],
                    isPlayer: !car.isAI
                };
            }).sort((a, b) => b.pts - a.pts);

            scoreBoard.forEach((item, index) => {
                const tr = document.createElement('tr');
                if (item.isPlayer) tr.className = 'highlight';
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td style="text-align: left;">${item.name}</td>
                    <td style="text-align: right; font-weight: bold;">${item.pts} PTS</td>
                `;
                leaderboardBody.appendChild(tr);
            });

            // If more tracks are remaining in Championship
            if (this.championshipTrackIndex < 2) {
                document.getElementById('btn-next-race').classList.remove('hidden');
                document.getElementById('btn-retry').classList.add('hidden');
            } else {
                // Championship ended! Show Cup results
                document.getElementById('btn-next-race').classList.add('hidden');
                document.getElementById('btn-retry').classList.remove('hidden');
                
                const finalWinner = scoreBoard[0];
                document.getElementById('championship-cup').classList.remove('hidden');
                document.getElementById('championship-standing').innerText = 
                    finalWinner.isPlayer 
                        ? "🏆 YOU WON THE CHAMPIONSHIP CUP! 🏆" 
                        : `🏆 ${finalWinner.name} WON THE CHAMPIONSHIP CUP 🏆`;
            }
        } else {
            // Quick Race / Time Trial
            document.getElementById('race-result-title').innerText = "RACE RESULTS";
            document.getElementById('championship-cup').classList.add('hidden');
            document.getElementById('btn-next-race').classList.add('hidden');
            document.getElementById('btn-retry').classList.remove('hidden');

            sortedResults.forEach((car, index) => {
                const tr = document.createElement('tr');
                if (!car.isAI) tr.className = 'highlight';
                else tr.className = 'highlight-ai';
                
                // Construct fake times for AI based on spacing
                let displayTime = "--:--";
                if (index === 0) {
                    displayTime = this.formatTime(this.raceTimer);
                } else {
                    const progressDiff = sortedResults[0].lapProgress - car.lapProgress;
                    const timeGap = progressDiff * 35.0; // 35 seconds per full lap progress difference
                    displayTime = `+${timeGap.toFixed(2)}s`;
                }

                if (this.gameMode === 'trial') {
                    // Only player in time trial
                    if (!car.isAI) {
                        tr.innerHTML = `
                            <td>1</td>
                            <td style="text-align: left;">YOU (BEST TIME)</td>
                            <td style="text-align: right; font-family: var(--font-hud);">${bestFormatted}</td>
                        `;
                        leaderboardBody.appendChild(tr);
                    }
                } else {
                    tr.innerHTML = `
                        <td>${index + 1}</td>
                        <td style="text-align: left;">${car.isAI ? car.name : "YOU"}</td>
                        <td style="text-align: right; font-family: var(--font-hud);">${displayTime}</td>
                    `;
                    leaderboardBody.appendChild(tr);
                }
            });
        }
    }

    /**
     * Converts seconds float to mm:ss.cc format string
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const hundredths = Math.floor((seconds % 1) * 100);
        
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
    }

    /**
     * Updates the HUD 2D Canvas Minimap
     */
    updateMinimap() {
        const canvas = document.getElementById('minimap');
        const ctx = canvas.getContext('2d');
        const track = tracks[this.activeTrackIndex];

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Compute track bounds to scale track fits within 160x160 canvas
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        track.samples.forEach(s => {
            if (s.point.x < minX) minX = s.point.x;
            if (s.point.x > maxX) maxX = s.point.x;
            if (s.point.z < minZ) minZ = s.point.z;
            if (s.point.z > maxZ) maxZ = s.point.z;
        });

        const trackW = maxX - minX;
        const trackH = maxZ - minZ;
        const pad = 12; // pixels padding
        const scale = Math.min((canvas.width - pad * 2) / trackW, (canvas.height - pad * 2) / trackH);
        
        const mapX = (x) => canvas.width / 2 + (x - (minX + trackW / 2)) * scale;
        const mapY = (z) => canvas.height / 2 + (z - (minZ + trackH / 2)) * scale;

        // 1. Draw track line
        ctx.strokeStyle = track.config.stripeColor.getStyle(); // Match track neon color
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 4;
        ctx.shadowColor = track.config.stripeColor.getStyle();
        
        ctx.beginPath();
        track.samples.forEach((s, idx) => {
            const mx = mapX(s.point.x);
            const my = mapY(s.point.z);
            if (idx === 0) ctx.moveTo(mx, my);
            else ctx.lineTo(mx, my);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // 2. Draw cars as indicator dots
        this.cars.forEach(car => {
            const mx = mapX(car.position.x);
            const my = mapY(car.position.z);
            
            ctx.beginPath();
            ctx.arc(mx, my, car.isAI ? 3 : 5, 0, Math.PI * 2);
            
            if (!car.isAI) {
                ctx.fillStyle = '#ffffff'; // Player white with halo
                ctx.shadowBlur = 6;
                ctx.shadowColor = '#ffffff';
            } else {
                ctx.fillStyle = car.color; // AI matches color
            }
            
            ctx.fill();
            ctx.shadowBlur = 0; // reset
        });
    }

    /**
     * Camera tracking behavior (Lerped Third-Person or Cockpit view)
     */
    updateCamera(dt) {
        if (!this.playerCar) return;

        const carPos = this.playerCar.position;
        const yaw = this.playerCar.yaw;
        const velocity = this.playerCar.velocity;
        const absSpeed = Math.abs(this.playerCar.speed);

        // Heading vectors
        const heading = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
        const up = new THREE.Vector3(0, 1, 0);

        // Camera views parameters
        let targetCamPos = new THREE.Vector3();
        let targetLookAt = new THREE.Vector3();

        // Zoom FOV stretch during boost
        const targetFOV = this.playerCar.boostTimer > 0 ? 76 : 65;
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 6 * dt);
        this.camera.updateProjectionMatrix();

        if (this.cameraViewIndex === 0) {
            // Chase Camera (Close)
            const followDist = 7.0 + (absSpeed * 0.05); // slight speed zoom out
            const followHeight = 2.4 + (absSpeed * 0.015);
            
            targetCamPos.copy(carPos)
                .addScaledVector(heading, -followDist)
                .addScaledVector(up, followHeight);

            // Look slightly ahead of car
            targetLookAt.copy(carPos).addScaledVector(heading, 3);
            
        } else if (this.cameraViewIndex === 1) {
            // Chase Camera (Far / High)
            const followDist = 12.0;
            const followHeight = 4.2;

            targetCamPos.copy(carPos)
                .addScaledVector(heading, -followDist)
                .addScaledVector(up, followHeight);
            
            targetLookAt.copy(carPos).addScaledVector(heading, 4);

        } else {
            // First Person Bumper / Cockpit View
            // Camera placed right on hood
            targetCamPos.copy(carPos)
                .addScaledVector(heading, 1.25)
                .addScaledVector(up, 0.72);
            
            targetLookAt.copy(carPos).addScaledVector(heading, 20);
        }

        // Apply smooth camera lag
        this.camera.position.lerp(targetCamPos, 8.5 * dt);
        this.camera.lookAt(targetLookAt);
    }

    /**
     * Core dynamic loop updating state, logic, and rendering
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        const dt = this.clock.getDelta();

        if (this.state === STATES.MENU) {
            // Cinematic scene spinning camera on main menu
            const t = Date.now() * 0.0003;
            this.camera.position.set(Math.sin(t) * 50, 20 + Math.cos(t * 0.5) * 10, Math.cos(t) * 50);
            this.camera.lookAt(0, 0, 0);
            
            // Background render
            this.renderer.render(this.scene, this.camera);
            return;
        }

        if (this.state === STATES.PAUSED || this.state === STATES.GAMEOVER) {
            // Render freeze frame
            this.renderer.render(this.scene, this.camera);
            return;
        }

        const track = tracks[this.activeTrackIndex];

        // ----------------------------------------------------
        // 1. CAR PHYSICS & AI CONTROLS
        // ----------------------------------------------------
        this.cars.forEach(car => {
            // Calculate RPM for audio synth (before updating speed)
            if (!car.isAI) {
                // RPM scales from idle (0) to redline (1) based on speed ratio
                const maxSpeedLimit = car.boostTimer > 0 ? 45.0 : 33.0;
                const rpm = Math.min(1.0, Math.abs(car.speed) / maxSpeedLimit);
                const throttleInput = this.keys.forward ? 1.0 : (this.keys.backward ? 0.3 : 0.0);
                audio.updateEngineSound(rpm, throttleInput);
            }

            // Lock movements during countdown (only allow engine revs)
            const activeDT = this.state === STATES.COUNTDOWN ? 0.0 : dt;

            // Apply physics updates
            updateCarPhysics(car, this.keys, track, activeDT, this.particleSystem);

            // Update mesh transforms
            car.mesh.position.copy(car.position);
            car.mesh.rotation.y = car.yaw;

            // Animate wheels spin based on car speed
            const wheelSpinSpeed = (car.speed * dt) / 0.42; // rad/s = v / radius
            const wheels = car.mesh.userData.wheels;
            
            wheels.fl.rotation.x += wheelSpinSpeed;
            wheels.fr.rotation.x += wheelSpinSpeed;
            wheels.bl.rotation.x += wheelSpinSpeed;
            wheels.br.rotation.x += wheelSpinSpeed;

            // Front wheels steering angle rotation
            let steerVisual = car.yawVelocity * 0.35; // scale visual steering angle
            wheels.fl.rotation.y = steerVisual;
            wheels.fr.rotation.y = steerVisual;

            // Dynamic light shadows camera follower
            if (!car.isAI) {
                // Lock shadow map focus camera box to follow player coordinates
                this.dirLight.position.set(car.position.x + 50, car.position.y + 100, car.position.z + 50);
                this.dirLight.target = car.mesh;
            }
        });

        // Resolve bumper car collisions
        if (this.state === STATES.RACING) {
            resolveCarCollisions(this.cars, dt, this.particleSystem);
        }

        // ----------------------------------------------------
        // 2. TIMERS & HUD TICKER
        // ----------------------------------------------------
        if (this.state === STATES.RACING) {
            this.raceTimer += dt;
            const currentLapTime = this.raceTimer - this.currentLapStartTime;
            
            // Check lap transitions
            if (this.playerCar) {
                const currentLapVal = this.playerCar.currentLap;
                const totalLaps = track.laps;

                if (currentLapVal > this.lapTimes.length + 1) {
                    // Completed a lap! Save time
                    this.lapTimes.push(currentLapTime);
                    this.currentLapStartTime = this.raceTimer;
                    
                    if (currentLapTime < this.bestLapTime) {
                        this.bestLapTime = currentLapTime;
                    }
                }

                // Race Over Condition: Crossed finish line on final lap
                if (currentLapVal > totalLaps) {
                    this.finishRace();
                    return;
                }
            }

            // Update timer readouts
            document.getElementById('hud-lap-time').innerText = this.formatTime(currentLapTime);
            document.getElementById('hud-total-time').innerText = this.formatTime(this.raceTimer);

            // Update Speedometer Gauge SVG Fill
            if (this.playerCar) {
                const spd = Math.round(Math.abs(this.playerCar.speed) * 3.6); // M/S to KM/H
                document.getElementById('hud-speed').innerText = spd;

                // Adjust speedometer gauge arc fill (dash offset goes from 283 (0%) to 71 (100%))
                const maxKmh = 160.0;
                const ratio = Math.min(1.0, spd / maxKmh);
                const dashoffset = 283 - ratio * 212;
                document.getElementById('speedometer-gauge').style.strokeDashoffset = dashoffset;

                // Regenerate Boost charge slowly (passive or by drifting)
                if (this.playerCar.boostTimer <= 0) {
                    const driftChargeBonus = this.playerCar.isDrifting ? 0.35 * dt : 0.05 * dt;
                    this.playerCar.boostCharge = Math.min(1.0, this.playerCar.boostCharge + driftChargeBonus);
                }
                
                // Update Boost HUD fill bar
                document.getElementById('hud-boost-fill').style.width = `${this.playerCar.boostCharge * 100}%`;
                
                // Turn boost bar bright pink if fully charged
                if (this.playerCar.boostCharge >= 1.0) {
                    document.getElementById('hud-boost-fill').style.filter = 'drop-shadow(0 0 10px #ff007f)';
                } else {
                    document.getElementById('hud-boost-fill').style.filter = 'none';
                }
            }

            // Rankings placing controller
            this.updateLeaderboardRankings();
            
            // Redraw minimap Canvas
            this.updateMinimap();
        }

        // ----------------------------------------------------
        // 3. ENGINES & PARTICLE SYSTEM
        // ----------------------------------------------------
        this.particleSystem.update(dt);
        this.updateCamera(dt);

        // Render viewport frame
        this.renderer.render(this.scene, this.camera);
    }
}

// Launch the Game
window.addEventListener('load', () => {
    new Game();
});
