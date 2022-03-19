import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  InteractiveImageViewer,
  convertClientToImage,
  convertImageToClient
} from "../../components/image";
import { allRefs, noop, download } from "../../helpers/utils";
import npyjs from "npyjs";

const incrementLabel = (label: string) => {
  const matches = label.match(/^(.*?)(\d*)$/);
  return `${matches[1]}${+(matches[2] ?? 0) + 1}`;
};

const reshape = (data: number[], shape: [number, number]) => {
  return new Array(shape[0])
    .fill(null)
    .map((row, i) => data.slice(i * shape[1], (i + 1) * shape[1]));
};

const loadImage = (src: File | string) =>
  new Promise<HTMLImageElement>(resolve => {
    const image = new Image() as HTMLImageElement;
    image.onload = e => resolve(image);
    image.src = typeof src === "string" ? src : URL.createObjectURL(src);
  });

interface DepthData {
  getDepth(x: number, y: number): number;
  destroy?(): void;
}

const depthDataFromFile = async (src: string): Promise<DepthData> => {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d").drawImage(image, 0, 0, image.width, image.height);
  return {
    getDepth: (x, y) => {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) return NaN;
      const [r, g, b, a] = canvas
        .getContext("2d")
        .getImageData(x, y, 1, 1).data;
      return a ? (1 - r / 255) * 32 * 4.22 : Infinity;
    },
    destroy: () => {
      image.remove();
      canvas.remove();
    }
  };
};

const loadFile = async (file: File) => {
  const ext = file.name.match(/\.(.*?)$/)[1];

  if (ext === "npy") {
    const { data, shape } = new npyjs().parse(await file.arrayBuffer()) as {
      data: Uint16Array;
      shape: number[];
    };

    const array = reshape([...data], [shape[0], shape[1]]).reverse();
    const depth: DepthData = { getDepth: (x, y) => array[y]?.[x] ?? NaN };

    const image = array.map(row => row.map(x => ((900 - x) / 200) * 255));

    return { depth, src: image };
  } else if (ext === "png") {
    const src = URL.createObjectURL(file);
    const depth = await depthDataFromFile(src);

    return { depth, src };
  }

  return { src: URL.createObjectURL(file) };
};

type LabeledPoint = { x: number; y: number; label: string };

const Point = React.forwardRef(
  (
    {
      point,
      transform,
      editing = false,
      onChange = noop,
      ...containerProps
    }: {
      point: LabeledPoint;
      transform: {
        clientLeft: number;
        clientTop: number;
        scale: number;
        translation: [number, number];
      };
      editing?: boolean;
    } & Omit<React.ComponentProps<"div">, "onChange"> &
      Pick<React.ComponentProps<"input">, "onChange">,
    ref: React.Ref<HTMLDivElement>
  ) => {
    const inputRef = React.useRef<HTMLInputElement>();
    const [x, y] = convertImageToClient(point.x, point.y, transform);
    return (
      <div
        {...containerProps}
        ref={ref}
        style={{
          position: "absolute",
          left: `${x}px`,
          top: `${y}px`,
          width: "40px",
          height: "40px",
          borderRadius: "0 20px 20px 20px",
          backgroundColor: "rgba(0, 100, 255, 0.5)",
          textAlign: "center",
          lineHeight: "40px",
          userSelect: "none",
          fontSize: "16px",
          ...(containerProps.style ?? {})
        }}
        onFocus={() => inputRef.current?.focus()}
        onBlur={() => inputRef.current?.blur()}
      >
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={point.label}
            style={{
              textAlign: "center",
              borderStyle: "none",
              backgroundColor: "transparent",
              height: "40px",
              width: "40px",
              padding: "0",
              fontSize: "16px"
            }}
            onChange={onChange}
          />
        ) : (
          point.label
        )}
      </div>
    );
  }
);

