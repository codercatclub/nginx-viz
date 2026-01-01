export class SoundPlayer {
    private audioContext: AudioContext;
    private sounds: Map<string, AudioBuffer> = new Map();
    private ambientSound?: AudioBufferSourceNode;
    private playingSounds: Map<string, number> = new Map();
    private masterVolume: number = 1;
    private effectsVolume: number = 0.4;
    private ambientVolume: number = 1.0;
    private muted: boolean = false;

    constructor(assetManager: any) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Load sounds from AssetManager
        const spawnSound = assetManager.loadedAssets.audio.get('public/assets/sounds/spawn.mp3');
        const enterSound = assetManager.loadedAssets.audio.get('public/assets/sounds/enter.mp3');
        const rejectSound = assetManager.loadedAssets.audio.get('public/assets/sounds/reject.mp3');
        const ambientSound = assetManager.loadedAssets.audio.get('public/assets/sounds/ambient.mp3');
        
        if (spawnSound) this.sounds.set('spawn', spawnSound);
        if (enterSound) this.sounds.set('enter', enterSound);
        if (rejectSound) this.sounds.set('reject', rejectSound);
        if (ambientSound) this.sounds.set('ambient', ambientSound);
    }

    /**
     * Load a sound file
     */
    async loadSound(name: string, url: string): Promise<void> {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.sounds.set(name, audioBuffer);
        } catch (error) {
            console.warn(`Failed to load sound ${name} from ${url}:`, error);
        }
    }

    /**
     * Load a sound from an AudioBuffer (already decoded)
     */
    loadSoundFromBuffer(name: string, audioBuffer: AudioBuffer): void {
        this.sounds.set(name, audioBuffer);
    }

    /**
     * Play a one-shot sound effect
     */
    playSound(name: string, volume: number = 1.0): void {
        if (this.muted) return;

        let count = this.playingSounds.get(name) || 0;

        if(count > 4) return;

        const buffer = this.sounds.get(name);
        if (!buffer) {
            console.warn(`Sound ${name} not loaded`);
            return;
        }

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = buffer;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        gainNode.gain.value = this.masterVolume * this.effectsVolume * volume;
        
        // Track that this sound is playing
        this.playingSounds.set(name, count+1);
        
        // Remove from playing sounds when it ends
        source.onended = () => {
            let count = this.playingSounds.get(name) || 0;
            this.playingSounds.set(name, count-1);
        };
        
        source.start(0);
    }

    /**
     * Play ambient/background sound in a loop
     */
    playAmbient(name: string): void {
        if (this.muted) return;

        // Stop existing ambient sound if any
        this.stopAmbient();

        const buffer = this.sounds.get(name);
        if (!buffer) {
            console.warn(`Sound ${name} not loaded`);
            return;
        }

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = buffer;
        source.loop = true;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        gainNode.gain.value = this.masterVolume * this.ambientVolume;
        
        source.start(0);
        this.ambientSound = source;
    }

    /**
     * Stop ambient sound
     */
    stopAmbient(): void {
        if (this.ambientSound) {
            try {
                this.ambientSound.stop();
            } catch (e) {
                // Already stopped
            }
            this.ambientSound = undefined;
        }
    }

    /**
     * Play spawn sound
     */
    playSpawn(): void {
        this.playSound('spawn', 0.8);
    }

    /**
     * Play enter sound (when agent enters castle successfully)
     */
    playEnter(): void {
        this.playSound('enter', 0.9);
    }

    /**
     * Play reject sound (when agent is rejected from castle)
     */
    playReject(): void {
        this.playSound('reject', 0.9);
    }

    /**
     * Set master volume (0.0 to 1.0)
     */
    setMasterVolume(volume: number): void {
        this.masterVolume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Set effects volume (0.0 to 1.0)
     */
    setEffectsVolume(volume: number): void {
        this.effectsVolume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Set ambient volume (0.0 to 1.0)
     */
    setAmbientVolume(volume: number): void {
        this.ambientVolume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Mute/unmute all sounds
     */
    setMuted(muted: boolean): void {
        this.muted = muted;
        if (muted) {
            this.stopAmbient();
        }
    }

    /**
     * Toggle mute
     */
    toggleMute(): boolean {
        this.setMuted(!this.muted);
        return this.muted;
    }

    /**
     * Get mute state
     */
    isMuted(): boolean {
        return this.muted;
    }

    /**
     * Resume audio context (needed after user interaction on some browsers)
     */
    resume(): void {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
}
