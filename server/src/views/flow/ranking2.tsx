import * as React from "react";
import * as ReactDOM from "react-dom";
import { FlowMatchComponent } from "../../components/match";
import { GreyscalePlot } from "../../components/matrix";
import { AssetManager } from "../../helpers/assets";
import {
  computeNNFlowMatches,
  computeNormImage,
  FlowMatch,
  getMatrix
} from "../../helpers/comm";
import { AsyncInterval, asyncInterval } from "../../helpers/utils";

const Ranking = ({}) => {
  const poseNormImageManager = React.useRef(
    new AssetManager(async pose => (await computeNormImage({ pose })).image)
  );

  const [inputImage, setInputImage] = React.useState<number[][]>();
  const [inputNormImage, setInputNormImage] = React.useState<number[][]>();
  const [matches, setMatches] = React.useState<FlowMatch[]>();
  const [poseNormImages, setPoseNormImages] = React.useState<{
    [pose: string]: number[][];
  }>({});

  const [showFlow, setShowFlow] = React.useState(true);

  const interval = React.useRef<AsyncInterval>();

  /**
   *  Start update loop
   */
  const start = () => {
    if (interval.current?.isRunning) return;

    interval.current = asyncInterval(async () => {
      setInputImage(await getMatrix());
      setInputNormImage((await computeNormImage()).image);

      const matches = await computeNNFlowMatches({
        limit: 10,
        returnFlow: showFlow
      });
      const newPoseNormImages: typeof poseNormImages = {};
      await Promise.all(
        matches.map(
          async ({ pose }) =>
            (newPoseNormImages[
              pose
            ] = await poseNormImageManager.current.getAsset(pose))
        )
      );

      setMatches(matches);
      setPoseNormImages(newPoseNormImages);
    }, 1000 / 20);
  };

  /**
   * Stop update loop
   */
  const stop = () => {
    if (interval.current?.isRunning) {
      interval.current.stop();
    }
  };

  React.useEffect(() => {
    document.addEventListener("keydown", e => {
      if (e.key === " ") {
        interval.current?.isRunning ? stop() : start();
        e.preventDefault();
      }
    });
    start();
    return stop;
  }, []);

  const cardStyle: React.CSSProperties = {
    display: "inline-block",
    margin: "10px",
    verticalAlign: "top"
  };

  return (
    <div>
      <div>
        <input
          type="checkbox"
          name="showFlow"
          onChange={e => setShowFlow(e.currentTarget.checked)}
          checked={showFlow}
        />
        <label htmlFor="showFlow">Show Flow</label>
        <br />
        <i>Press space to pause/resume. Currently </i>
        <b>{interval.current?.isRunning ? "recording" : "paused"}</b>
      </div>
      <div>
        <h1>Input</h1>
        <div style={cardStyle}>
          <h2>Input Image</h2>
          {inputImage ? (
            <GreyscalePlot image={inputImage} pixelSize={8} />
          ) : (
            "loading..."
          )}
        </div>
        <div style={cardStyle}>
          <h2>Input Norm Image</h2>
          {inputNormImage ? (
            <GreyscalePlot image={inputNormImage} pixelSize={8} />
          ) : (
            "loading..."
          )}
        </div>
      </div>
      <div>
        <h1>Matches</h1>
        {matches
          ? matches.map((match, i) => (
              <FlowMatchComponent
                showFlow={showFlow}
                match={match}
                rank={i + 1}
                poseNormImage={poseNormImages[match.pose]}
                key={match.pose}
              />
            ))
          : "loading..."}
      </div>
    </div>
  );
};

ReactDOM.render(<Ranking />, document.getElementById("react-root"));
