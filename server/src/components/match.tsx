import React from "react";
import { FlowMatch } from "../helpers/comm";
import { FlowField } from "./flow";
import { GreyscalePlot } from "./matrix";

const cardStyle: React.CSSProperties = {
  display: "inline-block",
  margin: "10px",
  verticalAlign: "top"
};

export const FlowMatchComponent = ({
  match,
  poseNormImage,
  showFlow,
  rank
}: {
  match: FlowMatch;
  poseNormImage: number[][];
  showFlow: boolean;
  rank?: number;
}) => (
  <div style={cardStyle}>
    <h3 style={{ margin: "0 0 0 10px" }}>
      {rank && `#${rank}, `}Pose: {match.pose}, Cost: {match.cost.toFixed(2)}
    </h3>
    <div style={cardStyle}>
      <h2>Reference Norm Image</h2>
      {poseNormImage ? (
        <GreyscalePlot image={poseNormImage} pixelSize={8} />
      ) : (
        "loading..."
      )}
    </div>
    {showFlow && (
      <div style={cardStyle}>
        <h2>Flow (input to ref)</h2>
        {match.flow ? <FlowField flow={match.flow} /> : "loading..."}
      </div>
    )}
  </div>
);
