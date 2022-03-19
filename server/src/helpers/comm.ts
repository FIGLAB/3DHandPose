import { Vector3, Matrix2x3, Matrix4x4 } from "./types";
import { sleep, onlyDefined } from "./utils";

export type KeyPoint = { pt: [number, number]; size: number };

export async function compute(task: string, params = {} as unknown) {
  const response = await fetch("/compute/" + task, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  return await response.json();
}

export async function getMatrix(pose?: string) {
  if (!pose) {
    const response = await fetch("/data/matrix", { method: "POST" });
    const matrix = await response.json();
    return matrix as number[][];
  } else {
    return compute("get-matrix", { pose }) as Promise<number[][]>;
  }
}

export const computeTinyImage = (pose?: string) =>
  compute("get-tiny-image", { pose }) as Promise<{
    image: number[][];
    transform: Matrix2x3;
  }>;

export const computeNormImage = ({
  pose = undefined as string,
  matrix = undefined as number[],
  scale = undefined as number
} = {}) =>
  compute("get-norm-image", onlyDefined({ pose, matrix, scale })) as Promise<{
    image: number[][];
    transform: number[][];
  }>;

export const computeNormImageColorized = ({
  pose = undefined as string,
  matrix = undefined as number[],
  scale = undefined as number
} = {}) =>
  compute(
    "get-norm-image-colorized",
    onlyDefined({ pose, matrix, scale })
  ) as Promise<Vector3[][]>;

export type FlowMatch = {
  pose: string;
  cost: number;
  flowMag: number;
  warpedImage?: number[][];
  warpedImageColorized?: Vector3[][];
  flow?: [number, number][][];

  /**
   * Represents the transformation from the reference image to the source
   * image (without flow)
   */
  transform: Matrix2x3;
};

export const computeNNFlowMatches = ({
  limit = 1,
  k = 10,
  scale = 1,
  returnWarpedImage = false,
  returnWarpedImageColorized = false,
  returnFlow = false,
  returnTransform = false
} = {}) =>
  compute("match-nn-flow", {
    limit,
    k,
    scale,
    returnWarpedImage,
    returnFlow,
    returnWarpedImageColorized,
    returnTransform
  }) as Promise<FlowMatch[]>;

export const computeHandPose = ({
  pose = undefined as string,
  returnFlow = undefined as boolean,
  fac = undefined as number,
  smoothing = undefined as number,
  matrix = undefined as number[][],
  noTransform = undefined as boolean,
  scale = undefined as number
}) =>
  compute(
    "compute-hand-pose",
    onlyDefined({
      pose,
      returnFlow,
      fac,
      smoothing,
      matrix,
      noTransform,
      scale
    })
  ) as Promise<{
    armature: Matrix4x4;
    bones: { [name: string]: Matrix4x4 };
    flow?: [number, number][][];
  }>;
