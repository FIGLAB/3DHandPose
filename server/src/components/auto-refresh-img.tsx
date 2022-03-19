import * as React from "react";
import { noop } from "../helpers/utils";

interface Props extends React.ComponentProps<"img"> {
  refreshInterval?: number;
}

interface State {
  hash: number;
}

export class AutoRefreshImg extends React.Component<Props, State> {
  static defaultProps = {
    refreshInterval: 1000
  };

  private interval: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    this.state = {
      hash: 0
    };
  }

  componentDidMount() {
    this.interval = setInterval(
      () => this.setState(({ hash }) => ({ hash: hash + 1 })),
      this.props.refreshInterval
    );
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  render() {
    const { src, refreshInterval, ...imgProps } = this.props;
    const { hash } = this.state;
    return <img {...imgProps} src={`${src}?${hash}`} />;
  }
}
