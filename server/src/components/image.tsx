import * as React from "react";
import { allRefs, noop } from "../helpers/utils";
import { GreyscalePlot } from "./matrix";

export const ImageViewer = React.forwardRef(
  (
    {
      src,
      translation = [0, 0],
      scale = 1,
      ...containerProps
    }: {
      src: string | number[][];
      scale: number;
      translation: [number, number];
    } & React.ComponentProps<"div">,
    ref: React.Ref<HTMLDivElement>
  ) => {
    const [containerRef, setContainerRef] = React.useState(
      React.createRef<HTMLDivElement>()
    );

    const top = `${(containerRef.current?.clientTop ?? 0) + translation[1]}px`;
    const left = `${(containerRef.current?.clientLeft ?? 0) +
      translation[0]}px`;

    return (
      <div
        {...containerProps}
        style={{
          overflow: "hidden",
          position: "relative",
          ...(containerProps.style ?? {})
        }}
        ref={elm => {
          allRefs(containerRef, ref ?? noop)(elm);
          setContainerRef(containerRef);
        }}
      >
        {typeof src === "string" ? (
          <img
            src={src}
            style={{
              position: "absolute",
              top,
              left,
              transformOrigin: "top left",
              transform: `scale(${scale},${scale})`
            }}
          />
        ) : (
          <GreyscalePlot
            image={src}
            style={{
              position: "absolute",
              top,
              left,
              transformOrigin: "top left",
              transform: `scale(${scale},${scale})`
            }}
          />
        )}
      </div>
    );
  }
);

export function convertClientToImage(
  clientX: number,
  clientY: number,
  {
    clientLeft,
    clientTop,
    scale,
    translation
  }: {
    clientLeft: number;
    clientTop: number;
    scale: number;
    translation: [number, number];
  }
) {
  const x = (clientX - clientLeft - translation[0]) / scale;
  const y = (clientY - clientTop - translation[1]) / scale;
  return [x, y];
}

export function convertImageToClient(
  imageX: number,
  imageY: number,
  {
    clientLeft,
    clientTop,
    scale,
    translation
  }: {
    clientLeft: number;
    clientTop: number;
    scale: number;
    translation: [number, number];
  }
) {
  const x = imageX * scale + translation[0] + clientLeft;
  const y = imageY * scale + translation[1] + clientTop;
  return [x, y];
}

export const InteractiveImageViewer = React.forwardRef(
  (
    {
      onScaleChange = noop,
      onTranslationChange = noop,
      ...imageViewerProps
    }: {
      onScaleChange: (scale: number, prevScale: number) => void;
      onTranslationChange: (
        translation: [number, number],
        prevTranslation: [number, number]
      ) => void;
    } & Omit<React.ComponentProps<typeof ImageViewer>, "scale" | "translation">,
    ref: React.Ref<HTMLDivElement>
  ) => {
    const [containerRef, setContainerRef] = React.useState(
      React.createRef<HTMLDivElement>()
    );
    const [scale, setScale] = React.useState(1);
    const [translation, setTranslation] = React.useState<[number, number]>([
      0,
      0
    ]);

    return (
      <ImageViewer
        {...imageViewerProps}
        ref={elm => {
          allRefs(containerRef, ref ?? noop)(elm);
          setContainerRef(containerRef);
        }}
        onWheel={e => {
          const newScale = scale * Math.exp(-e.deltaY / 1000);

          const containerBounds = {
            clientLeft: containerRef.current?.clientLeft,
            clientTop: containerRef.current?.clientTop
          };
          const [x1, y1] = convertClientToImage(e.clientX, e.clientY, {
            scale,
            translation,
            ...containerBounds
          });
          const [x2, y2] = convertClientToImage(e.clientX, e.clientY, {
            scale: newScale,
            translation,
            ...containerBounds
          });
          const newTranslation: [number, number] = [
            translation[0] + (x2 - x1) * newScale,
            translation[1] + (y2 - y1) * newScale
          ];

          onScaleChange(newScale, scale);
          onTranslationChange(newTranslation, translation);
          setScale(newScale);
          setTranslation(newTranslation);

          imageViewerProps.onWheel?.(e);
          e.preventDefault();
        }}
        onMouseMove={e => {
          imageViewerProps.onMouseMove?.(e);

          if (e.isDefaultPrevented()) return;

          if (e.buttons & 1) {
            const newTranslation: [number, number] = [
              translation[0] + e.movementX,
              translation[1] + e.movementY
            ];
            onTranslationChange(newTranslation, translation);
            setTranslation(newTranslation);

            e.preventDefault();
          }
        }}
        scale={scale}
        translation={translation}
      />
    );
  }
);
