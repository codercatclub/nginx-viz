import { Object3D, Texture, Group, AnimationClip } from "three";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import { AssetType, getLoader, LoaderResult, loaders } from "./loaders";

const getFileExtension = (path: string) => path.split(".").pop() ?? "";
const isSupported = (ext: string): boolean =>
  Object.keys(loaders).includes(ext);

export interface LoadedAsset {
  objects: Map<string, Object3D>;
  animations: Map<string, AnimationClip[]>;
  textures: Map<string, Texture>;
  audio: Map<string, AudioBuffer>;
  sceneData: Map<string, unknown>;
}

export interface Asset {
  type: AssetType;
  src: string;
}

export class AssetManager {
  private _assets: Asset[] = [];
  private _textures: Map<string, Texture> = new Map();
  private _audio: Map<string, AudioBuffer> = new Map();
  private _objects: Map<string, Object3D> = new Map();
  private _animations: Map<string, AnimationClip[]> = new Map();
  private _sceneData: Map<string, unknown> = new Map();

  public get loadedAssets(): LoadedAsset {
    return {
      objects: this._objects,
      animations: this._animations,
      textures: this._textures,
      audio: this._audio,
      sceneData: this._sceneData
    };
  }

  public addAsset(src: string) {
    const extension = getFileExtension(src) as AssetType;

    if (!isSupported(extension)) {
      console.warn(`Asset type is not supported ${src}`);
      return this;
    }

    this._assets.push({ type: extension, src });

    return this;
  }

  public async load() {
    this.onLoadStart();

    // Initiate download for every asset and build a promise list
    const promises = this._assets.map((asset, idx) => {
      const loader = getLoader(asset.type);

      this.onItemLoadStart(idx, this._assets[idx].src);

      console.debug(`Start loading ${this._assets[idx].src}`)

      return loader(asset.src);
    }, [] as LoaderResult<Group | Texture>[]);

    let idx = 0;

    for (const p of promises) {
      p.then(() => {
        this.onItemLoadEnd(idx, this._assets.length);
        console.debug(`End loading ${this._assets[idx].src}`)
        idx++;
      });
    }

    const results = await Promise.allSettled(promises);

    // Store models that successfully loaded
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        const { type, src } = this._assets[i];

        switch (type) {
          case "glb":
            const gltf = result.value as GLTF;

            this._objects.set(src, gltf.scene);

            if (gltf.animations.length > 0) {
              const prevAnims = this._animations.get(src) || [];
              this._animations.set(src, prevAnims.concat(gltf.animations));
            }

            break;

          case "fbx":
            const obj = result.value as Object3D;

            if (obj.animations.length > 0) {
              const prevAnims = this._animations.get(src) || [];
              this._animations.set(src, prevAnims.concat(obj.animations));
            }

            this._objects.set(src, obj);
            break;

          case "jpg":
            const tex = result.value as Texture;
            this._textures.set(src, tex);
            break;
          case "png":
            const tex2 = result.value as Texture;
            this._textures.set(src, tex2);
            break;

          case "json":
            this._sceneData.set(src, result.value);
            break;

          case "mp3":
            const aBuff = result.value as AudioBuffer;
            this._audio.set(src, aBuff);
            break;

          default:
            break;
        }
      } else {
        const { responseURL, statusText } = result?.reason?.target;
        console.error(
          `Failed to load model ${responseURL}. Status: ${statusText}`
        );
      }
    });

    this.onLoadEnd();
  }

  public onLoadStart() {
    const event = new CustomEvent("on-load-start");
    window.dispatchEvent(event);
  }

  public onItemLoadStart(idx: number, src: string) {
    const event = new CustomEvent("on-item-load-start", {
      detail: { idx, src },
    });
    window.dispatchEvent(event);
  }

  public onItemLoadEnd(idx: number, total: number) {
    const event = new CustomEvent("on-item-load-end", {
      detail: { idx, total },
    });
    window.dispatchEvent(event);
  }

  public onLoadEnd() {
    const event = new CustomEvent("on-load-end");
    console.debug('All assets loaded')
    window.dispatchEvent(event);
  }
}
