// ================================================================
// Integrated AR Portal Demo with Revised Occluder Handling (Babylon.js)
// This version focuses on ensuring the virtual 3D scene (Hill Valley)
// is revealed after portal activation by “locking” occluder settings.
// ================================================================

// -----------------------------
// Global Variables and Constants
// -----------------------------
let state = 0; // 0 = Not placed, 1 = Adjust rotation, 2 = Adjust height, 3 = Adjust scale, 4 = Portal activated
let reticleMesh = null;  // Mesh used for reticle adjustments (creation method may vary)
let portalAppeared = false;  // Flag: true after portal activation
let portalPosition = new BABYLON.Vector3();  // Final portal position

// (For testing the reticle, you can use one of the approaches below. In this version, we use a basic plane.)
function createReticle(scene) {
  // Create a plane matching the original 4x2 dimensions
  reticleMesh = BABYLON.MeshBuilder.CreatePlane("reticleMesh", { width: 4, height: 2 }, scene);
  let reticleMat = new BABYLON.StandardMaterial("reticleMaterial", scene);
  reticleMat.diffuseColor = new BABYLON.Color3(0, 0, 1); // Blue
  reticleMat.alpha = 1;
  reticleMesh.material = reticleMat;
  // Use billboard mode so it faces the camera (optional—try without if issues persist)
  reticleMesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  // Put it in rendering group 0 so it isn’t accidentally culled by custom groups
  reticleMesh.renderingGroupId = 0;
  reticleMesh.parent = null;
  reticleMesh.isVisible = true;
  console.log("Reticle created:", reticleMesh);
  return reticleMesh;
}

// -----------------------------
// Babylon Engine Setup
// -----------------------------
var canvas = document.getElementById("renderCanvas");
var engine = null;
var scene = null;
var sceneToRender = null;

var startRenderLoop = function (engine, canvas) {
    engine.runRenderLoop(function () {
        if (sceneToRender && sceneToRender.activeCamera) {
            sceneToRender.render();
        }
    });
};

var createDefaultEngine = function() { 
    return new BABYLON.Engine(canvas, true, { 
        preserveDrawingBuffer: true, 
        stencil: true,  
        disableWebGL2Support: false
    }); 
};

