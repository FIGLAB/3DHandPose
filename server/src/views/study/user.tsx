import * as React from "react";
import * as ReactDOM from "react-dom";
import { asyncInterval, AsyncInterval, sleep, post } from "../../helpers/utils";

import "../../../css/app.css";

const pLable: React.CSSProperties = {
  display: "inline-grid",
  padding: "5px"
};

const AgreeDisagreeButtons = ({
  name,
  onChange
}: {
  name: string;
  onChange: (value: number) => void;
}) => (
  <div>
    <p style={pLable}>Strongly Disagree</p>
    <label htmlFor={`${name}rating1`} title="1">
      1
      <br />
      <input
        type="radio"
        id={`${name}rating1`}
        name={name}
        value="1"
        onClick={() => onChange(1)}
      />
    </label>
    <label htmlFor={`${name}rating2`} title="2">
      2
      <br />
      <input
        type="radio"
        id={`${name}rating2`}
        name={name}
        value="2"
        onClick={() => onChange(2)}
      />
    </label>
    <label htmlFor={`${name}rating3`} title="3">
      3
      <br />
      <input
        type="radio"
        id={`${name}rating3`}
        name={name}
        value="3"
        onClick={() => onChange(3)}
      />
    </label>
    <label htmlFor={`${name}rating4`} title="4">
      4
      <br />
      <input
        type="radio"
        id={`${name}rating4`}
        name={name}
        value="4"
        onClick={() => onChange(4)}
      />
    </label>
    <label htmlFor={`${name}rating5`} title="5">
      5
      <br />
      <input
        type="radio"
        id={`${name}rating5`}
        name={name}
        value="5"
        onClick={() => onChange(5)}
      />
    </label>
    <label htmlFor={`${name}rating6`} title="6">
      6
      <br />
      <input
        type="radio"
        id={`${name}rating6`}
        name={name}
        value="6"
        onClick={() => onChange(6)}
      />
    </label>
    <label htmlFor={`${name}rating7`} title="7">
      7
      <br />
      <input
        type="radio"
        id={`${name}rating7`}
        name={name}
        value="7"
        onClick={() => onChange(7)}
      />
    </label>
    <p style={pLable}>Strongly Agree</p>
    <br />
  </div>
);

const getDescription = async (prompt: string) => {
  const res = await fetch(`/res/prompt-descriptions/${prompt}.txt`);
  if (res.ok) {
    return await res.text();
  }
  return "";
};

interface State {
  isResultReady: boolean;
  timeStamp: number;
  prompt: string;
  description: string;
  response1?: number;
  response2?: number;
  response3: string;
}

async function poll<R = unknown>(
  url: string,
  interval: number,
  condition: (result: R) => boolean
): Promise<R> {
  while (true) {
    const response = await fetch(url, { method: "POST" });
    const result = (await response.json()) as R;
    if (condition(result)) {
      return result;
    }
    await sleep(interval);
  }
}

class UserComponent extends React.Component<{}, State> {
  private interval: AsyncInterval;

  constructor(props: {}) {
    super(props);
    this.state = {
      isResultReady: false,
      timeStamp: 0,
      prompt: null,
      description: "",
      response3: ""
    };
    this.update = this.update.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  async update() {
    const url = "/study/get";
    const interval = 100;
    type Result = { isResultReady: boolean; timeStamp: number };
    const condition = (result: Result) =>
      (result.isResultReady && result.timeStamp != this.state.timeStamp) ||
      (this.state.isResultReady && !result.isResultReady);

    const result = await poll<Result>(url, interval, condition);

    this.setState({
      isResultReady: result.isResultReady,
      timeStamp: result.timeStamp
    });
  }

  async componentDidMount() {
    this.interval = asyncInterval(this.update, 100);

    const res1 = await fetch("/study/current-prompt", { method: "POST" });
    let prompt = await res1.text();
    if (!prompt) {
      await fetch("/study/advance-prompt", { method: "POST" });
      const res2 = await fetch("/study/current-prompt", { method: "POST" });
      prompt = await res2.text();
    }

    const description = await getDescription(prompt);

    this.setState({ prompt, description });
  }

  componentWillUnmount() {
    this.interval.stop();
  }

  private async handleSubmit() {
    const { timeStamp, prompt, response1, response2, response3 } = this.state;
    await fetch("/study/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeStamp,
        prompt,
        response1,
        response2,
        response3
      })
    });

    await fetch("/study/reset", { method: "POST" });
    await fetch("/study/advance-prompt", { method: "POST" });
    const res = await fetch("/study/current-prompt", { method: "POST" });
    const newPrompt = await res.text();

    const description = await getDescription(newPrompt);

    this.setState({
      prompt: newPrompt,
      description,
      response1: undefined,
      response2: undefined,
      response3: ""
    });
  }

  render() {
    const {
      isResultReady,
      timeStamp,
      prompt,
      description,
      response1,
      response2
    } = this.state;

    const leftContent: React.CSSProperties = {
      float: "left"
    };

    const handimage: React.CSSProperties = {
      width: "100%"
    };

    const pHeading: React.CSSProperties = {
      padding: "40px 0px 0px 0px"
    };

    const inputButton: React.CSSProperties = {
      width: "150px",
      height: "50px",
      fontSize: "1.4em"
    };

    const inputText: React.CSSProperties = {
      width: "600px",
      height: "100px"
    };

    const divPreview: React.CSSProperties = {
      width: "600px",
      margin: "auto"
    };

    return (
      <>
        {isResultReady ? (
          <>
            <div style={leftContent}>
              <img src={`/output/${timeStamp}-render.png`} style={handimage} />
            </div>
            <div>
              <h1>Displaying {timeStamp}:</h1>
              <form>
                <input type="hidden" name="timeStamp" value={timeStamp} />
                <input type="hidden" name="promptImage" value={prompt} />
                <p style={pHeading}>
                  <b>Q1</b>: The virtual representation of my hand matches my
                  real hand’s pose.*
                </p>
                <AgreeDisagreeButtons
                  name="response1"
                  onChange={val => this.setState({ response1: val })}
                />
                <p style={pHeading}>
                  <b>Q2</b>: The virtual representation of the hand looks
                  natural.*
                </p>
                <AgreeDisagreeButtons
                  name="response2"
                  onChange={val => this.setState({ response2: val })}
                />
                <p>Additional feedback (optional):</p>
                <textarea
                  style={inputText}
                  onInput={e =>
                    this.setState({ response3: e.currentTarget.value })
                  }
                />
                <br />
                <br />
                <br />
                <input
                  style={inputButton}
                  type="button"
                  value="Submit"
                  onClick={this.handleSubmit}
                  disabled={response1 === undefined || response2 === undefined}
                />
              </form>
            </div>
          </>
        ) : (
          <>
            {prompt && (
              <>
                <div style={divPreview}>
                  <p>Place your hand on the tablet, imitating the hand below</p>
                  <p style={pHeading}>Gesture {prompt}:</p>
                  <p>{description}</p>
                  <img src={`/res/prompts/${prompt}.jpg`} style={handimage} />
                </div>
              </>
            )}
          </>
        )}
      </>
    );
  }
}

ReactDOM.render(<UserComponent />, document.getElementById("react-root"));
