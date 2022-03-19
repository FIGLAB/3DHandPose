import * as React from "react";
import * as ReactDOM from "react-dom";
import * as THREE from "three";
import { noop } from "../helpers/utils";

interface SceneViewerProps {
  width: number;
  height: number;
  scene: THREE.Scene;
  camera: THREE.Camera;
  rendererDidMount?: (renderer: THREE.WebGLRenderer) => void;
}

export class SceneViewer extends React.Component<SceneViewerProps> {
  static defaultProps = {
    rendererDidMount: noop
  };

  private container = React.createRef<HTMLDivElement>();
  private renderer: THREE.WebGLRenderer;

  componentDidMount() {
    // create/insert renderer
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(this.props.width, this.props.height);
    this.container.current.appendChild(this.renderer.domElement);

    this.props.rendererDidMount(this.renderer);

    this.renderer.render(this.props.scene, this.props.camera);
  }

  componentDidUpdate(prevProps: Readonly<SceneViewerProps>) {
    if (
      prevProps.width != this.props.width ||
      prevProps.height != this.props.height
    ) {
      this.renderer.setSize(this.props.width, this.props.height);
    }

    this.renderer.render(this.props.scene, this.props.camera);
  }

  render() {
    return <div ref={this.container}></div>;
  }
}