// -----------------------------
// Main Scene Creation Function
// -----------------------------
const createScene = async function () {
    // Create scene and camera
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    // -----------------------------
    // GUI Setup for non-AR mode and AR availability check
    // -----------------------------
    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("FullscreenUI");
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
    text1.height = "400px";
    text1.paddingLeft = "10px";
    text1.paddingRight = "10px";

    if (!arAvailable) {
        text1.text = "AR is not available in your system. Please use a supported device and browser.";
        nonXRPanel.addControl(text1);
        return scene;
    } else {
        text1.text = "WebXR Demo: AR Portal.\n\nEnter AR and look at the floor for a hit–test marker. Then tap anywhere to begin placement.";
        nonXRPanel.addControl(text1);
    }

    // -----------------------------
    // Create the WebXR Experience Helper for AR
    // -----------------------------
    const xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: "immersive-ar",
            referenceSpaceType: "local-floor",
            onError: (error) => { alert(error); }
        },
        optionalFeatures: true
    });

    // -----------------------------
    // Hit-Test and Marker Setup
    // -----------------------------
    const fm = xr.baseExperience.featuresManager;
    const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
    const xrCamera = xr.baseExperience.camera;

    // Create a neon material (used for both marker and portal)
    const neonMaterial = new BABYLON.StandardMaterial("neonMaterial", scene);
    neonMaterial.emissiveColor = new BABYLON.Color3(0.35, 0.96, 0.88);

    // Create the hit–test marker (a torus)
    const marker = BABYLON.MeshBuilder.CreateTorus('marker', { diameter: 0.15, thickness: 0.05, tessellation: 32 }, scene);
    marker.isVisible = false;
    marker.rotationQuaternion = new BABYLON.Quaternion();
    marker.renderingGroupId = 2;
    marker.material = neonMaterial;

    // Update marker from hit–test results
    let hitTest;
    xrTest.onHitTestResultObservable.add((results) => {
        if (results.length) {
            // Show marker only if portal not activated and before placement starts
            marker.isVisible = !portalAppeared && (state === 0);
            hitTest = results[0];
            hitTest.transformationMatrix.decompose(undefined, marker.rotationQuaternion, marker.position);
        } else {
            marker.isVisible = false;
            hitTest = undefined;
        }
    });

    // -----------------------------
    // Root Transform Nodes for Virtual World and Portal
    // -----------------------------
    const rootOccluder = new BABYLON.TransformNode("rootOccluder", scene);
    rootOccluder.rotationQuaternion = new BABYLON.Quaternion();
    const rootScene = new BABYLON.TransformNode("rootScene", scene);
    rootScene.rotationQuaternion = new BABYLON.Quaternion();
    const rootPilar = new BABYLON.TransformNode("rootPilar", scene);
    rootPilar.rotationQuaternion = new BABYLON.Quaternion();

    // -----------------------------
    // Occluder Setup using CSG (Constructive Solid Geometry)
    // -----------------------------
    const ground = BABYLON.MeshBuilder.CreateBox("ground", { width: 500, depth: 500, height: 0.001 }, scene);
    const hole = BABYLON.MeshBuilder.CreateBox("hole", { size: 2, width: 1, height: 0.01 }, scene);
    const groundCSG = BABYLON.CSG.FromMesh(ground);
    const holeCSG = BABYLON.CSG.FromMesh(hole);
    const booleanCSG = groundCSG.subtract(holeCSG);
    const booleanRCSG = holeCSG.subtract(groundCSG);
    const occluder = booleanCSG.toMesh("occluder", null, scene);
    const occluderR = booleanRCSG.toMesh("occluderR", null, scene);
    const occluderFloor = BABYLON.MeshBuilder.CreateBox("occluderFloor", { width: 7, depth: 7, height: 0.001 }, scene);
    const occluderTop = BABYLON.MeshBuilder.CreateBox("occluderTop", { width: 7, depth: 7, height: 0.001 }, scene);
    const occluderRight = BABYLON.MeshBuilder.CreateBox("occluderRight", { width: 7, depth: 7, height: 0.001 }, scene);
    const occluderLeft = BABYLON.MeshBuilder.CreateBox("occluderLeft", { width: 7, depth: 7, height: 0.001 }, scene);
    const occluderback = BABYLON.MeshBuilder.CreateBox("occluderback", { width: 7, depth: 7, height: 0.001 }, scene);
    const occluderMaterial = new BABYLON.StandardMaterial("om", scene);
    occluderMaterial.disableLighting = true;
    occluderMaterial.forceDepthWrite = true;
    occluder.material = occluderMaterial;
    occluderR.material = occluderMaterial;
    occluderFloor.material = occluderMaterial;
    occluderTop.material = occluderMaterial;
    occluderRight.material = occluderMaterial;
    occluderLeft.material = occluderMaterial;
    occluderback.material = occluderMaterial;
    ground.dispose();
    hole.dispose();
    
    // -----------------------------
    // Load the Virtual World (Hill Valley Scene)
    // -----------------------------
    engine.displayLoadingUI();
    const virtualWorldResult = await BABYLON.SceneLoader.ImportMeshAsync(
        "",
        "https://www.babylonjs.com/Scenes/hillvalley/",
        "HillValley.babylon",
        scene
    );
    engine.hideLoadingUI();
    for (let child of virtualWorldResult.meshes) {
        child.renderingGroupId = 1;
        child.parent = rootScene;
    }
    // Set occluders to rendering group 0
    occluder.renderingGroupId = 0;
    occluderR.renderingGroupId = 0;
    occluderFloor.renderingGroupId = 0;
    occluderTop.renderingGroupId = 0;
    occluderRight.renderingGroupId = 0;
    occluderLeft.renderingGroupId = 0;
    occluderback.renderingGroupId = 0;
    // Parent occluders under rootOccluder
    occluder.parent = rootOccluder;
    occluderR.parent = rootOccluder;
    occluderFloor.parent = rootOccluder;
    occluderTop.parent = rootOccluder;
    occluderRight.parent = rootOccluder;
    occluderLeft.parent = rootOccluder;
    occluderback.parent = rootOccluder;
    const oclVisibility = 0.001;
    occluder.visibility = oclVisibility;
    occluderR.visibility = oclVisibility;
    occluderFloor.visibility = oclVisibility;
    occluderTop.visibility = oclVisibility;
    occluderRight.visibility = oclVisibility;
    occluderLeft.visibility = oclVisibility;
    occluderback.visibility = oclVisibility;
    // Initially disable virtual world and occluders until portal activation
    rootScene.setEnabled(false);
    rootOccluder.setEnabled(false);

    // -----------------------------
    // Reticle (Placement Mesh) Initialization
    // -----------------------------
    function initReticle() {
      createReticle(scene); // Create the reticle (using our basic plane approach)
      if (reticleMesh) {
        reticleMesh.isVisible = true;
        reticleMesh.rotation = BABYLON.Vector3.Zero();
        reticleMesh.scaling = new BABYLON.Vector3(1, 1, 1);
        console.log("Reticle initialized at", reticleMesh.position);
      } else {
        console.log("Reticle initialization failed");
      }
    }

    // -----------------------------
    // onPointerDown: Handle "Select" / State Transitions
    // -----------------------------
    scene.onPointerDown = (evt, pickInfo) => {
        if (xr.baseExperience.state === BABYLON.WebXRState.IN_XR) {
            if (state === 0 && hitTest) {
                // First tap: create and position reticle at hit-test marker
                initReticle();
                reticleMesh.position.copyFrom(marker.position);
                // Use marker rotation (convert quaternion to Euler; use Y rotation)
                let euler = marker.rotationQuaternion.toEulerAngles();
                reticleMesh.rotation.y = euler.y;
                reticleMesh.isVisible = true;
                marker.isVisible = false;
                console.log("State 0: reticle placed at", reticleMesh.position);
                state = 1;  // Advance to rotation adjustment
            } else if (state === 1) {
                console.log("State 1: rotation adjustment complete");
                state = 2;  // Advance to height adjustment
            } else if (state === 2) {
                console.log("State 2: height adjustment complete");
                state = 3;  // Advance to scale adjustment
            } else if (state === 3) {
                console.log("State 3: scale adjustment complete, activating portal");
                state = 4;
                activatePortal();
            }
        }
    };

    // -----------------------------
    // Gamepad Input Handling for Reticle Adjustments
    // -----------------------------
    scene.onBeforeRenderObservable.add(() => {
        if (xr.baseExperience && xr.baseExperience.sessionManager.session && reticleMesh && state < 4) {
            const xrSession = xr.baseExperience.sessionManager.session;
            for (const inputSource of xrSession.inputSources) {
                if (inputSource.gamepad) {
                    const gamepad = inputSource.gamepad;
                    const xAxis = gamepad.axes[2];
                    const yAxis = gamepad.axes[3];
                    if (state === 1) {
                        reticleMesh.rotation.y += xAxis * 0.025;
                    } else if (state === 2) {
                        reticleMesh.position.y += yAxis * 0.05;
                    } else if (state === 3) {
                        const scale = Math.max(0.1, reticleMesh.scaling.x + yAxis * 0.02);
                        reticleMesh.scaling.set(scale, scale, scale);
                    }
                }
            }
        }
        
        // -----------------------------
        // Occluder Visibility Handling
        // -----------------------------
        // When the portal is not activated, use dynamic toggling based on camera vs. portalPosition.
        // Once portalAppeared is true, "lock" occluder settings so that the virtual scene is visible.
        if (!portalAppeared) {
            if (xrCamera && portalPosition) {
                if (xrCamera.position.z > portalPosition.z) {
                    // User is considered "inside" the virtual world
                    occluder.isVisible = false;
                    occluderR.isVisible = true;
                    occluderFloor.isVisible = false;
                    occluderTop.isVisible = false;
                    occluderRight.isVisible = false;
                    occluderLeft.isVisible = false;
                    occluderback.isVisible = false;
                } else {
                    // User is in the real world
                    occluder.isVisible = true;
                    occluderR.isVisible = false;
                    occluderFloor.isVisible = true;
                    occluderTop.isVisible = true;
                    occluderRight.isVisible = true;
                    occluderLeft.isVisible = true;
                    occluderback.isVisible = true;
                }
            }
        } else {
            // Once portal is activated, lock occluder settings to reveal the virtual scene.
            // For example, always hide the occluder (or adjust as needed for your effect).
            occluder.isVisible = false;
            occluderR.isVisible = true;
            occluderFloor.isVisible = false;
            occluderTop.isVisible = false;
            occluderRight.isVisible = false;
            occluderLeft.isVisible = false;
            occluderback.isVisible = false;
        }
    });

    // -----------------------------
    // Activate Portal: Finalize Placement and Create Portal Geometry
    // -----------------------------
    function activatePortal() {
        portalAppeared = true;
        if (reticleMesh) {
            reticleMesh.isVisible = false;
        }
        // Enable the virtual world and occluders.
        rootScene.setEnabled(true);
        rootOccluder.setEnabled(true);
        // Use the reticle's final transform for portal placement.
        portalPosition.copyFrom(reticleMesh.position);
        rootOccluder.position.copyFrom(portalPosition);
        rootScene.position.copyFrom(portalPosition);
        
        // Adjust the virtual world as in the original code:
        rootScene.translate(BABYLON.Axis.Y, -1);
        rootScene.translate(BABYLON.Axis.X, 29);
        rootScene.translate(BABYLON.Axis.Z, -11);
        
        // Align occluders as in the original code.
        rootOccluder.translate(BABYLON.Axis.Y, 3);
        rootOccluder.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(-1, 0, 0), Math.PI / 2);
        rootOccluder.translate(BABYLON.Axis.Z, -2);
        occluderFloor.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(-1, 0, 0), Math.PI / 2);
        occluderFloor.translate(BABYLON.Axis.Y, 1);
        occluderFloor.translate(BABYLON.Axis.Z, 3.5);
        occluderTop.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(-1, 0, 0), Math.PI / 2);
        occluderTop.translate(BABYLON.Axis.Y, -2);
        occluderTop.translate(BABYLON.Axis.Z, 3.5);
        occluderback.translate(BABYLON.Axis.Y, 7);
        occluderback.translate(BABYLON.Axis.Z, 2);
        occluderRight.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, Math.PI / 2);
        occluderRight.translate(BABYLON.Axis.Y, -3.4);
        occluderRight.translate(BABYLON.Axis.X, 3.5);
        occluderLeft.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, Math.PI / 2);
        occluderLeft.translate(BABYLON.Axis.Y, 3.4);
        occluderLeft.translate(BABYLON.Axis.X, 3.5);
        
        // Set up portal geometry using reticle's transform.
        rootPilar.position.copyFrom(reticleMesh.position);
        rootPilar.rotation.copyFrom(reticleMesh.rotation);
        rootPilar.scaling.copyFrom(reticleMesh.scaling);
        rootPilar.translate(BABYLON.Axis.Y, 1);
        rootPilar.translate(BABYLON.Axis.X, -0.5);
        rootPilar.translate(BABYLON.Axis.Z, 0.05);
        
        // Create portal pillars.
        const pilar1 = BABYLON.MeshBuilder.CreateBox("pilar1", { height: 2, width: 0.1, depth: 0.1 }, scene);
        const pilar2 = BABYLON.MeshBuilder.CreateBox("pilar2", { height: 2, width: 0.1, depth: 0.1 }, scene);
        const pilar3 = BABYLON.MeshBuilder.CreateBox("pilar3", { height: 1.1, width: 0.1, depth: 0.1 }, scene);
        pilar2.translate(BABYLON.Axis.X, 1, BABYLON.Space.LOCAL);
        pilar3.addRotation(0, 0, Math.PI / 2);
        pilar3.translate(BABYLON.Axis.Y, 1, BABYLON.Space.LOCAL);
        pilar3.translate(BABYLON.Axis.Y, -0.5, BABYLON.Space.LOCAL);
        pilar1.parent = rootPilar;
        pilar2.parent = rootPilar;
        pilar3.parent = rootPilar;
        pilar1.renderingGroupId = 2;
        pilar2.renderingGroupId = 2;
        pilar3.renderingGroupId = 2;
        pilar1.material = neonMaterial;
        pilar2.material = neonMaterial;
        pilar3.material = neonMaterial;
        BABYLON.ParticleHelper.ParseFromSnippetAsync("UY098C#488", scene, false).then(system => { system.emitter = pilar3; });
        BABYLON.ParticleHelper.ParseFromSnippetAsync("UY098C#489", scene, false).then(system => { system.emitter = pilar1; });
        BABYLON.ParticleHelper.ParseFromSnippetAsync("UY098C#489", scene, false).then(system => { system.emitter = pilar2; });
        
        console.log("Portal activated at", portalPosition);
    }

    // -----------------------------
    // Hide GUI in AR Mode and Show on Session End
    // -----------------------------
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => { rectangle.isVisible = false; });
    xr.baseExperience.sessionManager.onXRSessionEnded.add(() => { rectangle.isVisible = true; });

    // -----------------------------
    // Scene Render Settings
    // -----------------------------
    scene.setRenderingAutoClearDepthStencil(1, false, false, false);
    scene.setRenderingAutoClearDepthStencil(2, false, false, false);
    scene.setRenderingAutoClearDepthStencil(0, true, true, true);
    scene.autoClear = true;

    return scene;
};

// -----------------------------
// Engine Initialization and Scene Launch
// -----------------------------
window.initFunction = async function() {
    var asyncEngineCreation = async function() {
        try {
            return createDefaultEngine();
        } catch(e) {
            console.log("createEngine function failed. Creating the default engine instead");
            return createDefaultEngine();
        }
    };
    window.engine = await asyncEngineCreation();
    if (!engine) throw 'engine should not be null.';
    startRenderLoop(engine, canvas);
    window.scene = createScene();
};

initFunction().then(() => {
    scene.then(returnedScene => { sceneToRender = returnedScene; });
});

// -----------------------------
// Resize Event Listener
// -----------------------------
window.addEventListener("resize", function () {
    engine.resize();
});
