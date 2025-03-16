// ================================================================
// Integrated AR Portal Demo with Multiple Reticle Approaches (Babylon.js)
// This version provides three different ways to create the reticle.
// Set 'selectedReticleApproach' to 1, 2, or 3 to choose the desired method.
// ================================================================

// -----------------------------
// Global Variables and Constants
// -----------------------------
let state = 0; // State machine: 0 = Not placed, 1 = Adjust rotation, 2 = Adjust height, 3 = Adjust scale, 4 = Portal activated
let reticleMesh = null;  // Mesh used for reticle adjustments
let portalAppeared = false;  // Flag: true after portal activation
let portalPosition = new BABYLON.Vector3();  // Final portal position

// Choose one of the reticle approaches: 1, 2, or 3.
const selectedReticleApproach = 1;

// -----------------------------
// Babylon Engine Setup
// -----------------------------
var canvas = document.getElementById("renderCanvas");
var engine = null;
var scene = null;
var sceneToRender = null;

// Start the render loop
var startRenderLoop = function (engine, canvas) {
    engine.runRenderLoop(function () {
        if (sceneToRender && sceneToRender.activeCamera) {
            sceneToRender.render();
        }
    });
};

// Create the Babylon Engine
var createDefaultEngine = function() { 
    return new BABYLON.Engine(canvas, true, { 
        preserveDrawingBuffer: true, 
        stencil: true,  
        disableWebGL2Support: false
    }); 
};

// -----------------------------
// Reticle Creation Approaches
// -----------------------------

// Approach 1: Opaque Plane with Billboard Mode
function createReticleApproach1(scene) {
  // Create a plane for the reticle.
  let reticle = BABYLON.MeshBuilder.CreatePlane("reticleMesh", { width: 1, height: 1 }, scene);
  // Create an opaque blue material.
  let reticleMat = new BABYLON.StandardMaterial("reticleMaterial", scene);
  reticleMat.diffuseColor = new BABYLON.Color3(0, 0, 1);
  reticleMat.alpha = 1;
  reticle.material = reticleMat;
  // Force the reticle to always face the camera.
  reticle.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  // Use default rendering group (0) to be safe.
  reticle.renderingGroupId = 0;
  reticle.isVisible = true;
  return reticle;
}

// Approach 2: Torus Mesh as the Reticle
function createReticleApproach2(scene) {
  // Create a torus (ring) for the reticle.
  let reticle = BABYLON.MeshBuilder.CreateTorus("reticleTorus", { diameter: 1, thickness: 0.1, tessellation: 32 }, scene);
  // Create a glowing green material.
  let reticleMat = new BABYLON.StandardMaterial("reticleMat", scene);
  reticleMat.emissiveColor = new BABYLON.Color3(0, 1, 0);
  reticleMat.diffuseColor = new BABYLON.Color3(0, 1, 0);
  reticle.material = reticleMat;
  // Optionally force billboard mode.
  reticle.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  reticle.renderingGroupId = 0;
  reticle.isVisible = true;
  return reticle;
}

// Approach 3: Glowing Sphere with a GlowLayer
function createReticleApproach3(scene) {
  // Create a small sphere.
  let reticle = BABYLON.MeshBuilder.CreateSphere("reticleSphere", { segments: 16, diameter: 0.5 }, scene);
  // Create a bright yellow material.
  let reticleMat = new BABYLON.StandardMaterial("reticleSphereMat", scene);
  reticleMat.diffuseColor = new BABYLON.Color3(1, 1, 0);
  reticleMat.emissiveColor = new BABYLON.Color3(1, 1, 0);
  reticle.material = reticleMat;
  reticle.renderingGroupId = 0;
  reticle.isVisible = true;
  // Add a glow layer to enhance visibility.
  let glowLayer = new BABYLON.GlowLayer("glow", scene);
  glowLayer.intensity = 1.0;
  return reticle;
}

