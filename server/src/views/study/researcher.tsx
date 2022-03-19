import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  FlowMatch,
  computeNormImage,
  getMatrix,
  computeNormImageColorized
} from "../../helpers/comm";
import { GreyscalePlot, ColorPlot } from "../../components/matrix";
import { AssetManager } from "../../helpers/assets";
import { Vector3 } from "../../helpers/types";
import { sleep } from "../../helpers/utils";
import { PromptPalette } from "../../components/prompt-palette";
import { AutoRefreshImg } from "../../components/auto-refresh-img";

interface RecordResult {
  timeStamp: number;
  matrix: number[][];
  matches: FlowMatch[];
}

interface State {
  recordResult: RecordResult;
  inputNormImage: Vector3[][];
  poseMatrices: { [pose: string]: Vector3[][] };
}

class ResearcherView extends React.Component<{}, State> {
  private containerRef = React.createRef<HTMLDivElement>();
  private scale = 1;

  private poseMatrixManager = new AssetManager((pose: string) =>
    computeNormImageColorized({ pose })
  );

  constructor(props: {}) {
    super(props);
    this.state = { recordResult: null, inputNormImage: null, poseMatrices: {} };
    this.record = this.record.bind(this);
    this.reset = this.reset.bind(this);
  }

  private async record() {
    const response = await fetch("/study/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scale: this.scale })
    });
    const recordResult = (await response.json()) as RecordResult;
    const inputNormImage = await computeNormImageColorized({
      matrix: [].concat(...recordResult.matrix),
      scale: this.scale
    });

    const poseMatrices: { [pose: string]: Vector3[][] } = {};

    await Promise.all(
      recordResult.matches.map(
        async ({ pose }) =>
          (poseMatrices[pose] = await this.poseMatrixManager.getAsset(pose))
      )
    );

    await sleep(2000);

    this.setState({ recordResult, inputNormImage, poseMatrices });
  }

  private async recalculateNormImage(scale: number) {
    this.scale = scale;
    const inputNormImage = await computeNormImageColorized({
      matrix: [].concat(...this.state.recordResult.matrix),
      scale: this.scale
    });
    this.setState({ inputNormImage });
  }

  private async reset() {
    await fetch("/study/reset", { method: "POST" });
    this.setState({ recordResult: null, inputNormImage: null });
  }

  focus() {
    this.containerRef.current.focus();
  }

  render() {
    const { recordResult, inputNormImage, poseMatrices } = this.state;

    const cardStyle: React.CSSProperties = {
      display: "inline-block",
      margin: "10px",
      verticalAlign: "top"
    };

    return (
      <div
        ref={this.containerRef}
        tabIndex={0}
        onKeyDown={event =>
          event.key === " " && [this.record(), event.preventDefault()]
        }
      >
        <div>
          <input type="button" value="Record" onClick={this.record} />
          {/* <input type="button" value="Reset" onClick={this.reset} /> */}
          <input
            type="button"
            value="Send"
            onClick={() => fetch("/study/send", { method: "POST" })}
          />
        </div>
        <PromptPalette />
        {recordResult && (
          <div>
            <p>Timestamp: {recordResult.timeStamp}</p>
            <p>Input:</p>
            <input
              type="range"
              min={0}
              max={2}
              step={0.01}
              defaultValue={1}
              onInput={e => this.recalculateNormImage(+e.currentTarget.value)}
            />
            <div>
              <div style={cardStyle}>
                <p>Cap Image:</p>
                <GreyscalePlot image={recordResult.matrix} pixelSize={5} />
              </div>
              <div style={cardStyle}>
                <p>Norm Image:</p>
                <ColorPlot image={inputNormImage} pixelSize={5} />
              </div>
            </div>
            <p>Rendered Image:</p>
            <AutoRefreshImg
              src={`/output/${recordResult.timeStamp}-render.png`}
              style={{ width: "400px" }}
            />
            <p>Matches:</p>
            {recordResult.matches.map(match => (
              <div key={match.pose}>
                <p>Pose: {match.pose}</p>
                <div style={cardStyle}>
                  <p>Norm Image:</p>
                  <ColorPlot image={poseMatrices[match.pose]} pixelSize={5} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}

const component = React.createRef<ResearcherView>();
ReactDOM.render(
  <ResearcherView ref={component} />,
  document.getElementById("react-root")
);
component.current.focus();
