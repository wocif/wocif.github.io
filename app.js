// ================================================================
// Integrated AR Portal Demo with Reticle Adjustments (Babylon.js)
// Combines original Babylon "complex code" with reticle adjustments (from THREE)
// ================================================================

// -----------------------------
// Global Variables and Constants
// -----------------------------
let state = 0; // State machine: 0 = not placed, 1 = rotation, 2 = height, 3 = scale, 4 = portal activated
let reticleMesh = null;  // Mesh used for reticle adjustments (created as a plane)
let portalAppeared = false;  // Flag to track if portal is activated
let portalPosition = new BABYLON.Vector3();  // Final portal position

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
// Main Scene Creation Function
// -----------------------------
const createScene = async function () {
    // Create the scene and set up camera
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);
    //camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    // -----------------------------
    // Create GUI for non-AR mode and AR availability check
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
        text1.text = "AR is not available in your system. Please use a supported device (e.g., Meta Quest 3 or modern Android) and browser (e.g., Chrome).";
        nonXRPanel.addControl(text1);
        return scene;
    } else {
        text1.text = "WebXR Demo: AR Portal.\n\nEnter AR and look at the floor for a hit-test marker to appear. Then tap anywhere to begin placement.";
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

    // Create a neon material used for the marker and portal effects
    const neonMaterial = new BABYLON.StandardMaterial("neonMaterial", scene);
    neonMaterial.emissiveColor = new BABYLON.Color3(0.35, 0.96, 0.88);

    // Create the hit-test marker (a torus) as in the original Babylon code
    const marker = BABYLON.MeshBuilder.CreateTorus('marker', { diameter: 0.15, thickness: 0.05, tessellation: 32 }, scene);
    marker.isVisible = false;
    marker.rotationQuaternion = new BABYLON.Quaternion();
    marker.renderingGroupId = 2;
    marker.material = neonMaterial;

    // Update marker's transform using hit-test results
    let hitTest;
    xrTest.onHitTestResultObservable.add((results) => {
        if (results.length) {
            // Only show marker when portal is not active and we're in placement mode (state 0)
            marker.isVisible = !portalAppeared && (state === 0);
            hitTest = results[0];
            // Decompose the hit-test matrix to update marker position and rotation
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

    const rootScene = new BABYLON.TransformNode("rootScene", scene);
    rootScene.rotationQuaternion = new BABYLON.Quaternion();
    const rootPilar = new BABYLON.TransformNode("rootPilar", scene);
    rootPilar.rotationQuaternion = new BABYLON.Quaternion();

    // lower ground of 3d scene
    rootScene.position.y -= 1;

    // -----------------------------
    // Occluder Setup using CSG (Constructive Solid Geometry)
    // -----------------------------
    // Create a large ground box and a hole box for occluders
    let ground = BABYLON.MeshBuilder.CreateBox("ground", { width: 500, depth: 500, height: 0.001 }, scene);
    let hole = BABYLON.MeshBuilder.CreateBox("hole", { size: 1, width: 1, height: 0.01 }, scene);

    // Perform CSG subtraction for occluders
    const groundCSG = BABYLON.CSG.FromMesh(ground);
    const holeCSG = BABYLON.CSG.FromMesh(hole);
    const booleanCSG = groundCSG.subtract(holeCSG);
    const booleanRCSG = holeCSG.subtract(groundCSG);

    // Create main occluder meshes
    let occluder = booleanCSG.toMesh("occluder", null, scene);
    

    let occluderMat = new BABYLON.StandardMaterial("occluderMat", scene);
    occluderMat.diffuseColor = new BABYLON.Color3(0, 1, 0);  // Beispiel für eine grüne Farbe
    occluder.material = occluderMat;

    let occluderFrontBottom = BABYLON.MeshBuilder.CreateBox("occluderFrontBottom", { width: 2, depth: 6, height: 0.001 }, scene); //bottom
    let occluderReverse = booleanRCSG.toMesh("occluderR", null, scene);
    let occluderFloor = BABYLON.MeshBuilder.CreateBox("occluderFloor", { width: 7, depth: 7, height: 0.001 }, scene);
    let occluderTop = BABYLON.MeshBuilder.CreateBox("occluderTop", { width: 7, depth: 7, height: 0.001 }, scene);
    let occluderRight = BABYLON.MeshBuilder.CreateBox("occluderRight", { width: 7, depth: 7, height: 0.001 }, scene);
    let occluderLeft = BABYLON.MeshBuilder.CreateBox("occluderLeft", { width: 7, depth: 7, height: 0.001 }, scene);
    let occluderback = BABYLON.MeshBuilder.CreateBox("occluderback", { width: 7, depth: 7, height: 0.001 }, scene); // vor Portal, hinter User

    // Create occluder material to force depth write
    const occluderMaterial = new BABYLON.StandardMaterial("om", scene);
    occluderMaterial.disableLighting = true;
    occluderMaterial.forceDepthWrite = true;

    // Apply material to occluders
    occluder.material = occluderMaterial;
    occluderFrontBottom.material = occluderMaterial; // bottom
    occluderReverse.material = occluderMaterial;
    occluderFloor.material = occluderMaterial;
    occluderTop.material = occluderMaterial;
    occluderRight.material = occluderMaterial;
    occluderLeft.material = occluderMaterial;
    occluderback.material = occluderMaterial;

    // Dispose temporary meshes
    ground.isVisible = false;
    hole.isVisible = false;

    // -----------------------------
    // Load the Virtual World (Hill Valley Scene)
    // -----------------------------
    engine.displayLoadingUI(); // Show loading screen
    const virtualWorldResult = await BABYLON.SceneLoader.ImportMeshAsync(
        "",
        "https://www.babylonjs.com/Scenes/hillvalley/",
        "HillValley.babylon",
        scene
    );
    engine.hideLoadingUI(); // Hide loading screen once loaded

    // Parent each mesh to the virtual world root and assign rendering group
    for (let child of virtualWorldResult.meshes) {
        child.renderingGroupId = 1;
        child.parent = rootScene;
    }

    // Set occluders to rendering group 0
    occluder.renderingGroupId = 0;
    occluderFrontBottom.renderingGroupId = 0; //bottom
    occluderReverse.renderingGroupId = 0;
    occluderFloor.renderingGroupId = 0;
    occluderTop.renderingGroupId = 0;
    occluderRight.renderingGroupId = 0;
    occluderLeft.renderingGroupId = 0;
    occluderback.renderingGroupId = 0;

    // Parent occluders to rootOccluder
    occluder.parent = rootOccluder;
    occluderFrontBottom.parent = rootOccluder; //bottom
    occluderReverse.parent = rootOccluder;
    occluderFloor.parent = rootOccluder;
    occluderTop.parent = rootOccluder;
    occluderRight.parent = rootOccluder;
    occluderLeft.parent = rootOccluder;
    occluderback.parent = rootOccluder;

    // Set visibility and low opacity for occluders
    const oclVisibility = 0.001;
    //const DEBUG_visibility = 0.35;
    occluder.isVisible = true; 
    occluderFrontBottom.isVisible = false;//changed //bottom
    occluderReverse.isVisible = false;
    occluderFloor.isVisible = true; //changed
    occluderTop.isVisible = true;
    occluderRight.isVisible = true;
    occluderLeft.isVisible = true;
    occluderback.isVisible = true;
    occluder.visibility = oclVisibility;
    occluderFrontBottom.visibility = oclVisibility; //bottom
    occluderReverse.visibility = oclVisibility;
    occluderFloor.visibility = oclVisibility;
    occluderTop.visibility = oclVisibility;
    occluderRight.visibility = oclVisibility;
    occluderLeft.visibility = oclVisibility;
    occluderback.visibility = oclVisibility;

    // Disable virtual world and occluders until portal activation
    rootScene.setEnabled(false);
    rootOccluder.setEnabled(false);

    // -----------------------------
    // Reticle (Placement Mesh) Creation
    // -----------------------------
    function createReticle() {
        if (!reticleMesh) {
            reticleMesh = BABYLON.MeshBuilder.CreatePlane("reticleMesh", { width: 1, height: 0.5 }, scene);
            let reticleMat = new BABYLON.StandardMaterial("reticleMaterial", scene);
            reticleMat.diffuseColor = new BABYLON.Color3(0, 0, 1);
            reticleMat.backFaceCulling = false;
            reticleMesh.material = reticleMat;
            reticleMesh.renderingGroupId = 2;  // Render in its own group
            reticleMesh.isVisible = false;
            reticleMesh.rotationQuaternion = BABYLON.Quaternion.Identity();
            reticleMesh.scaling = new BABYLON.Vector3(1, 1, 1);
            

        }
    }


    // -----------------------------
    // onPointerDown: Handle "Select" / State Transitions
    // -----------------------------
    scene.onPointerDown = (evt, pickInfo) => {
        // Only process if in AR session
        if (xr.baseExperience.state === BABYLON.WebXRState.IN_XR) {
            


            if (state === 0 && hitTest) {
                // First tap: Create and position the reticle using the hit-test marker
                createReticle();
                reticleMesh.position.copyFrom(marker.position);
                reticleMesh.position.set(reticleMesh.position.x, 1, reticleMesh.position.z)
                // Convert marker rotation (quaternion) to Euler angles; we use Y rotation only here
                reticleMesh.rotationQuaternion = marker.rotationQuaternion.multiply(
                    BABYLON.Quaternion.RotationYawPitchRoll(Math.PI, 0, 0)
                );
                reticleMesh.isVisible = true;
                state = 1;  // Next state: Adjust rotation
            } else if (state === 1) {
                state = 2;
            } else if (state === 2) {
                state = 3;
            } else if (state === 3) {
                state = 4;
            } else if (state === 4) {
                state = 5;
            } else if (state === 5) {
                state = 6;
                
                // ACTIVATE
                activatePortal();
            }
        }
    };

    // -----------------------------
    // Gamepad Input Handling for Reticle Adjustments
    // -----------------------------
    scene.onBeforeRenderObservable.add(() => {
        // Process gamepad input only if reticle exists and portal is not activated
        if (xr.baseExperience && xr.baseExperience.sessionManager.session && reticleMesh && state < 6) {
            const xrSession = xr.baseExperience.sessionManager.session;
            for (const inputSource of xrSession.inputSources) {
                if (inputSource.gamepad) {
                    const gamepad = inputSource.gamepad;
                    //const xAxis = gamepad.axes[2];  // Horizontal axis (e.g., for rotation)
                    const yAxis = gamepad.axes[3];  // Vertical axis (e.g., for height/scale)
                    
                    if (state === 1) {
                        // Reticle-Höhe (Y-Position)
                        reticleMesh.position.y += yAxis * 0.01;
                        gamepad.axes[2] = 0;
                    
                    } else if (state === 2) {
                        // Skalierung in Y-Richtung
                        const scaley = Math.max(0.1, reticleMesh.scaling.y + yAxis * 0.01);
                        reticleMesh.scaling.y = scaley; // Nur Y-Achse ändern
                        gamepad.axes[2] = 0;

                    } else if (state === 3) {
                        // Noch mal Höhe
                        reticleMesh.position.y += yAxis * 0.01;
                        gamepad.axes[2] = 0;

                    } else if (state === 4) {
                        // Skalierung in X-Richtung 
                        const scalex = Math.max(0.1, reticleMesh.scaling.x + yAxis * 0.01);
                        reticleMesh.scaling.x = scalex; // Nur X-Achse ändern
                        gamepad.axes[2] = 0;
                    
                    } else if (state === 5) {
                        // Rotation um Y-Achse 
                        let deltaRotation = BABYLON.Quaternion.RotationYawPitchRoll(yAxis * 0.005, 0, 0);
                        reticleMesh.rotationQuaternion = deltaRotation.multiply(reticleMesh.rotationQuaternion);
                        gamepad.axes[2] = 0;
                    }
                    
                }
            }
        }

    

        // -----------------------------
        // Update Occluder Visibility based on XR Camera vs. Portal Position
        // -----------------------------
        if (portalPosition && xrCamera) {
            // Simple check based on Z position (you may want to adjust this for your scene)
            if (xrCamera.position.z > portalPosition.z) {
                // virtual world
                occluder.isVisible = false;
                occluderFrontBottom.isVisible = false; //bottom
                occluderReverse.isVisible = true;
                occluderFloor.isVisible = false;
                occluderTop.isVisible = false;
                occluderRight.isVisible = false;
                occluderLeft.isVisible = false;
                occluderback.isVisible = false;
            } else {
                // real world
                occluder.isVisible = false; //changed
                occluderFrontBottom.isVisible = false; //changed //bottom
                occluderReverse.isVisible = false;
                occluderFloor.isVisible = false; //changed 
                occluderTop.isVisible = false; //changed
                occluderRight.isVisible = false; //changed
                occluderLeft.isVisible = false; //changed
                occluderback.isVisible = false; //changed
            }
        }
    });

    // -----------------------------
    // Activate Portal: Finalize Placement and Create Portal Geometry
    // -----------------------------
    function activatePortal() {
        
        portalAppeared = true;
        if (reticleMesh) {
            reticleMesh.isVisible = true;  // Hide reticle after placement // CHANGED
        }
        // Enable the virtual world and occluders
        rootScene.setEnabled(true);
        rootOccluder.setEnabled(true);



        
    
        // Use the final reticle transform for portal placement
        //portalPosition.y = reticleMesh.position.y + reticleMes.scaling.y * 0.5;

        // Mittelpunkte auf allen Achse berechnen
        const reticleBoundingInfo = reticleMesh.getBoundingInfo();
        portalPosition.y = (reticleBoundingInfo.boundingBox.minimumWorld.y +reticleBoundingInfo.boundingBox.maximumWorld.y) / 2
        portalPosition.x = (reticleBoundingInfo.boundingBox.minimumWorld.x +reticleBoundingInfo.boundingBox.maximumWorld.x) / 2
        portalPosition.z = (reticleBoundingInfo.boundingBox.minimumWorld.z +reticleBoundingInfo.boundingBox.maximumWorld.z) / 2

        const portalOcc_posBottom_boundingInfo = occluderFrontBottom.getBoundingInfo();
        //const occluderHeight = occluderBoundingInfo.boundingBox.maximumWorld.y - occluderBoundingInfo.boundingBox.minimumWorld.y;
        //portalOcc_posBottom = reticleBoundingInfo.boundingBox.minimumWorld.y - occluderHeight / 2;
        //occluderFrontBottom.position.set(portalPosition.x, portalOcc_posBottom, portalPosition.z);
        

        // y = Höhe
        rootScene.position.x = portalPosition.x;
        rootScene.position.z = portalPosition.z;

        rootPilar.position.copyFrom(portalPosition);
        rootPilar.rotationQuaternion = reticleMesh.rotationQuaternion.clone();

        //rootPilar.scaling.copyFrom(reticleMesh.scaling);
    
        // Wichtige Variablen für die Positionierung
        const reticlePosXMax = reticleBoundingInfo.boundingBox.maximumWorld.x;
        const reticlePosXMin = reticleBoundingInfo.boundingBox.minimumWorld.x;
        const reticlePosYMax = reticleBoundingInfo.boundingBox.maximumWorld.y;
        const reticlePosYMin = reticleBoundingInfo.boundingBox.minimumWorld.y;
        
        const reticleSizeX =  (reticlePosXMax - reticlePosXMin)
        const reticleSizeY =  (reticlePosYMin - reticlePosYMax)
        //const reticleSizeX = reticleMesh.scaling.x; // Breite des Rechtecks
        //const reticleSizeY = reticleMesh.scaling.y; // Höhe des Rechtecks
        
    
        // Höhe der vertikalen Säulen (angepasst auf das Reticle)
        const pillarHeight = reticleSizeY;
        const pillarWidth = 0.1;
        const pillarDepth = 0.1;
    
        // Erstelle die vier Säulen
        const rahmenL = BABYLON.MeshBuilder.CreateBox("rahmenL", { height: pillarHeight, width: pillarWidth, depth: pillarDepth }, scene);
        const rahmenR = rahmenL.clone("rahmenR");
        const rahmenO = BABYLON.MeshBuilder.CreateBox("rahmenO", { height: reticleSizeX, width: pillarWidth, depth: pillarDepth }, scene);
        const rahmenU = rahmenO.clone("rahmenU");
    
        // Positionierung der vertikalen Säulen (links & rechts)
        rahmenL.position.set(-reticleSizeX / 2, 0, 0); // Linke Kante
        rahmenR.position.set(reticleSizeX / 2, 0, 0);  // Rechte Kante
    
        // Positionierung der horizontalen Säulen (oben & unten)
        rahmenO.rotation.z = Math.PI / 2;  // Rotation für horizontale Säulen
        rahmenO.position.set(0, reticleSizeY / 2, 0); // Obere Kante (keine Manipulation der Z-Achse)
        
        rahmenU.rotation.z = Math.PI / 2;  // Rotation für horizontale Säulen
        rahmenU.position.set(0, -reticleSizeY / 2, 0); // Untere Kante (keine Manipulation der Z-Achse)

        rahmenL.rotation.x = reticleMesh.rotation.x;
        rahmenR.rotation.x = reticleMesh.rotation.x;
        rahmenO.rotation.x = reticleMesh.rotation.x;
        rahmenU.rotation.x = reticleMesh.rotation.x;
        
        //Align occluders 
        rootOccluder.position.copyFrom(portalPosition);
        

        rootOccluder.rotationQuaternion = reticleMesh.rotationQuaternion.clone();
        //rootOccluder.rotationQuaternion = BABYLON.Quaternion.Identity(); // Setze die Rotation zurück
        //rootOccluder.rotationQuaternion = reticleMesh.rotationQuaternion.clone(); //neu
        //rootOccluder.rotationQuaternion.copyFrom(reticleMesh.rotationQuaternion);

        // Umrechnung der aktuellen Rotation in Euler-Winkel
        let currentEuler = rootOccluder.rotationQuaternion.toEulerAngles();
        // Addiere 90 Grad (π/2) zur X-Achse
        currentEuler.x += Math.PI / 2;
        // Setze die Rotation zurück, indem du die neuen Euler-Winkel in ein Quaternion umwandelst
        rootOccluder.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(currentEuler.y, currentEuler.x, currentEuler.z);
        
        //anstelle von:
        //rootOccluder.rotationQuaternion.multiplyInPlace(
        //    BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, Math.PI / 2)
        //); 
        
        // anstelle von:
        //Quaternion.RotationAxis(new BABYLON.Vector3(-1, 0, 0), Math.PI / 2); // "hinstellen"
        //rootOccluder.rotationQuaternion.copyFrom(reticleMesh.rotationQuaternion);
        //rootOccluder.translate(BABYLON.Axis.Z, -2);
        
        
        occluderFloor.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(-1, 0, 0), Math.PI / 2);
        occluderFloor.translate(BABYLON.Axis.Y, 1);
        occluderFloor.translate(BABYLON.Axis.Z, 3.5);
        occluderTop.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(-1, 0, 0), Math.PI / 2);
        occluderTop.translate(BABYLON.Axis.Y, -2);
        occluderTop.translate(BABYLON.Axis.Z, 3.5);        
        
        occluderback.translate(BABYLON.Axis.Y, 7); //hinten
        occluderback.translate(BABYLON.Axis.Z, 2);

        occluderRight.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, Math.PI / 2);
        occluderRight.translate(BABYLON.Axis.Y, -3.4);
        occluderRight.translate(BABYLON.Axis.X, 3.5);
        occluderLeft.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, Math.PI / 2);
        occluderLeft.translate(BABYLON.Axis.Y, 3.4);
        occluderLeft.translate(BABYLON.Axis.X, 3.5);


        // ALIGN FRONT TO RETICLE
        occluderFrontBottom.translate(BABYLON.Axis.Z, -3);
    
    
    


        // Parent pillars to rootPilar so that they inherit its transform
        rahmenL.parent = rootPilar;
        rahmenR.parent = rootPilar;
        rahmenO.parent = rootPilar;
        rahmenU.parent = rootPilar;

        // Set rendering group and apply neon material for glowing effect
        rahmenL.renderingGroupId = 2;
        rahmenR.renderingGroupId = 2;
        rahmenO.renderingGroupId = 2;
        rahmenU.renderingGroupId = 2;
        rahmenL.material = neonMaterial;
        rahmenR.material = neonMaterial;
        rahmenO.material = neonMaterial;
        rahmenU.material = neonMaterial;

        // Add particle effects to the portal (using provided snippet IDs)
        BABYLON.ParticleHelper.ParseFromSnippetAsync("UY098C#488", scene, false).then(system => {
            system.emitter = rahmenO;
        });
        BABYLON.ParticleHelper.ParseFromSnippetAsync("UY098C#489", scene, false).then(system => {
            system.emitter = rahmenL;
        });
        BABYLON.ParticleHelper.ParseFromSnippetAsync("UY098C#489", scene, false).then(system => {
            system.emitter = rahmenR;
        });
    }

    // -----------------------------
    // Hide GUI in AR Mode and Show on Session End
    // -----------------------------
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        rectangle.isVisible = false;
    });
    xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
        rectangle.isVisible = true;
    });

    // -----------------------------
    // Scene Render Settings
    // -----------------------------
    scene.setRenderingAutoClearDepthStencil(1, false, false, false);
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
    scene.then(returnedScene => { 
        sceneToRender = returnedScene; 
    });
});

// -----------------------------
// Resize Event Listener
// -----------------------------
window.addEventListener("resize", function () {
    engine.resize();
});