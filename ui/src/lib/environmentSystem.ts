import * as THREE from 'three';
import { AssetManager } from './assetManager';

interface InteractionPoint {
    position: THREE.Vector3;
    timestamp: number;
}

export class EnvironmentSystem {
    private assetManager: AssetManager;
    private shaderMaterial?: THREE.ShaderMaterial;
    private particleShaderMaterial?: THREE.ShaderMaterial;
    private interactionPoints: InteractionPoint[] = [];
    private readonly MAX_INTERACTION_POINTS = 20;
    private readonly INTERACTION_POINT_LIFETIME = 1.0; // seconds
    private time: number = 0;
    private sprite?: THREE.Sprite;

    constructor(scene: THREE.Scene, assetManager: AssetManager) {
        this.assetManager = assetManager;
        this.addGroundPlane(scene);
        this.addCastle(scene);
        this.addSpriteCard(scene);
        this.addPacketParticles(scene);
    }

    update(deltaTime: number = 0.016): void {
        this.time += deltaTime;
        if (this.shaderMaterial) {
            this.shaderMaterial.uniforms.time.value = this.time;
        }
        if (this.particleShaderMaterial) {
            this.particleShaderMaterial.uniforms.time.value = this.time;
        }
        this.cleanupOldInteractionPoints();
    }

    private cleanupOldInteractionPoints(): void {
        const currentTime = performance.now() / 1000; // Convert to seconds
        this.interactionPoints = this.interactionPoints.filter(
            point => (currentTime - point.timestamp) < this.INTERACTION_POINT_LIFETIME
        );
        
        // Update shader uniforms after cleanup
        if (this.shaderMaterial){
            this.updateShaderUniforms();
        }
    }

    addInteractionPoint(position: THREE.Vector3): void {
        // Add new interaction point with current timestamp
        const currentTime = performance.now() / 1000; // Convert to seconds
        this.interactionPoints.push({
            position: position.clone(),
            timestamp: currentTime
        });
        
        // Keep only the most recent points
        if (this.interactionPoints.length > this.MAX_INTERACTION_POINTS) {
            this.interactionPoints.shift();
        }
        
        // Update shader uniforms
        if (this.shaderMaterial) {
            this.updateShaderUniforms();
        }
    }

    private updateShaderUniforms(): void {
        if (!this.shaderMaterial) return;
        
        // Extract positions from interaction points
        const positions = this.interactionPoints.map(point => point.position);
        
        // Pad array to MAX_INTERACTION_POINTS length
        const paddedPoints = [...positions];
        while (paddedPoints.length < this.MAX_INTERACTION_POINTS) {
            paddedPoints.push(new THREE.Vector3(999, 999, 999)); // Far away point
        }
        
        this.shaderMaterial.uniforms.interactionPoints.value = paddedPoints;
        this.shaderMaterial.uniforms.numPoints.value = this.interactionPoints.length;
    }

