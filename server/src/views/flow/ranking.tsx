import * as React from "react";
import * as ReactDOM from "react-dom";
import { sleep } from "../../helpers/utils";
import {
  getMatrix,
  computeNormImage,
  FlowMatch,
  computeNormImageColorized,
  computeNNFlowMatches
} from "../../helpers/comm";
import { GreyscalePlot, ColorPlot } from "../../components/matrix";
import { cancelable, CancelablePromiseType } from "cancelable-promise";
import { AssetManager } from "../../helpers/assets";

interface FlowMatchesState {
  inputMatrix: number[][];
  inputNormImage: number[][];
  matches: (FlowMatch & {
    refMatrix: number[][];
    refNormImage: [number, number, number][][];
  })[];
}

class FlowMatches extends React.Component<{}, FlowMatchesState> {
  private updatePromise = null as CancelablePromiseType<void>;

  private poseMatrixManager = new AssetManager(getMatrix);
  private poseNormImageManager = new AssetManager((pose: string) =>
    computeNormImageColorized({ pose })
  );

  async update() {
    const timeout = sleep(100);

    const [
      inputMatrix,
      { image: inputNormImage },
      flowMatches
    ] = await Promise.all([
      getMatrix(),
      computeNormImage(),
      computeNNFlowMatches({
        limit: 10,
        k: 10,
        returnWarpedImage: true
      })
    ]);

    const matches = await Promise.all(
      flowMatches.map(async match => ({
        ...match,
        refMatrix: await this.poseMatrixManager.getAsset(match.pose),
        refNormImage: await this.poseNormImageManager.getAsset(match.pose)
      }))
    );

    this.setState({ inputMatrix, inputNormImage, matches });

    await timeout; // ensure at least 100 ms has passed
    this.updatePromise = cancelable(this.update());
  }

  componentDidMount() {
    this.update();
  }

  componentWillUnmount() {
    if (this.updatePromise) this.updatePromise.cancel();
  }

  render() {
    if (!this.state) {
      return <p>Loading...</p>;
    }

    const { inputMatrix, inputNormImage, matches } = this.state;

    const pixelSize = 5;

    return (
      <>
        <div>
          <div style={{ width: "30%", float: "left" }}>
            <div>
              <GreyscalePlot image={inputMatrix} pixelSize={pixelSize} />
            </div>
            <div>
              <GreyscalePlot image={inputNormImage} pixelSize={pixelSize} />
            </div>
          </div>
          <div
            style={{
              width: "70%",
              float: "left",
              height: "100vh",
              overflow: "scroll"
            }}
          >
            {matches.map((match, i) => (
              <div key={match.pose} style={{ clear: "left" }}>
                <br />
                <br />
                <p>
                  Match {i}: cost = {match.cost}, flow mag = {match.flowMag}
                </p>
                <div>
                  <div style={{ width: "33%", float: "left" }}>
                    <p>Warped Input</p>
                    <GreyscalePlot
                      image={match.warpedImage}
                      pixelSize={pixelSize}
                    />
                  </div>
                  <div style={{ width: "33%", float: "left" }}>
                    <p>Reference (Normed)</p>
                    <ColorPlot
                      image={match.refNormImage}
                      pixelSize={pixelSize}
                    />
                  </div>
                  <div style={{ width: "33%", float: "left" }}>
                    <p>Reference</p>
                    <GreyscalePlot
                      image={match.refMatrix}
                      pixelSize={pixelSize}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }
}

ReactDOM.render(<FlowMatches />, document.getElementById("react-root"));
