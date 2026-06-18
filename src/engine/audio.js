/**
 * Web Audio API synthesizer for procedural sound effects and background music.
 * [audio.js](file:///C:/Users/Ananya%20Bhartiya/Documents/antigravity/beautiful-euclid/src/engine/audio.js)
 */

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.masterVolumeSFX = null;
        this.masterVolumeMusic = null;
        
        this.sfxVolumeValue = 0.7;
        this.musicVolumeValue = 0.5;
        this.muted = false;

        // Sound nodes
        this.engineOsc1 = null;
        this.engineOsc2 = null;
        this.engineFilter = null;
        this.engineGain = null;
        
        this.screechNoise = null;
        this.screechFilter = null;
        this.screechGain = null;
        
        this.boostOsc = null;
        this.boostNoise = null;
        this.boostGain = null;

        // Music Sequencer state
        this.musicInterval = null;
        this.isPlayingMusic = false;
        this.currentBeat = 0;
        this.nextNoteTime = 0.0;
        this.tempo = 125.0; // BPM
        this.lookahead = 25.0; // ms
        this.scheduleAheadTime = 0.1; // seconds

        // Music progression definitions
        // Synthwave chord roots (4/4, each chord for 4 beats): Am, F, C, G
        this.chords = [
            [110.00, 220.00], // Am (A2, A3)
            [87.31, 174.61],  // F (F2, F3)
            [130.81, 261.63], // C (C3, C4)
            [97.99, 195.99]   // G (G2, G3)
        ];
        
        // Simple retro synthwave melody (frequencies of notes)
        // A4, B4, C5, E5, D5, C5, B4, G4, A4...
        this.melodyNotes = [
            440.00, 493.88, 523.25, 659.25, 587.33, 523.25, 493.88, 392.00,
            440.00, 440.00, 523.25, 440.00, 587.33, 523.25, 493.88, 392.00
        ];
    }

    /**
     * Initializes the Audio Context and sets up the synthesizer nodes.
     * Must be called in response to a user gesture.
     */
    init() {
        if (this.ctx) return; // Already initialized

        // Create audio context
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();

        // Create master gain nodes
        this.masterVolumeSFX = this.ctx.createGain();
        this.masterVolumeSFX.gain.value = this.sfxVolumeValue;
        this.masterVolumeSFX.connect(this.ctx.destination);

        this.masterVolumeMusic = this.ctx.createGain();
        this.masterVolumeMusic.gain.value = this.musicVolumeValue;
        this.masterVolumeMusic.connect(this.ctx.destination);

        this.setupEngineSynth();
        this.setupDriftSynth();
        this.setupBoostSynth();
    }

    /**
     * Resumes the audio context (required due to browser autoplay policies)
     */
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Sets up the dual oscillator engine synthesizer.
     */
    setupEngineSynth() {
        if (!this.ctx) return;

        // Engine sound: Combines two sawtooth oscillators at detuned intervals
        this.engineOsc1 = this.ctx.createOscillator();
        this.engineOsc2 = this.ctx.createOscillator();
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineGain = this.ctx.createGain();

        this.engineOsc1.type = 'sawtooth';
        this.engineOsc2.type = 'sawtooth';
        
        this.engineOsc1.frequency.value = 60; // Idle frequency
        this.engineOsc2.frequency.value = 60.5; // Slightly detuned

        this.engineFilter.type = 'lowpass';
        this.engineFilter.Q.value = 3;
        this.engineFilter.frequency.value = 300; // Muffle engine idle sound

        this.engineGain.gain.value = 0.0; // Start quiet

        // Connections
        this.engineOsc1.connect(this.engineFilter);
        this.engineOsc2.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.masterVolumeSFX);

        this.engineOsc1.start(0);
        this.engineOsc2.start(0);
    }

    /**
     * Sets up the white-noise tire drift synthesizer.
     */
    setupDriftSynth() {
        if (!this.ctx) return;

        // Create buffer of white noise
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        // Noise source
        this.screechNoise = this.ctx.createBufferSource();
        this.screechNoise.buffer = noiseBuffer;
        this.screechNoise.loop = true;

        // Filter: bandpass filter centered around 900Hz to simulate screeches
        this.screechFilter = this.ctx.createBiquadFilter();
        this.screechFilter.type = 'bandpass';
        this.screechFilter.frequency.value = 950;
        this.screechFilter.Q.value = 2.0;

        // Gain
        this.screechGain = this.ctx.createGain();
        this.screechGain.gain.value = 0.0;

        // Connections
        this.screechNoise.connect(this.screechFilter);
        this.screechFilter.connect(this.screechGain);
        this.screechGain.connect(this.masterVolumeSFX);

        this.screechNoise.start(0);
    }

    /**
     * Sets up the jet engine boost synthesizer.
     */
    setupBoostSynth() {
        if (!this.ctx) return;

        this.boostGain = this.ctx.createGain();
        this.boostGain.gain.value = 0.0;
        this.boostGain.connect(this.masterVolumeSFX);
    }

    /**
     * Dynamically updates the engine noise frequency and tone.
     * @param {number} rpm - Value from 0 (idle) to 1 (redline)
     * @param {number} throttle - Value from 0 (none) to 1 (full throttle)
     */
    updateEngineSound(rpm, throttle) {
        if (!this.ctx || !this.engineOsc1) return;

        // Calculate pitch based on RPM (idle = 60Hz, redline = 240Hz)
        const baseFreq = 60 + rpm * 180;
        const detuneAmt = 0.5 + rpm * 1.5;

        // Schedule changes smoothly to avoid clicking
        const now = this.ctx.currentTime;
        this.engineOsc1.frequency.setValueAtTime(baseFreq, now);
        this.engineOsc2.frequency.setValueAtTime(baseFreq + detuneAmt, now);

        // Adjust filter cutoff based on throttle and RPM (open up filter when driving fast/accelerating)
        const filterCutoff = 250 + rpm * 1200 + throttle * 600;
        this.engineFilter.frequency.setValueAtTime(filterCutoff, now);

        // Set engine volume (louder under load/throttle)
        const volume = 0.12 + throttle * 0.15 + rpm * 0.08;
        this.engineGain.gain.setValueAtTime(volume, now);
    }

    /**
     * Starts or stops the tire screech sound based on drift status.
     * @param {number} intensity - Value from 0 (no drift) to 1 (full drift)
     */
    setDriftIntensity(intensity) {
        if (!this.ctx || !this.screechGain) return;
        const now = this.ctx.currentTime;
        // Fade in/out screech noise
        this.screechGain.gain.setTargetAtTime(intensity * 0.28, now, 0.05);
    }

    /**
     * Triggers the boost jet/rocket sound effect.
     * @param {boolean} active - True to play, false to stop
     */
    setBoostActive(active) {
        if (!this.ctx || !this.boostGain) return;
        
        const now = this.ctx.currentTime;
        if (active) {
            // Re-create oscillators/filters on-demand for dynamic pitch sweeps
            this.stopBoostNodes();

            this.boostOsc = this.ctx.createOscillator();
            this.boostOsc.type = 'triangle';
            this.boostOsc.frequency.setValueAtTime(80, now);
            // Sweep up pitch
            this.boostOsc.frequency.exponentialRampToValueAtTime(700, now + 1.5);

            // Add some high pass filtered white noise for wind rush
            const bufferSize = this.ctx.sampleRate * 2;
            const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            this.boostNoise = this.ctx.createBufferSource();
            this.boostNoise.buffer = noiseBuffer;
            this.boostNoise.loop = true;

            const hpFilter = this.ctx.createBiquadFilter();
            hpFilter.type = 'highpass';
            hpFilter.frequency.value = 1200;

            // Connect nodes
            this.boostOsc.connect(this.boostGain);
            this.boostNoise.connect(hpFilter);
            hpFilter.connect(this.boostGain);

            this.boostGain.gain.setValueAtTime(0.0, now);
            this.boostGain.gain.linearRampToValueAtTime(0.35, now + 0.1);

            this.boostOsc.start(now);
            this.boostNoise.start(now);
        } else {
            this.boostGain.gain.linearRampToValueAtTime(0.0, now + 0.2);
            setTimeout(() => this.stopBoostNodes(), 200);
        }
    }

    stopBoostNodes() {
        try {
            if (this.boostOsc) {
                this.boostOsc.stop();
                this.boostOsc.disconnect();
                this.boostOsc = null;
            }
            if (this.boostNoise) {
                this.boostNoise.stop();
                this.boostNoise.disconnect();
                this.boostNoise = null;
            }
        } catch(e) {}
    }

    /**
     * Plays a crash sound effect.
     * @param {number} impact - Collision speed ratio (0 to 1)
     */
    playCrash(impact) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        
        // Low thump oscillator
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(30, now + 0.3);

        // Clattering white noise for debris
        const bufferSize = this.ctx.sampleRate * 0.4;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const lpFilter = this.ctx.createBiquadFilter();
        lpFilter.type = 'lowpass';
        lpFilter.frequency.setValueAtTime(500, now);

        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(impact * 0.7, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

        // Connections
        osc.connect(gainNode);
        noise.connect(lpFilter);
        lpFilter.connect(gainNode);
        
        gainNode.connect(this.masterVolumeSFX);

        osc.start(now);
        noise.start(now);
        
        osc.stop(now + 0.4);
        noise.stop(now + 0.4);
    }

    /**
     * Plays countdown sound beeps.
     * @param {boolean} isGo - True if it's the green light "GO!" beep, false for red lights.
     */
    playCountdownBeep(isGo) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.value = isGo ? 880 : 440; // Higher frequency for GO
        
        gainNode.gain.setValueAtTime(0.25, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + (isGo ? 0.35 : 0.15));
        
        osc.connect(gainNode);
        gainNode.connect(this.masterVolumeSFX);
        
        osc.start(now);
        osc.stop(now + (isGo ? 0.4 : 0.2));
    }

    /**
     * Starts the synthwave music sequencer loop.
     */
    startMusic() {
        if (!this.ctx || this.isPlayingMusic) return;
        
        this.isPlayingMusic = true;
        this.currentBeat = 0;
        this.nextNoteTime = this.ctx.currentTime;
        
        const scheduler = () => {
            while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
                this.scheduleBeat(this.currentBeat, this.nextNoteTime);
                this.advanceBeat();
            }
        };

        // Poll for scheduling notes
        this.musicInterval = setInterval(scheduler, this.lookahead);
    }

    /**
     * Advances the sequencer cursor.
     */
    advanceBeat() {
        const secondsPerBeat = 60.0 / this.tempo / 2; // eighth notes
        this.nextNoteTime += secondsPerBeat;
        this.currentBeat = (this.currentBeat + 1) % 16; // 16-step grid
    }

    /**
     * Schedules notes at a specific beat index.
     * Creates a retro synthwave baseline and simple lead melody.
     * @param {number} beat - 0 to 15 step
     * @param {number} time - Audio time
     */
    scheduleBeat(beat, time) {
        // Chord indices: step 0-7 = chord 0; 8-15 = chord 1...
        // Let's change chord every 8 steps (4 beats)
        const chordIndex = Math.floor(beat / 4) % 4;
        
        // 1. Synth Bassline (Retro Cyberpunk Offbeat Bass)
        // Bass plays constant eighth notes
        const bassFreq = this.chords[chordIndex][beat % 2];
        const bassOsc = this.ctx.createOscillator();
        const bassFilter = this.ctx.createBiquadFilter();
        const bassGain = this.ctx.createGain();

        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(bassFreq, time);

        // High filtering for a squelchy synth bass
        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(180, time);
        bassFilter.frequency.exponentialRampToValueAtTime(100, time + 0.15);

        bassGain.gain.setValueAtTime(0.12, time);
        bassGain.gain.linearRampToValueAtTime(0.001, time + 0.2);

        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(this.masterVolumeMusic);

        bassOsc.start(time);
        bassOsc.stop(time + 0.22);

        // 2. Chiptune Percussion (Snare on beat 4, 12; Kick on beat 0, 8)
        if (beat === 0 || beat === 8) {
            // Kick Drum
            const kickOsc = this.ctx.createOscillator();
            const kickGain = this.ctx.createGain();
            kickOsc.frequency.setValueAtTime(150, time);
            kickOsc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
            kickGain.gain.setValueAtTime(0.3, time);
            kickGain.gain.linearRampToValueAtTime(0.001, time + 0.12);
            kickOsc.connect(kickGain);
            kickGain.connect(this.masterVolumeMusic);
            kickOsc.start(time);
            kickOsc.stop(time + 0.15);
        } else if (beat === 4 || beat === 12) {
            // White noise Snare
            const bufferSize = this.ctx.sampleRate * 0.15;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            
            const snareFilter = this.ctx.createBiquadFilter();
            snareFilter.type = 'bandpass';
            snareFilter.frequency.setValueAtTime(1000, time);

            const snareGain = this.ctx.createGain();
            snareGain.gain.setValueAtTime(0.16, time);
            snareGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

            noise.connect(snareFilter);
            snareFilter.connect(snareGain);
            snareGain.connect(this.masterVolumeMusic);

            noise.start(time);
            noise.stop(time + 0.15);
        }

        // 3. Lead Arpeggiator / Melody
        // Play lead melody on specific beats (e.g. syncopated melody)
        const melodyPattern = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1];
        if (melodyPattern[beat] === 1) {
            // Select note relative to current chord root for harmony
            const rootFreq = this.chords[chordIndex][1];
            // Simple major/minor arpeggiator intervals: root, minor third, fifth, octave
            // Let's use melody notes
            const melodyFreq = this.melodyNotes[beat];
            
            const leadOsc = this.ctx.createOscillator();
            const leadFilter = this.ctx.createBiquadFilter();
            const leadGain = this.ctx.createGain();

            leadOsc.type = 'triangle';
            leadOsc.frequency.setValueAtTime(melodyFreq, time);

            leadFilter.type = 'lowpass';
            leadFilter.frequency.setValueAtTime(600, time);
            leadFilter.frequency.exponentialRampToValueAtTime(300, time + 0.25);

            leadGain.gain.setValueAtTime(0.08, time);
            leadGain.gain.linearRampToValueAtTime(0.001, time + 0.25);

            leadOsc.connect(leadFilter);
            leadFilter.connect(leadGain);
            leadGain.connect(this.masterVolumeMusic);

            leadOsc.start(time);
            leadOsc.stop(time + 0.26);
        }
    }

    /**
     * Stops the sequencer.
     */
    stopMusic() {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
        this.isPlayingMusic = false;
    }

    /**
     * Mutes or unmutes all sound engines.
     * @param {boolean} mute
     */
    setMuted(mute) {
        this.muted = mute;
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        if (mute) {
            this.masterVolumeSFX.gain.setValueAtTime(0, now);
            this.masterVolumeMusic.gain.setValueAtTime(0, now);
        } else {
            this.masterVolumeSFX.gain.setValueAtTime(this.sfxVolumeValue, now);
            this.masterVolumeMusic.gain.setValueAtTime(this.musicVolumeValue, now);
        }
    }

    /**
     * Updates SFX volume (0 to 1).
     * @param {number} vol
     */
    setSFXVolume(vol) {
        this.sfxVolumeValue = vol;
        if (this.masterVolumeSFX && !this.muted) {
            this.masterVolumeSFX.gain.setValueAtTime(vol, this.ctx.currentTime);
        }
    }

    /**
     * Updates Music volume (0 to 1).
     * @param {number} vol
     */
    setMusicVolume(vol) {
        this.musicVolumeValue = vol;
        if (this.masterVolumeMusic && !this.muted) {
            this.masterVolumeMusic.gain.setValueAtTime(vol, this.ctx.currentTime);
        }
    }
}

// Export single instance
export const audio = new AudioEngine();
