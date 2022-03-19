import * as React from "react";
import * as ReactDOM from "react-dom";
import { FlowField } from "../../components/flow";
import { FlowMatchComponent } from "../../components/match";
import { GreyscalePlot } from "../../components/matrix";
import { AssetManager } from "../../helpers/assets";
import {
  compute,
  computeHandPose,
  computeNNFlowMatches,
  computeNormImage,
  computeNormImageColorized,
  FlowMatch,
  getMatrix
} from "../../helpers/comm";
import { AsyncInterval, asyncInterval } from "../../helpers/utils";

const Blender = ({}) => {
  const poseNormImageManager = React.useRef(
    new AssetManager(async pose => (await computeNormImage({ pose })).image)
  );

  /**
   * Slider to warp between posed and flow
   */
  const fac = React.useRef<number>(1);

  const smoothing = React.useRef<number>(0.3);

  const noTransform = React.useRef(false);
  const [showSliders, setShowSliders] = React.useState(true);

  const scale = React.useRef(1);

  const [inputImage, setInputImage] = React.useState<number[][]>();
  const [inputNormImage, setInputNormImage] = React.useState<number[][]>();
  const [match, setMatch] = React.useState<FlowMatch>();
  const [poseNormImage, setPoseNormImage] = React.useState<number[][]>();

  const [showFlow, setShowFlow] = React.useState(true);
  const [flow, setFlow] = React.useState<[number, number][][]>();

  const interval = React.useRef<AsyncInterval>();

  const updateHandPose = ({
    useInputImage = false,
    pose = match.pose,
    smoothing_ = smoothing.current
  } = {}) =>
    computeHandPose({
      pose,
      returnFlow: true,
      fac: fac.current,
      scale: scale.current,
      smoothing: smoothing_,
      matrix: useInputImage ? [].concat(...inputImage) : undefined
    });

  const updateInputNormImage = async ({ useInputImage = false } = {}) => {
    setInputNormImage(
      (
        await computeNormImage({
          scale: scale.current,
          matrix: useInputImage ? [].concat(...inputImage) : undefined
        })
      ).image
    );
  };

  /**
   *  Start update loop
   */
  const start = () => {
    if (interval.current?.isRunning) return;

    interval.current = asyncInterval(async () => {
      setInputImage(await getMatrix());

      await updateInputNormImage();

      const match = (
        await computeNNFlowMatches({
          limit: 1,
          returnFlow: showFlow
        })
      )[0];
      setMatch(match);

      setPoseNormImage(await poseNormImageManager.current.getAsset(match.pose));

      await compute("update-cap-image");

      setFlow((await updateHandPose({ pose: match.pose })).flow);
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        interval.current?.isRunning ? stop() : start();
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    start();
    return () => {
      stop();
      removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const cardStyle: React.CSSProperties = {
    display: "inline-block",
    margin: "10px",
    verticalAlign: "top"
  };

  return (
    <div>
      <div>
        <i>Press space to pause/resume. Currently </i>
        <b>{interval.current?.isRunning ? "recording" : "paused"}</b>
        <br />
        <input
          type="checkbox"
          name="showFlow"
          onChange={e => setShowFlow(e.currentTarget.checked)}
          checked={showFlow}
        />
        <label htmlFor="showFlow">Show Flow</label>
        <br />
        <input
          type="checkbox"
          name="noTransform"
          onChange={e => {
            noTransform.current = e.currentTarget.checked;
            setShowSliders(!noTransform.current);
          }}
          defaultChecked={noTransform.current}
        />
        <label htmlFor="noTransform">
          Reference pose only{" "}
          <i>(only show the matched hand, without flow or transforms)</i>
        </label>
        <br />
        <br />
        <i>
          Control the amount of temporal smoothing when rendering the hand live
        </i>
        <br />
        faster{" "}
        <input
          type="range"
          min={0}
          max={0.9}
          step={0.01}
          onInput={e => {
            smoothing.current = +e.currentTarget.value;
          }}
          defaultValue={smoothing.current}
          disabled={!showSliders}
        />{" "}
        more smooth
        <br />
        <br />
        <i>
          Transition between reference pose (with basic transpose) and final
          hand pose with flow
        </i>
        <br />
        no flow{" "}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          onInput={e => {
            fac.current = +e.currentTarget.value;
            if (!interval.current?.isRunning) {
              updateHandPose({ useInputImage: true, smoothing_: 0 });
            }
          }}
          defaultValue={fac.current}
          disabled={!showSliders}
        />{" "}
        flow
        <br />
        <br />
        <i>Set the scaling factor for larger/smaller hands</i>
        <br />
        0.5
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.01}
          onInput={e => {
            scale.current = +e.currentTarget.value;
            if (!interval.current?.isRunning) {
              updateHandPose({ useInputImage: true, smoothing_: 0 });
              updateInputNormImage({ useInputImage: true });
            }
          }}
          defaultValue={scale.current}
        />
        1.5
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
        {showFlow && (
          <div style={cardStyle}>
            <h2>Flow (ref to input)</h2>
            {flow ? <FlowField flow={flow} /> : "loading..."}
          </div>
        )}
      </div>
      <div>
        <h1>Matches</h1>
        {match ? (
          <FlowMatchComponent
            match={match}
            poseNormImage={poseNormImage}
            showFlow={false}
          />
        ) : (
          "loading..."
        )}
      </div>
    </div>
  );
};

ReactDOM.render(<Blender />, document.getElementById("react-root"));
