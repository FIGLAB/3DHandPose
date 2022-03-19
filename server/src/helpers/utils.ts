import { Matrix4 } from "three";
import { Matrix4x4 } from "./types";
import fetch from "node-fetch";

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function trace<T>(x: T) {
  console.log(x);
  return x;
}

export class AsyncInterval {
  private isRunning_ = true;

  get isRunning() {
    return this.isRunning_;
  }

  constructor(readonly callback: Function, readonly ms: number) {
    this.execute();
  }

  private async execute() {
    await Promise.all([sleep(this.ms), Promise.resolve(this.callback())]);
    if (this.isRunning_) this.execute();
  }

  stop() {
    this.isRunning_ = false;
  }
}

export function asyncInterval(callback: Function, ms: number) {
  return new AsyncInterval(callback, ms);
}

export function resourceExists(url: string) {
  const http = new XMLHttpRequest();

  http.open("HEAD", url, false);
  http.send();

  return http.status != 404;
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noop = () => {};

export function flatten(
  matrix: Matrix4x4
): [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];
export function flatten<T>(arr: T[][]): T[] {
  return [].concat(...arr);
}

export const yzTranspose = new Matrix4();
yzTranspose.set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);

export function cvtMatrix(mat: Matrix4x4) {
  let result = new Matrix4();
  result.set(...flatten(mat));
  result = result.premultiply(yzTranspose);
  return result;
}

export function setMatrix(obj: THREE.Object3D, mat: Matrix4) {
  obj.position.setFromMatrixPosition(mat);
  obj.scale.setFromMatrixScale(mat);
  obj.rotation.setFromRotationMatrix(mat);
}

export function onlyDefined<T extends object>(obj: T): Partial<T> {
  return Object.entries(obj).reduce(
    (a, [k, v]) => (v === undefined ? a : ((a[k] = v), a)),
    {} as any
  );
}

export const post = (url: string, body: any = {}) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

export function allRefs<T>(...refs: React.LegacyRef<T>[]) {
  return (elm: T) =>
    refs.forEach(ref => {
      if (!ref) return;

      // Legacy
      if (typeof ref === "string") {
        this.ref[ref] = elm;
        return;
      }

      // Function callback
      if (typeof ref === "function") {
        ref(elm);
        return;
      }

      // Object callback
      if (typeof ref === "object") {
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        ref.current = elm;
        return;
      }

      throw new TypeError("invalid arguments");
    });
}

export function download(filename: string, text: string) {
  var element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text)
  );
  element.setAttribute("download", filename);

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}
