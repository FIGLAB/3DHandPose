declare module "npyjs" {
  type Data =
    | Uint8Array
    | Uint16Array
    | Int8Array
    | Int32Array
    | BigUint64Array
    | BigInt64Array
    | Float32Array
    | Float64Array;
  type NumpyArray = { dtype: DataTypes; data: Data; shape: number[] };
  type DataTypes =
    | "uint8"
    | "int8"
    | "unit32"
    | "int32"
    | "uint64"
    | "int64"
    | "float32"
    | "float64";

  export default class {
    constructor();
    parse(arrayBufferContents: ArrayBuffer): NumpyArray;
    load(
      filename: string,
      callback?: (res: NumpyArray) => void
    ): Promise<NumpyArray>;
  }
}
