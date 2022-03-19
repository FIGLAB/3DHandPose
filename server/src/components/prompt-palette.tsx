import * as React from "react";
import { AsyncInterval, asyncInterval } from "../helpers/utils";

type PromptStatuses = {
  [key: string]: "current" | "visited" | "unvisited";
};

interface State {
  promptStatuses: PromptStatuses;
}

export class PromptPalette extends React.Component<{}, State> {
  private interval: AsyncInterval;

  constructor(props: {}) {
    super(props);
    this.state = { promptStatuses: {} };

    this.update = this.update.bind(this);
  }

  private async update() {
    const response = await fetch("/study/get-prompt-status", {
      method: "POST"
    });

    const promptStatuses = (await response.json()) as PromptStatuses;

    this.setState({ promptStatuses });
  }

  componentDidMount() {
    this.interval = asyncInterval(this.update, 1000);
  }

  componentWillUnmount() {
    this.interval.stop();
  }

  render() {
    return (
      <div style={{ width: "756px", marginTop: "4px" }}>
        {Object.entries(this.state.promptStatuses).map(
          ([prompt, status], index) => (
            <div
              key={index}
              style={{
                display: "inline-block",
                width: "80px",
                marginLeft: "4px"
              }}
            >
              <img
                style={{
                  display: "inline-block",
                  width: "100%",
                  opacity: status === "visited" ? 0.25 : 1,
                  borderStyle: status === "current" ? "solid" : "none",
                  borderWidth: "2px",
                  borderColor: "lime",
                  boxSizing: "border-box",
                  backgroundColor: "black"
                }}
                src={`/res/prompts/${prompt}.jpg`}
              />
              <span
                style={{
                  textAlign: "center",
                  width: "100%",
                  position: "relative",
                  top: "-8px"
                }}
              >
                {prompt}
              </span>
            </div>
          )
        )}
      </div>
    );
  }
}
