import * as React from "react";
import * as ReactDOM from "react-dom";
import * as THREE from "three";
import { SceneViewer } from "../../components/scene";
import {
  AsyncInterval,
  asyncInterval,
  flatten,
  cvtMatrix,
  setMatrix
} from "../../helpers/utils";
import { loadGLTF, SingletonAssetManager } from "../../helpers/assets";
import { computeNNFlowMatches, computeHandPose } from "../../helpers/comm";
import { to } from "await-to-js";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";
import { SkeletonUtils } from "three/examples/jsm/utils/SkeletonUtils";
import { Skeleton, SkinnedMesh, Mesh } from "three";

interface SimpleHandState {
  scene: THREE.Scene; // this is put in the state since it is the subject being rendered, and so an update should trigger a re-render
}

class SimpleHand extends React.Component<{}, SimpleHandState> {
  private readonly camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  ); // camera will be fixed
  private readonly handContainer = new THREE.Object3D(); //keep a handle on which object will contain the hand model
  private readonly handAssetManager = new SingletonAssetManager(async () => {
    const gltf = await loadGLTF("/res/hand.glb");

    const armature = gltf.scene.getObjectByName("Armature");
    gltf.scene.add(new THREE.SkeletonHelper(armature.getObjectByName("root")));

    const handMesh = gltf.scene.getObjectByName("hand_mesh")
      .children[0] as SkinnedMesh;
    handMesh.material = new THREE.MeshPhongMaterial({
      skinning: true,
      side: THREE.DoubleSide
    });

    const plane = gltf.scene.getObjectByName("Plane") as Mesh;
    plane.material = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide
    });

    return gltf;
  });

  private controls: TrackballControls;
  private looseInterval: AsyncInterval;
  private animationHandle: number;

  constructor(props: {}) {
    super(props);

    this.state = {
      scene: null
    };

    this.camera.position.set(37 / 2, -100, -49 / 2);
    this.camera.up.set(0, 0, 1);
    this.camera.lookAt(37 / 2, 0, -49 / 2);

    this.update = this.update.bind(this);
    this.animate = this.animate.bind(this);
  }

  private async update() {
    const matches = await computeNNFlowMatches({
      k: 10
    });

    const { pose } = matches[0];

    const handPose = await computeHandPose({ pose });
    if (pose == "none") {
      this.setState(({ scene }) => {
        this.handContainer.remove(...this.handContainer.children);
        return { scene };
      });
      return;
    }

    const gltf = await this.handAssetManager.getAsset();

    const handMesh = gltf.scene.getObjectByName("hand_mesh")
      .children[0] as SkinnedMesh;

    const armature = gltf.scene.getObjectByName("Armature") as THREE.Object3D;
    setMatrix(armature, cvtMatrix(handPose.armature));

    const skeleton = handMesh.skeleton;

    // Object.entries(handPose.bones).forEach(([name, matrix]) => {
    //   const bone = skeleton.getBoneByName(name.replace(".", ""));
    //   if (!bone) {
    //     console.warn(`could not find bone "${name}"`);
    //     return;
    // }

    // setMatrix(bone, cvtMatrix(matrix));
    // });

    this.setState(({ scene }) => {
      this.handContainer.remove(...this.handContainer.children);
      this.handContainer.add(gltf.scene);

      return { scene };
    });
  }

  private async animate() {
    if (this.controls) {
      this.controls.update();
    }
    this.setState(({ scene }) => ({ scene }));
    this.animationHandle = requestAnimationFrame(this.animate);
  }

  componentDidMount() {
    // setup scene
    this.setState(({ scene }) => {
      scene = new THREE.Scene();

      scene.add(this.camera);
      scene.add(this.handContainer);
      scene.add(new THREE.AmbientLight(0x504840));
      scene.add(new THREE.AxesHelper());

      const dlight = new THREE.DirectionalLight(0xfff0e0, 1);
      dlight.position.set(0, -1, 0);
      scene.add(dlight);

      return { scene };
    });

    // setup subscription to update
    this.looseInterval = asyncInterval(this.update, 500);

    // begin animation animate
    this.animate();
  }

  componentWillUnmount() {
    this.looseInterval.stop();
    cancelAnimationFrame(this.animationHandle);
  }

  render() {
    const { scene } = this.state;

    if (!scene) {
      return <p>Loading...</p>;
    }

    return (
      <SceneViewer
        width={window.innerWidth}
        height={window.innerHeight}
        scene={scene}
        camera={this.camera}
        rendererDidMount={renderer => {
          this.controls = new TrackballControls(
            this.camera,
            renderer.domElement
          );
          this.controls.rotateSpeed = 4;
          this.controls.target.set(37 / 2, 0, -49 / 2);
        }}
      />
    );
  }
}

ReactDOM.render(<SimpleHand />, document.getElementById("react-root"));
