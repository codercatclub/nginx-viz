import * as THREE from 'three';
import { EnvironmentSystem } from '../environmentSystem';
import { LogEntry } from '../types';
import { SoundPlayer } from '../soundPlayer';

export class Entity {
    protected object: THREE.Object3D;
    protected scene: THREE.Scene;
    protected mixer?: THREE.AnimationMixer;
    protected environmentSystem?: EnvironmentSystem;
    protected statusCode: number;
    protected rejected: boolean = false;
    protected initialPosition: THREE.Vector3;
    protected textDiv?: HTMLDivElement;
    protected logEntry: LogEntry;
    protected camera?: THREE.Camera;
    protected soundPlayer?: SoundPlayer;
    protected hasPlayedEnterSound: boolean = false;
    protected hasPlayedRejectSound: boolean = false;
    protected hasReachedCenter: boolean = false;

    constructor(scene: THREE.Scene, object: THREE.Object3D, position: THREE.Vector3, logEntry: LogEntry, color: number, environmentSystem?: EnvironmentSystem, statusCode: number = 200, camera?: THREE.Camera, soundPlayer?: SoundPlayer) {
        this.scene = scene;
        this.object = object;
        this.object.position.copy(position);
        this.logEntry = logEntry;
        this.environmentSystem = environmentSystem;
        this.statusCode = statusCode;
        this.initialPosition = position.clone();
        this.camera = camera;
        this.soundPlayer = soundPlayer;
        scene.add(this.object);

        // Create text label
        if (logEntry) {
            this.createTextDiv(logEntry, color);
        }
    }

    update(deltaTime: number = 0.016) {
        const center = new THREE.Vector3(0, 0, 0);
        const distanceToCenter = this.object.position.length();

        // Check collision with castle (simple box at center)
        if (distanceToCenter < 5) {
            if (this.environmentSystem) {
                this.environmentSystem.addInteractionPoint(this.object.position);
            }

            if (!this.hasReachedCenter) {
                this.hasReachedCenter = true;
                // Reject if status code is not 200
                if (this.statusCode != 200) {
                    this.rejected = true;
                    // Play reject sound
                    if (this.soundPlayer && !this.hasPlayedRejectSound) {
                        this.soundPlayer.playReject();
                        this.hasPlayedRejectSound = true;
                    }
                } else {
                    // Play enter sound for successful entry
                    if (this.soundPlayer && !this.hasPlayedEnterSound) {
                        this.soundPlayer.playEnter();
                        this.hasPlayedEnterSound = true;
                    }
                }
            }
        }

        if (this.rejected) {
            // Move back to initial position
            const direction = new THREE.Vector3().subVectors(this.initialPosition, this.object.position).normalize();
            this.object.position.add(direction.multiplyScalar(deltaTime * 7.0));
            this.object.lookAt(this.initialPosition);
        } else {
            // Move towards center
            const direction = new THREE.Vector3().subVectors(center, this.object.position).normalize();
            this.object.position.add(direction.multiplyScalar(deltaTime * 7.0));
            this.object.lookAt(center);
        }

        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        if (this.textDiv && this.camera) {
            this.updateTextPosition();
        }
    }

    get position() { return this.object.position; }
    get isRejected() { return this.rejected; }

    setFlag(country: string) {
        if (country) {
            const countryCode = country.toLowerCase();
            const svgFilename = `${countryCode}.svg`;

            // Use preloaded SVG from window.countryIcons
            const countryIcons = (window as any).countryIcons || {};
            const svgText = countryIcons[svgFilename];

            if (svgText) {
                const dataUrl = `data:image/svg+xml,${encodeURIComponent(svgText)}`;
                new THREE.TextureLoader().load(dataUrl, (img) => {
                    // Ensure SVG has dimensions set for cross-browser compatibility
                    if (!img.image.width || !img.image.height) {
                        img.image.width = 128;
                        img.image.height = 128;
                    }

                    this.object.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            child.material = new THREE.MeshBasicMaterial()
                            child.material.map = img;
                            child.material.needsUpdate = true;

                        }
                    });
                });
            }
        }
    }

    createTextDiv(logEntry: LogEntry, color: number) {
        // Create HTML div element
        this.textDiv = document.createElement('div');
        this.textDiv.style.position = 'absolute';
        this.textDiv.style.color = 'white';
        this.textDiv.style.backgroundColor = '#' + color.toString(16);
        this.textDiv.style.padding = '4px 8px';
        this.textDiv.style.borderRadius = '4px';
        this.textDiv.style.fontSize = '12px';
        this.textDiv.style.fontFamily = 'monospace';
        this.textDiv.style.pointerEvents = 'none';
        this.textDiv.style.whiteSpace = 'normal';
        this.textDiv.style.wordBreak = 'break-word';
        this.textDiv.style.width = '200px';
        this.textDiv.style.position = 'absolute';
        this.textDiv.style.textAlign = 'center';
        this.textDiv.style.zIndex = '1000';

        // Display the URL
        const displayText = logEntry.url.toString();
        this.textDiv.textContent = displayText;

        document.body.appendChild(this.textDiv);
    }

    updateTextPosition() {
        if (!this.textDiv || !this.camera) return;

        // Get position of the entity
        const position = this.object.position.clone();
        position.y += 7;

        // Project 3D position to screen coordinates
        const vector = position.clone();
        vector.project(this.camera);

        // Convert to screen coordinates
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

        // Update div position - the transform will center it from this point
        this.textDiv.style.left = `${x - 100}px`;
        this.textDiv.style.top = `${y}px`;

        // Hide if behind camera
        if (vector.z > 1) {
            this.textDiv.style.display = 'none';
        } else {
            this.textDiv.style.display = 'block';
        }
    }

    destroy() {
        this.scene.remove(this.object);
        if (this.textDiv) {
            document.body.removeChild(this.textDiv);
        }
    }
}