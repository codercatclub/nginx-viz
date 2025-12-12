import * as THREE from 'three';
import { AssetManager } from './assetManager';
import { Entity } from './entities/Entity';
import { CrawlerEntity } from './entities/CrawlerEntity';
import { MaliciousEntity } from './entities/MaliciousEntity';
import { HumanEntity } from './entities/HumanEntity';
import { EnvironmentSystem } from './environmentSystem';
import { LogEntry } from './types';
import { SoundPlayer } from './soundPlayer';

export class AgentSystem {
    private scene: THREE.Scene;
    private entities: Entity[] = [];
    private assetManager: AssetManager;
    private environmentSystem?: EnvironmentSystem;
    private camera?: THREE.Camera;
    private soundPlayer?: SoundPlayer;

    constructor(scene: THREE.Scene, assetManager: AssetManager, environmentSystem?: EnvironmentSystem, camera?: THREE.Camera, soundPlayer?: SoundPlayer) {
        this.scene = scene;
        this.assetManager = assetManager;
        this.environmentSystem = environmentSystem;
        this.camera = camera;
        this.soundPlayer = soundPlayer;
    }

    initNewAgent(agentString: string): void {
        try {
            const logEntry: LogEntry = JSON.parse(agentString);
            const ip = logEntry.ip;
            const country = logEntry.country;

            const pos = this.hashStringToPosition(ip);
            const color = this.hashStringToColor(ip);
            const statusCode = logEntry.status_code;

            let entity: Entity;

            if (this.isCrawler(logEntry.user_agent)) {
                const enemyObject = this.assetManager.loadedAssets.objects.get('public/assets/models/enemy.fbx');
                entity = new CrawlerEntity(this.scene, pos, enemyObject, logEntry, color, this.environmentSystem, statusCode, this.camera, this.soundPlayer);
            } else if (this.isMalicious(logEntry.url)) {
                const enemyObject = this.assetManager.loadedAssets.objects.get('public/assets/models/malicious.fbx');
                entity = new MaliciousEntity(this.scene, pos, enemyObject, logEntry, color, this.environmentSystem, statusCode, this.camera, this.soundPlayer);
            } else {
                const humanObject = this.assetManager.loadedAssets.objects.get('public/assets/models/running.fbx');
                entity = new HumanEntity(this.scene, pos, humanObject, logEntry, color, this.environmentSystem, statusCode, this.camera, this.soundPlayer);
            }

            this.entities.push(entity);
            
            // Play spawn sound
            if (this.soundPlayer) {
                this.soundPlayer.playSpawn();
            }
            entity.setFlag(country);

        } catch (e) {
            console.error('Error parsing log entry:', e);
        }
    }

    update(deltaTime: number = 0.016): void {
        // Update all entities and remove those that reached the center or ran away
        const entitiesToRemove: Entity[] = [];
        this.entities.forEach(entity => {
            entity.update(deltaTime);
            // Check if close to center
            const center = new THREE.Vector3(0, 0, 0);
            const distance = entity.position.distanceTo(center);

            if (distance < 0.1) {
                // Reached the center (successful)
                entitiesToRemove.push(entity);
            } else if (entity.isRejected && distance > 39) {
                // Rejected and moved far away
                entitiesToRemove.push(entity);
            }
        });
        // Remove entities
        entitiesToRemove.forEach(entity => {
            entity.destroy();
            const index = this.entities.indexOf(entity);
            if (index > -1) {
                this.entities.splice(index, 1);
            }
        });
    }

    private hashStringToColor(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
         // Ensure color is always a full 6-digit hex (0x100000 to 0xffffff)
        const color = 0x100000 + (Math.abs(hash) % 0xf00000);
        return color;
    }

    private hashStringToPosition(str: string): THREE.Vector3 {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        let x = Math.abs(hash % 10);
        let y = 0;
        let z = Math.abs((hash >> 16) % 10);

        // Ensure we don't have a zero vector (can't normalize)
        if (x === 0 && z === 0) {
            x = 1;
        }

        const position = new THREE.Vector3(x, y, z).normalize().multiplyScalar(40);
        return position;
    }

    private isCrawler(userAgent: string): boolean {
        const lowerUA = userAgent.toLowerCase();
        const crawlerPatterns = [
            'bot',
            'crawler',
            'spider',
            'googlebot',
            'bingbot',
            'yahoo',
            'slurp',
            'duckduckbot',
            'baiduspider',
            'yandexbot',
            'facebookexternalhit',
            'twitterbot',
            'linkedinbot',
            'whatsapp',
            'telegrambot'
        ];
        return crawlerPatterns.some(pattern => lowerUA.includes(pattern));
    }

    private isMalicious(url: string): boolean {
        const lowerUrl = url.toLowerCase();
        const maliciousPatterns = [
            "/env",
            "/.env",
            "/config",
            "/admin",
            "/phpinfo",
            "/server-status",
            "/wp-admin",
            "/xmlrpc.php",
            "/readme.txt",
            "/.git",
            "/.svn",
            "/debug",
            "/api/config",
            "/test",
            "/backup",
            "/db",
            "/sql",
            "/install",
            "/setup",
            ".php"
        ];
        return maliciousPatterns.some(pattern => lowerUrl.includes(pattern));
    }
}