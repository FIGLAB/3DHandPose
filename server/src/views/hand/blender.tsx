import * as React from "react";
import * as ReactDOM from "react-dom";
import { asyncInterval, AsyncInterval } from "../../helpers/utils";
import {
  computeNNFlowMatches,
  computeHandPose,
  getMatrix,
  computeNormImage,
  compute
} from "../../helpers/comm";
import { GreyscalePlot, ColorPlot } from "../../components/matrix";
import { Vector3 } from "../../helpers/types";

interface State {
  inputMatrix: number[][];
  inputNormImage: number[][];
  warpedImageColorized: Vector3[][];
  pose: string;
}

export class BlenderController extends React.Component<{}, State> {
  private interval: AsyncInterval;

  constructor(props: {}) {
    super(props);
    this.state = null;
    this.update = this.update.bind(this);
  }

  private async update() {
    const [
      inputMatrix,
      //{image: inputNormImage}
      { pose, warpedImageColorized }
    ] = await Promise.all([
      getMatrix(),
      // computeNormImage(),
      (async () => {
        const matches = await computeNNFlowMatches({
          limit: 1,
          k: 0
          // returnWarpedImageColorized: true
        });

        const { pose, warpedImageColorized } = matches[0];
        await Promise.all([
          compute("update-cap-image"),
          computeHandPose({ pose })
        ]);

        return { pose, warpedImageColorized };
      })()
    ]);

    this.setState({
      inputMatrix,
      //inputNormImage,
      warpedImageColorized,
      pose
    });
  }

  componentDidMount() {
    this.interval = asyncInterval(this.update, 1000 / 10);
  }

  componentWillUnmount() {
    this.interval.stop();
  }

  render() {
    if (!this.state) {
      return <p>Loading...</p>;
    }

    const {
      inputMatrix,
      inputNormImage,
      warpedImageColorized,
      pose
    } = this.state;

    const cardStyle: React.CSSProperties = {
      display: "inline-block",
      margin: "10px",
      verticalAlign: "top"
    };

    const inlineStyle: React.CSSProperties = {
      display: "inline"
    };

    return (
      <>
        <div>
          <div style={cardStyle}>
            <h2>Input Pose</h2>
            <GreyscalePlot image={inputMatrix} pixelSize={8} />
          </div>
          {/* <div style={cardStyle}>
            <h2>Input Norm Image</h2>
            <GreyscalePlot image={inputNormImage} pixelSize={6} />
          </div> */}
        </div>
        <div style={cardStyle}>
          <h2 style={inlineStyle}>Matched Pose</h2>
          <p style={{ ...inlineStyle, marginLeft: "20px" }}>{pose}</p>
        </div>
        {/* <div>
          <div style={cardStyle}>
            <h2>Input Norm Image (Warped)</h2>
            <ColorPlot image={warpedImageColorized} pixelSize={6} />
          </div>
        </div> */}
      </>
    );
  }
}

ReactDOM.render(<BlenderController />, document.getElementById("react-root"));
