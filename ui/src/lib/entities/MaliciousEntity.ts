import * as THREE from 'three';
import { Entity } from './Entity';
import { EnvironmentSystem } from '../environmentSystem';
import { LogEntry } from '../types';
import { SoundPlayer } from '../soundPlayer';

export class MaliciousEntity extends Entity {
    constructor(scene: THREE.Scene, position: THREE.Vector3, object: THREE.Object3D | undefined, logEntry: LogEntry, color: number, environmentSystem?: EnvironmentSystem, statusCode: number = 200, camera?: THREE.Camera, soundPlayer?: SoundPlayer) {
        let clonedObject = new THREE.Object3D();
        if (object) {
            clonedObject = object.clone();
            clonedObject.scale.set(3, 3, 3)
        }
        super(scene, clonedObject, position, logEntry, color, environmentSystem, statusCode, camera, soundPlayer);
    }
}