// Helper: Create reticle using selected approach.
function createReticle(scene) {
  if (!reticleMesh) {
    if (selectedReticleApproach === 1) {
      reticleMesh = createReticleApproach1(scene);
    } else if (selectedReticleApproach === 2) {
      reticleMesh = createReticleApproach2(scene);
    } else if (selectedReticleApproach === 3) {
      reticleMesh = createReticleApproach3(scene);
    }
  }
}

// -----------------------------
// Main Scene Creation Function
// -----------------------------
const createScene = async function () {
    // Create the scene and set up the free camera.
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    // -----------------------------
    // GUI Setup for non-AR mode and AR availability check.
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
        text1.text = "WebXR Demo: AR Portal.\n\nEnter AR and look at the floor for a hit–test marker to appear. Then tap anywhere to begin placement.";
        nonXRPanel.addControl(text1);
    }

    // -----------------------------
    // Create the WebXR Experience Helper for AR.
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
    // Hit-Test and Marker Setup.
    // -----------------------------
    const fm = xr.baseExperience.featuresManager;
    const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
    const xrCamera = xr.baseExperience.camera;

    // Create a neon material used for both marker and portal effects.
    const neonMaterial = new BABYLON.StandardMaterial("neonMaterial", scene);
    neonMaterial.emissiveColor = new BABYLON.Color3(0.35, 0.96, 0.88);

    // Create the hit–test marker (a torus) as in the original code.
    const marker = BABYLON.MeshBuilder.CreateTorus('marker', { diameter: 0.15, thickness: 0.05, tessellation: 32 }, scene);
    marker.isVisible = false;
    marker.rotationQuaternion = new BABYLON.Quaternion();
    marker.renderingGroupId = 2;
    marker.material = neonMaterial;

    // Update marker’s transform based on hit–test results.
    let hitTest;
    xrTest.onHitTestResultObservable.add((results) => {
        if (results.length) {
            // Show marker only if portal is not active and placement has not started.
            marker.isVisible = !portalAppeared && (state === 0);
            hitTest = results[0];
            hitTest.transformationMatrix.decompose(undefined, marker.rotationQuaternion, marker.position);
        } else {
            marker.isVisible = false;
            hitTest = undefined;
        }
    });

    // -----------------------------
    // Root Transform Nodes for Virtual World and Portal.
    // -----------------------------
    const rootOccluder = new BABYLON.TransformNode("rootOccluder", scene);
    rootOccluder.rotationQuaternion = new BABYLON.Quaternion();
    const rootScene = new BABYLON.TransformNode("rootScene", scene);
    rootScene.rotationQuaternion = new BABYLON.Quaternion();
    const rootPilar = new BABYLON.TransformNode("rootPilar", scene);
    rootPilar.rotationQuaternion = new BABYLON.Quaternion();

    // -----------------------------
    // Occluder Setup using CSG.
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
    occluder.renderingGroupId = 0;
    occluderR.renderingGroupId = 0;
    occluderFloor.renderingGroupId = 0;
    occluderTop.renderingGroupId = 0;
    occluderRight.renderingGroupId = 0;
    occluderLeft.renderingGroupId = 0;
    occluderback.renderingGroupId = 0;
    occluder.parent = rootOccluder;
    occluderR.parent = rootOccluder;
    occluderFloor.parent = rootOccluder;
    occluderTop.parent = rootOccluder;
    occluderRight.parent = rootOccluder;
    occluderLeft.parent = rootOccluder;
    occluderback.parent = rootOccluder;
    const oclVisibility = 0.001;
    occluder.isVisible = true;
    occluderR.isVisible = false;
    occluderFloor.isVisible = true;
    occluderTop.isVisible = true;
    occluderRight.isVisible = true;
    occluderLeft.isVisible = true;
    occluderback.isVisible = true;
    occluder.visibility = oclVisibility;
    occluderR.visibility = oclVisibility;
    occluderFloor.visibility = oclVisibility;
    occluderTop.visibility = oclVisibility;
    occluderRight.visibility = oclVisibility;
    occluderLeft.visibility = oclVisibility;
    occluderback.visibility = oclVisibility;
    rootScene.setEnabled(false);
    rootOccluder.setEnabled(false);

    // -----------------------------
    // Reticle (Placement Mesh) Creation using Selected Approach.
    // -----------------------------
    function initReticle() {
      createReticle(scene); // This sets reticleMesh using one of the approaches.
      // Ensure initial reticle properties
      reticleMesh.isVisible = true;
      reticleMesh.rotation = BABYLON.Vector3.Zero();
      reticleMesh.scaling = new BABYLON.Vector3(1, 1, 1);
    }

    // -----------------------------
    // onPointerDown: Handle "Select" / State Transitions.
    // -----------------------------
    scene.onPointerDown = (evt, pickInfo) => {
        // Process only if in an active AR session.
        if (xr.baseExperience.state === BABYLON.WebXRState.IN_XR) {
            if (state === 0 && hitTest) {
                // First tap: Create and position the reticle based on the hit–test marker.
                initReticle();
                reticleMesh.position.copyFrom(marker.position);
                // Use marker rotation (convert quaternion to Euler angles; use Y rotation).
                let euler = marker.rotationQuaternion.toEulerAngles();
                reticleMesh.rotation.y = euler.y;
                // Show the reticle and hide the marker.
                reticleMesh.isVisible = true;
                marker.isVisible = false;
                state = 1;  // Next: adjust rotation.
            } else if (state === 1) {
                // Second tap: Finish rotation adjustment; move to height adjustment.
                state = 2;
            } else if (state === 2) {
                // Third tap: Finish height adjustment; move to scale adjustment.
                state = 3;
            } else if (state === 3) {
                // Fourth tap: Finish scale adjustment and activate the portal.
                state = 4;
                activatePortal();
            }
        }
    };

    // -----------------------------
    // Gamepad Input Handling for Reticle Adjustments.
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
        // Update Occluder Visibility based on XR Camera vs. Portal Position.
        // -----------------------------
        if (portalPosition && xrCamera) {
            if (xrCamera.position.z > portalPosition.z) {
                occluder.isVisible = false;
                occluderR.isVisible = true;
                occluderFloor.isVisible = false;
                occluderTop.isVisible = false;
                occluderRight.isVisible = false;
                occluderLeft.isVisible = false;
                occluderback.isVisible = false;
            } else {
                occluder.isVisible = true;
                occluderR.isVisible = false;
                occluderFloor.isVisible = true;
                occluderTop.isVisible = true;
                occluderRight.isVisible = true;
                occluderLeft.isVisible = true;
                occluderback.isVisible = true;
            }
        }
    });

    // -----------------------------
    // Activate Portal: Finalize Placement and Create Portal Geometry.
    // -----------------------------
    function activatePortal() {
        portalAppeared = true;
        if (reticleMesh) {
            reticleMesh.isVisible = false;
        }
        rootScene.setEnabled(true);
        rootOccluder.setEnabled(true);
        portalPosition.copyFrom(reticleMesh.position);
        rootOccluder.position.copyFrom(portalPosition);
        rootScene.position.copyFrom(portalPosition);
        // Adjust virtual world as in original code.
        rootScene.translate(BABYLON.Axis.Y, -1);
        rootScene.translate(BABYLON.Axis.X, 29);
        rootScene.translate(BABYLON.Axis.Z, -11);
        // Align occluders.
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
        // Use reticle transform for portal geometry.
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
    }

    // -----------------------------
    // Hide GUI in AR Mode and Show on Session End.
    // -----------------------------
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => { rectangle.isVisible = false; });
    xr.baseExperience.sessionManager.onXRSessionEnded.add(() => { rectangle.isVisible = true; });

    // -----------------------------
    // Scene Render Settings.
    // -----------------------------
    scene.setRenderingAutoClearDepthStencil(1, false, false, false);
    scene.setRenderingAutoClearDepthStencil(2, false, false, false);
    scene.setRenderingAutoClearDepthStencil(0, true, true, true);
    scene.autoClear = true;

    return scene;
};

// -----------------------------
// Engine Initialization and Scene Launch.
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
// Resize Event Listener.
// -----------------------------
window.addEventListener("resize", function () {
    engine.resize();
});
