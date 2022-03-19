import * as React from "react";
import * as ReactDOM from "react-dom";
import { allRefs } from "../helpers/utils";

interface GreyscalePlotProps extends React.ComponentProps<"canvas"> {
  image: number[][];
  pixelSize?: number;
  valueScale?: number;
}

export class GreyscalePlot extends React.Component<GreyscalePlotProps> {
  static defaultProps = {
    pixelSize: 1,
    valueScale: 1
  };

  private canvasRef = React.createRef<HTMLCanvasElement>();

  private drawImage() {
    if (this.canvasRef.current) {
      const { image, pixelSize, valueScale } = this.props;

      const height = image.length;
      const width = image[0].length;

      const ctx = this.canvasRef.current.getContext("2d");
      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          const v = image[i][j];
          ctx.fillStyle = `rgba(${v * valueScale}, ${v * valueScale}, ${v *
            valueScale}, 1)`;
          ctx.fillRect(j * pixelSize, i * pixelSize, pixelSize, pixelSize);
        }
      }
    }
  }

  componentDidMount() {
    this.drawImage();
  }

  componentDidUpdate(prevProps: Readonly<GreyscalePlotProps>) {
    if (
      prevProps.image !== this.props.image ||
      prevProps.pixelSize !== this.props.pixelSize ||
      prevProps.valueScale !== this.props.valueScale
    ) {
      this.drawImage();
    }
  }

  render() {
    const { image, pixelSize, valueScale, ref, ...canvasProps } = this.props;
    const height = image.length * pixelSize;
    const width = image[0].length * pixelSize;
    return (
      <canvas
        ref={allRefs(this.canvasRef, ref)}
        width={width}
        height={height}
        {...canvasProps}
      ></canvas>
    );
  }
}

interface ColorPlotProps extends React.ComponentProps<"canvas"> {
  image: [number, number, number][][];
  pixelSize?: number;
  valueScale?: number;
}

export class ColorPlot extends React.Component<ColorPlotProps> {
  static defaultProps = {
    pixelSize: 1,
    valueScale: 1
  };

  private canvasRef = React.createRef<HTMLCanvasElement>();

  private drawImage() {
    if (this.canvasRef.current) {
      const { image, pixelSize, valueScale } = this.props;

      const height = image.length;
      const width = image[0].length;

      const ctx = this.canvasRef.current.getContext("2d");
      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          const [r, g, b] = image[i][j];
          ctx.fillStyle = `rgba(${r * valueScale}, ${g * valueScale}, ${b *
            valueScale}, 1)`;
          ctx.fillRect(j * pixelSize, i * pixelSize, pixelSize, pixelSize);
        }
      }
    }
  }

  componentDidMount() {
    this.drawImage();
  }

  componentDidUpdate() {
    this.drawImage();
  }

  render() {
    const { image, pixelSize, valueScale, ref, ...canvasProps } = this.props;
    const height = image.length * pixelSize;
    const width = image[0].length * pixelSize;
    return (
      <canvas
        ref={allRefs(this.canvasRef, ref)}
        width={width}
        height={height}
        {...canvasProps}
      ></canvas>
    );
  }
}
