import { GLTFLoader, GLTF } from "three/examples/jsm/loaders/GLTFLoader";

export class AssetManager<T> {
  private maxModelsLoaded: number;

  private loadedAssets = {} as { [key: string]: T };
  private loadOrder = [] as string[]; // order in which models have been loaded, earliest first

  constructor(
    private load: (key: string) => T | Promise<T>,
    { maxModelsLoaded = -1 } = {}
  ) {
    this.maxModelsLoaded = maxModelsLoaded;
  }

  async loadAsset(...keys: string[]) {
    if (
      (this.maxModelsLoaded == 0 && keys.length > 1) ||
      (this.maxModelsLoaded > 0 && keys.length > this.maxModelsLoaded)
    ) {
      throw new Error(
        `Too many assets to load (keys.length = ${keys.length} > maxModelsLoaded = ${this.maxModelsLoaded})`
      );
    }

    this.loadOrder = this.loadOrder.filter(key => !keys.includes(key));
    this.loadOrder.push(...keys);

    if (this.loadOrder.length > this.maxModelsLoaded) {
      const assetsToRemove = this.loadOrder.splice(
        0,
        this.loadOrder.length - this.maxModelsLoaded
      );
      assetsToRemove.forEach(key => delete this.loadedAssets[key]);
    }

    await Promise.all(
      keys.map(
        async key =>
          (this.loadedAssets[key] = await Promise.resolve(this.load(key)))
      )
    );
  }

  async getAsset(key: string) {
    if (!(key in this.loadedAssets)) {
      await this.loadAsset(key);
    }
    return this.loadedAssets[key];
  }
}

export async function loadGLTF(
  path: string,
  loader = new GLTFLoader()
): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    loader.load(path, resolve, null, reject);
  });
}

export class SingletonAssetManager<T> {
  private asset: T;
  constructor(private load: () => T | Promise<T>) {}

  async loadAsset() {
    this.asset = await Promise.resolve(this.load());
  }

  async getAsset() {
    if (!this.asset) {
      await this.loadAsset();
    }
    return this.asset;
  }
}