const Labeler = () => {
  const [containerRef, setContainerRef] = React.useState(
    React.createRef<HTMLDivElement>()
  );

  const [imageName, setImageName] = React.useState("");
  const [imageSrc, setImageSrc] = React.useState<string | number[][]>("");
  const depthData = React.useRef<DepthData>();

  const [scale, setScale] = React.useState(1);
  const [translation, setTranslation] = React.useState<[number, number]>([
    0,
    0
  ]);

  const transform = {
    clientLeft: containerRef.current?.clientLeft ?? 0,
    clientTop: containerRef.current?.clientTop ?? 0,
    scale,
    translation
  };

  const [points, setPoints] = React.useState<LabeledPoint[]>([]);
  const pointRefs = React.useRef<Map<LabeledPoint, HTMLDivElement>>(new Map());

  const dragOffset = [20, 20];

  const [lastDown, setLastDown] = React.useState<[number, number]>(null);
  const [lastClickedPoint, setLastClickedPoint] = React.useState<LabeledPoint>(
    null
  );

  const [pointToDrag, setPointToDrag] = React.useState<LabeledPoint>(null);
  const [pointToEdit, setPointToEdit] = React.useState<LabeledPoint>(null);

  return (
    <div>
      <InteractiveImageViewer
        ref={el => {
          allRefs(containerRef)(el);
          setContainerRef(containerRef);
        }}
        src={imageSrc}
        onScaleChange={setScale}
        onTranslationChange={setTranslation}
        onMouseDown={e => {
          if (e.button === 0) {
            setLastDown([e.clientX, e.clientY]);
            setLastClickedPoint(null);
          }
        }}
        onMouseMove={e => {
          if (e.buttons & 1 && pointToDrag) {
            [pointToDrag.x, pointToDrag.y] = convertClientToImage(
              e.clientX - dragOffset[0],
              e.clientY - dragOffset[1],
              transform
            );
            setPoints([...points]);

            e.preventDefault();
          }
        }}
        onMouseUp={e => {
          if (e.button === 0) {
            const wasClick =
              !lastDown ||
              (e.clientX - lastDown[0]) ** 2 + (e.clientY - lastDown[1]) ** 2 <
                5 ** 2;

            if (wasClick && !pointToDrag) {
              const [x, y] = convertClientToImage(
                e.clientX,
                e.clientY,
                transform
              );
              const label = incrementLabel(
                points[points.length - 1]?.label ?? "0"
              );
              setPoints([...points, { x, y, label }]);
            }

            if (wasClick) {
              setPointToEdit(lastClickedPoint);
            }

            setLastDown(null);
            setPointToDrag(null);
          }
        }}
        style={{
          width: "100vw",
          height: "100vh",
          position: "absolute",
          top: 0,
          left: 0
        }}
      />
      {points.map((point, i) => (
        <Point
          ref={elm => pointRefs.current?.set(point, elm)}
          key={i}
          point={point}
          transform={transform}
          editing={point === pointToEdit}
          onMouseDown={e => {
            if (e.button === 0) {
              setLastDown([e.clientX, e.clientY]);
              setLastClickedPoint(point);
              setPointToDrag(point);
            }
          }}
          style={{
            pointerEvents: pointToDrag ? "none" : "auto"
          }}
          onChange={e => {
            point.label = e.currentTarget.value;
            setPoints([...points]);
          }}
          onKeyDown={e => {
            if (e.key === "Delete") {
              setPoints([...points.slice(0, i), ...points.slice(i + 1)]);
            }
          }}
        />
      ))}
      <div style={{ position: "absolute", left: 10, top: 10 }}>
        <input
          type="file"
          onChange={async e => {
            setImageName(e.currentTarget.files[0].name);
            const { depth, src } = await loadFile(e.currentTarget.files[0]);
            depthData.current?.destroy?.();
            depthData.current = depth;
            setImageSrc(src);

            setPoints([]);
            pointRefs.current.clear();
          }}
        />
        <input
          type="button"
          value="export"
          onClick={() =>
            download(
              `${imageName.match(/^(.*)\.(.*?)$/)[1]}.json`,
              JSON.stringify({
                image: imageName,
                points: points.map(point => ({
                  ...point,
                  z: depthData.current.getDepth(
                    Math.round(point.x),
                    Math.round(point.y)
                  )
                }))
              })
            )
          }
        />
      </div>
    </div>
  );
};

document.getElementsByTagName("body")[0].style.overflow = "hidden";
ReactDOM.render(<Labeler />, document.getElementById("react-root"));
