import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';
import { Entity } from './Entity';
import { EnvironmentSystem } from '../environmentSystem';
import { LogEntry } from '../types';
import { SoundPlayer } from '../soundPlayer';

export class HumanEntity extends Entity {
    constructor(scene: THREE.Scene, position: THREE.Vector3, object: THREE.Object3D | undefined, logEntry: LogEntry, color: number, environmentSystem?: EnvironmentSystem, statusCode: number = 200, camera?: THREE.Camera, soundPlayer?: SoundPlayer) {
        // Use SkeletonUtils for proper cloning of skinned meshes
        let clonedObject = new THREE.Object3D();
        if(object){
            clonedObject = SkeletonUtils.clone(object);
            clonedObject.scale.set(0.0018,0.0018,0.0018)
        }
        
        super(scene, clonedObject, position, logEntry, color, environmentSystem, statusCode, camera, soundPlayer);
        
        // Set up animation mixer for the cloned object
        this.mixer = new THREE.AnimationMixer(clonedObject);
        
        // Find and play animations
        if ((object as any).animations && (object as any).animations.length > 0) {
            const animations = (object as any).animations;
            const action = this.mixer.clipAction(animations[0]);
            action.setEffectiveTimeScale(2)
            action.play();
        }
    }
}