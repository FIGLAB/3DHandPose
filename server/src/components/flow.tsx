import * as React from "react";
import { arrow } from "../helpers/canvas";

export const FlowField = ({
  flow,
  padding = 8,
  width = (flow[0].length + 2) * 8,
  height = (flow.length + 2) * 8,
  ...canvasProps
}: {
  flow: [number, number][][];
  padding?: number;
  width?: number;
  height?: number;
} & Omit<React.ComponentProps<"canvas">, "width" | "height">) => {
  const rows = flow.length;
  const cols = flow[0].length;

  const canvasRef = React.createRef<HTMLCanvasElement>();

  React.useEffect(() => {
    const mag = ([x, y]: [number, number]) => (x ** 2 + y ** 2) ^ (1 / 2);
    const maxMagnitude = Math.max(
      ...flow.map(row => Math.max(...row.map(mag)))
    );

    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    flow.forEach((row, i) =>
      row.forEach(([flowX, flowY], j) => {
        const scaleX = (width - 2 * padding) / cols;
        const scaleY = (height - 2 * padding) / rows;
        const x = padding + j * scaleX;
        const y = padding + i * scaleY;
        const dx = flowX * scaleX;
        const dy = flowY * scaleY;

        ctx.beginPath();
        arrow(ctx, x, y, x + dx, y + dy);

        ctx.fillStyle = `rgba(0,0,0,${mag([flowX, flowY]) / maxMagnitude})`;
        ctx.fill();
      })
    );
  }, [flow, padding, width, height]);
  return (
    <canvas {...canvasProps} width={width} height={height} ref={canvasRef} />
  );
};
