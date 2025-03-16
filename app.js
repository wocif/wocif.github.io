var canvas = document.getElementById("renderCanvas");

var startRenderLoop = function (engine, canvas) {
    engine.runRenderLoop(function () {
        if (sceneToRender && sceneToRender.activeCamera) {
            sceneToRender.render();
        }
    });
}

var engine = null;
var scene = null;
var sceneToRender = null;
var createDefaultEngine = function() { return new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true,  disableWebGL2Support: false}); };

const createScene = async function () {
    // Creates a basic Babylon Scene object (non-mesh)
    const scene = new BABYLON.Scene(engine);

    // Creates and positions a free camera (non-mesh)
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);

    // Cargets the camera to scene origin
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    // AR availability check and GUI in non-AR mode
    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');

    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
        "FullscreenUI"
    );

    const rectangle = new BABYLON.GUI.Rectangle("rect");
    rectangle.background = "black";
    rectangle.color = "blue";
    rectangle.width = "80%";
    rectangle.height = "50%";

    advancedTexture.addControl(rectangle);
    const nonXRPanel = new BABYLON.GUI.StackPanel();
    rectangle.addControl(nonXRPanel);

    const text1 = new BABYLON.GUI.TextBlock("text1");
    text1.fontFamily = "Helvetica";
    text1.textWrapping = true;
    text1.color = "white";
    text1.fontSize = "14px";
    text1.height = "400px"
    text1.paddingLeft = "10px";
    text1.paddingRight = "10px";

    if (!arAvailable) {
        text1.text = "AR is not available in your system. Please make sure you use a supported device...";
        nonXRPanel.addControl(text1);
        return scene;
    } else {
        text1.text = "WebXR Demo: AR Portal.\nPlease enter AR with the button on the lower right corner to start...";
        nonXRPanel.addControl(text1);
    }

    // Create the WebXR Experience Helper for an AR Session
    const xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: "immersive-ar",
            referenceSpaceType: "local-floor",
            onError: (error) => {
                alert(error);
            }
        },
        optionalFeatures: true
    });

    const fm = xr.baseExperience.featuresManager;
    const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
    const xrCamera = xr.baseExperience.camera;

    // Create the marker (visible in AR)
    const marker = BABYLON.MeshBuilder.CreateTorus('marker', { diameter: 0.15, thickness: 0.05, tessellation: 32 });
    marker.isVisible = false;
    marker.renderingGroupId = 2; 
    marker.material = new BABYLON.StandardMaterial("markerMaterial", scene);

    // Manage hit test results and marker visibility
    let hitTest;
    xrTest.onHitTestResultObservable.add((results) => {
        if (results.length) {
            marker.isVisible = true;
            hitTest = results[0];
            hitTest.transformationMatrix.decompose(undefined, marker.rotationQuaternion, marker.position);
        } else {
            marker.isVisible = false;
            hitTest = undefined;
        }
    });

    let portalAppeared = false;
    let portalPosition = new BABYLON.Vector3();

    scene.onPointerDown = (evt, pickInfo) => {
        if (hitTest && xr.baseExperience.state === BABYLON.WebXRState.IN_XR && !portalAppeared) {
            createRectangle(); // Call the function to create the rectangle

            xr.baseExperience.sessionManager.onXRSelectObservable.addOnce(() => {
                if (windowRect) {
                    windowRect.isVisible = false;
                }

                portalAppeared = true;
                rootScene.setEnabled(true);
                rootOccluder.setEnabled(true);

                hitTest.transformationMatrix.decompose(undefined, undefined, portalPosition);
                rootOccluder.position = portalPosition;
                rootScene.position = portalPosition;

                rootScene.translate(BABYLON.Axis.Y, -1);
                rootScene.translate(BABYLON.Axis.X, 29);
                rootScene.translate(BABYLON.Axis.Z, -11);

                rootOccluder.translate(BABYLON.Axis.Y, 3);
                rootOccluder.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(-1, 0, 0), Math.PI / 2);
                rootOccluder.translate(BABYLON.Axis.Z, -2);

                occluderFloor.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(-1, 0, 0), Math.PI / 2);
                occluderFloor.translate(BABYLON.Axis.Y, 1);
                occluderFloor.translate(BABYLON.Axis.Z, 3.5);

                occluderTop.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(-1, 0, 0), Math.PI / 2);
                occluderTop.translate(BABYLON.Axis.Y, -2);
                occluderTop.translate(BABYLON.Axis.Z, 3.5);

                portalPosition.translate(BABYLON.Axis.Y, 3);
                rootPilar.translate(BABYLON.Axis.X, -0.5);
                rootPilar.translate(BABYLON.Axis.Z, 0.05);

                // Additional portal setup...

                // Avoid adding multiple event handlers
                if (!xr.baseExperience.sessionManager.onXRSelectObservable.hasObservers()) {
                    xr.baseExperience.sessionManager.onXRSelectObservable.addOnce(() => {
                        console.log("XRSelect event received, continue portal setup.");
                        // Continue with portal setup
                    });
                }
            });
        }
    };

    return scene;
};