    private addGroundPlane(scene: THREE.Scene): void {
        const ground = this.assetManager.loadedAssets.objects.get('public/assets/models/ground.glb');
        if(ground){
            ground.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.material = new THREE.MeshBasicMaterial({vertexColors: true});
                }
            });
            scene.add(ground)
        }
    }

    private addCastle(scene: THREE.Scene): void {
        const castle = this.assetManager.loadedAssets.objects.get('public/assets/models/castle.glb');
        if (castle) {
            // Custom GLSL shader with interaction points
            const vertexShader = `
                #define MAX_POINTS 20
                
                uniform vec3 interactionPoints[MAX_POINTS];
                uniform int numPoints;
                uniform float time;
                
                varying vec3 vNormal;
                varying vec3 vPosition;
                varying vec3 vColor;
                varying vec3 vWorldPosition;
                varying float vInteractionAmt;
                varying float vGlitchColorAmt;

                vec3 lerp (vec3 a, vec3 b, float t) {
                    return (1. - t) * a + t * b;
                }
                float lerp (float a, float b, float t) {
                    return (1. - t) * a + t * b;
                }
                float noise_hash_alt(vec3 p)
                {
                    p = fract(p * 0.3183099 + .1);
                    p *= 17.0;
                    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
                }

                float noise_alt (vec3 x)
                {
                    vec3 p = floor(x);
                    vec3 f = fract(x);
                    f = f * f * (3. - 2. * f);

                    return lerp(lerp(lerp(noise_hash_alt(p), noise_hash_alt(p + vec3(1.0, 0, 0)), f.x),
                        lerp(noise_hash_alt(p + vec3(0, 1.0, 0)), noise_hash_alt(p + vec3(1.0, 1.0, 0)), f.x), f.y),
                        lerp(lerp(noise_hash_alt(p + vec3(0, 0, 1.0)), noise_hash_alt(p + vec3(1.0, 0, 1.0)), f.x),
                            lerp(noise_hash_alt(p + vec3(0, 1.0, 1.0)), noise_hash_alt(p + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
                }
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);

                     // Calculate interaction effect
                    float interactionEffect = 0.0;
                    for(int i = 0; i < MAX_POINTS; i++) {
                        if(i >= numPoints) break;
                        
                        float dist = distance(position, interactionPoints[i]);
                        float influence = smoothstep(3.0, 0.0, dist);
                        interactionEffect += influence;
                    }
                    vInteractionAmt = clamp(interactionEffect, 0.0, 1.0);

                    vPosition = position;

                    vPosition.z += sin(position.y) * vInteractionAmt;

                    vec3 noiseDir = vec3(sin(vPosition.x + time), cos(vPosition.y + time), sin(vPosition.z + time));

                    vPosition += 0.25* noiseDir* step(0.9,length(color.r));
                    vPosition += 2.0 * length(noiseDir) *step(0.9,length(color.r)) * normal;

                    float glitchAmt = step(1.0,float(numPoints));

                    float glitchNoise = glitchAmt*noise_alt(4.0*vPosition + 10. * vec3(sin(time), cos(time), -sin(time))) - 0.5;

                    vGlitchColorAmt = glitchAmt*step(fract(sin(0.5*time) + 2. * cos(0.5*time)), 0.3);
                    vPosition.x += vGlitchColorAmt * glitchNoise;

                    vColor = color;
                    vWorldPosition = (modelMatrix * vec4(vPosition, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);
                }
            `;
            
            const fragmentShader = `
                #define MAX_POINTS 20
                
                uniform vec3 interactionPoints[MAX_POINTS];
                uniform int numPoints;
                uniform float time;
                
                varying vec3 vNormal;
                varying vec3 vPosition;
                varying vec3 vColor;
                varying vec3 vWorldPosition;
                varying float vInteractionAmt;
                varying float vGlitchColorAmt;
                
                void main() {
                    // Simple lighting based on normal
                    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                    float diff = max(dot(vNormal, lightDir), 0.0);
                   
                    
                    vec3 glitchColor = vec3(
                    floor(fract(7. * time) + 0.5),
                    floor(fract(7. * time+0.3) + 0.5),
                    floor(fract(7. * time+0.6) + 0.5)
                    );

                    vec3 highlightColor = abs(vec3(sin(vPosition.x), cos(vPosition.y), sin(vPosition.z))); 
                    vec3 baseColor =abs(vec3(sin(1.3*vColor.r+0.03*time), cos(2.1*vColor.g+0.03*time),sin(1.9*vColor.b+0.03*time))); ;
                    vec3 color = mix(baseColor, highlightColor, vInteractionAmt);
                    
                    color = mix(color, glitchColor, vGlitchColorAmt);

                    if(vInteractionAmt - 0.5 > 0.0) discard;
                    
                    gl_FragColor = vec4(color, 1.0);
                }
            `;
            
            // Initialize uniforms
            const uniforms = {
                interactionPoints: { value: new Array(this.MAX_INTERACTION_POINTS).fill(new THREE.Vector3(999, 999, 999)) },
                numPoints: { value: 0 },
                time: { value: 0 }
            };
            
            this.shaderMaterial = new THREE.ShaderMaterial({
                vertexShader: vertexShader,
                fragmentShader: fragmentShader,
                uniforms: uniforms,
                vertexColors: true,
                side: THREE.DoubleSide
            });
            
            castle.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.material = this.shaderMaterial;
                }
            });
            scene.add(castle);
        }
    }

    private addSpriteCard(scene: THREE.Scene): void {
        // Load texture from asset manager
        const texture = this.assetManager.loadedAssets.textures.get('public/assets/textures/codercat_cat.png');
        
        if (texture) {
            // Create sprite material with the loaded texture
            const spriteMaterial = new THREE.SpriteMaterial({ 
                map: texture,
                color: new THREE.Color("#ff75dc"),
                opacity: 1.0,
                transparent: true
            });
            
            this.sprite = new THREE.Sprite(spriteMaterial);
            this.sprite.scale.set(5,5,1);
            this.sprite.position.set(0, 4, 0);
            scene.add(this.sprite);
        } else {
            console.warn('Sprite texture not loaded');
        }
    }

    private addPacketParticles(scene: THREE.Scene): void {
        const particleCount = 100;
        const sphereRadius = 300;
        const centerPoint = new THREE.Vector3(0, 0, 0);
        
        // Create geometry for a single box
        const boxGeometry = new THREE.SphereGeometry(1.0);
        
        // Vertex shader for animated particles
        const vertexShader = `
            uniform float time;
            varying vec3 vColor;
            
            // Hash function for pseudo-random values
            float hash(float n) {
                return fract(sin(n) * 43758.5453123);
            }
            
            void main() {
                vec3 pos = position;
                
                // Get instance ID to make each particle unique
                float instanceId = float(gl_InstanceID);
                
                // Create unique phase offset for each particle
                float phase = hash(instanceId) * 6.28318; // 2 * PI
                float speed = 0.2*(0.3 + hash(instanceId + 100.0) * 0.5);
                
                // Random rotation axes for each particle
                float angleX = time * speed * hash(instanceId + 200.0) + phase;
                float angleY = time * speed * hash(instanceId + 300.0) + phase * 1.3;
                float angleZ = time * speed * hash(instanceId + 400.0) + phase * 0.7;
                
                // Rotation matrices for each axis
                mat3 rotationX = mat3(
                    1.0, 0.0, 0.0,
                    0.0, cos(angleX), -sin(angleX),
                    0.0, sin(angleX), cos(angleX)
                );
                
                mat3 rotationY = mat3(
                    cos(angleY), 0.0, sin(angleY),
                    0.0, 1.0, 0.0,
                    -sin(angleY), 0.0, cos(angleY)
                );
                
                mat3 rotationZ = mat3(
                    cos(angleZ), -sin(angleZ), 0.0,
                    sin(angleZ), cos(angleZ), 0.0,
                    0.0, 0.0, 1.0
                );
                
                // Apply rotation to position after getting instance matrix transform
                vec4 instancePos = instanceMatrix * vec4(pos, 1.0);
                
                // Get relative position from center
                vec3 centerPos = vec3(0.0,0.0,0.0);
                vec3 relativePos = instancePos.xyz - centerPos;
                
                // Rotate around center on all axes
                relativePos = rotationZ * rotationY * rotationX * relativePos;
                
                // Add wave motion
                float wave = sin(time * 2.0 + phase) * 0.5;
                relativePos.y += wave;
                
                instancePos.xyz = centerPos + relativePos;
                
                gl_Position = projectionMatrix * viewMatrix * instancePos;
                
                // Color variation based on instance
                vColor = vec3(
                    hash(instanceId + time),
                    hash(instanceId + 50.0 + time),
                    hash(instanceId + 25.0 + time)
                );
            }
        `;
        
        const fragmentShader = `
            varying vec3 vColor;
            
            void main() {
                gl_FragColor = vec4(vColor, 0.8);
            }
        `;
        
        this.particleShaderMaterial = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                time: { value: 0.0 }
            },
            transparent: true
        });
        
        const instancedMesh = new THREE.InstancedMesh(boxGeometry, this.particleShaderMaterial, particleCount);
        const dummy = new THREE.Object3D();
        
        for (let i = 0; i < particleCount; i++) {
            // Random position on/within sphere
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = sphereRadius *  (0.4 + 0.4 * Math.random()); 
            
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);
            
            dummy.position.set(
                centerPoint.x + x,
                centerPoint.y + y,
                centerPoint.z + z
            );
            
            // Random rotation
            dummy.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            
            // Random scale variation
            const scale = 0.8 + Math.random() * 0.4;
            dummy.scale.set(scale, scale, scale);
            
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        
        instancedMesh.instanceMatrix.needsUpdate = true;
        scene.add(instancedMesh);
    }
}