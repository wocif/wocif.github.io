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
/***************************************************
 * WebXR Portal demo
 * ************************************************
 *
 * Working (at the moment) on android devices and the latest chrome and (Google VR Services installed) and Meta Quest 3
 *
 *
 * - Once in AR, look at the floor or at a flat surface for a few seconds (and move a little): the hit-testing ring will appear.
 * - Then, is the ring is displayed, the first press on the screen will add a portal at the position of the ring
 * - then walk to the portal and cross it to be in the virtual world.
 *
 */


const createScene = async function () {


    // Creates a basic Babylon Scene object (non-mesh)
    const scene = new BABYLON.Scene(engine);


    // Creates and positions a free camera (non-mesh)
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);


    // Cargets the camera to scene origin
    camera.setTarget(BABYLON.Vector3.Zero());


    // Attaches the camera to the canvas
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
        text1.text = "AR is not available in your system. Please make sure you use a supported device such as a Meta Quest 3 or a modern Android device and a supported browser like Chrome.\n \n Make sure you have Google AR services installed and that you enabled the WebXR incubation flag under chrome://flags";
        nonXRPanel.addControl(text1);
        return scene;
    } else {
        text1.text = "WebXR Demo: AR Portal.\n \n Please enter AR with the button on the lower right corner to start. Once in AR, look at the floor for a few seconds (and move a little): the hit-testing ring will appear. Then click anywhere on the screen...";
        nonXRPanel.addControl(text1);
    }


    // Create the WebXR Experience Helper for an AR Session (it initializes the XR scene, creates an XR Camera,
    // initialize the features manager, create an HTML UI button to enter XR,...)
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




    //Get the Feature Manager and from it the HitTesting fearture and the xrcamera
    const fm = xr.baseExperience.featuresManager;
    const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
    const xrCamera = xr.baseExperience.camera


    //Add glow layer, which will be used in the portal and the marker
    //const gl = new BABYLON.GlowLayer("glow", scene, {
    //    mainTextureSamples: 4,
    //    mainTextureFixedSize: 256,
    //    blurKernelSize: 1
    //});

    // ---- Rechteck für Fenstergrößeneinstellung ----
    let windowRect;

    function createRectangle() {
        windowRect = BABYLON.MeshBuilder.CreatePlane("rectangle", { width: 4, height: 2 }, scene);
        const material = new BABYLON.StandardMaterial("rectMaterial", scene);
        material.diffuseColor = new BABYLON.Color3(0, 0, 1);
        material.backFaceCulling = false;
        windowRect.material = material;
        windowRect.isVisible = true; // Rechteck sichtbar machen
        windowRect.renderingGroupId = 3; // In Gruppe 3 rendern, um im Vordergrund zu erscheinen
        // Positioniere das Rechteck ggf. an eine geeignete Stelle:
        windowRect.position = new BABYLON.Vector3(0, 1, 2);
    }
    


    //Create neonMaterial, which will be used in the portal
    const neonMaterial = new BABYLON.StandardMaterial("neonMaterial", scene);
    neonMaterial.emissiveColor = new BABYLON.Color3(0.35, 0.96, 0.88)


    //Create a marker that will be used to represent the hitTest position
    const marker = BABYLON.MeshBuilder.CreateTorus('marker', { diameter: 0.15, thickness: 0.05, tessellation: 32 });
    marker.isVisible = false;
    marker.rotationQuaternion = new BABYLON.Quaternion();
    //gl.addIncludedOnlyMesh(marker);
    marker.renderingGroupId = 2; // ---- statt layer ---- 
    marker.material = neonMaterial;


    //Update the position/rotation of the marker with HitTest information
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


    //Set-up root Transform nodes
    const rootOccluder = new BABYLON.TransformNode("rootOccluder", scene);
    rootOccluder.rotationQuaternion = new BABYLON.Quaternion();
    const rootScene = new BABYLON.TransformNode("rootScene", scene);
    rootScene.rotationQuaternion = new BABYLON.Quaternion();
    const rootPilar = new BABYLON.TransformNode("rootPilar", scene);
    rootPilar.rotationQuaternion = new BABYLON.Quaternion();


    //Create Occulers which will hide the 3D scene
    const oclVisibility = 0.001;
    const ground = BABYLON.MeshBuilder.CreateBox("ground", { width: 500, depth: 500, height: 0.001 }, scene); // size should be big enough to hideall you want
    const hole = BABYLON.MeshBuilder.CreateBox("hole", { size: 2, width: 1, height: 0.01 }, scene);


    const groundCSG = BABYLON.CSG.FromMesh(ground);
    const holeCSG = BABYLON.CSG.FromMesh(hole);
    const booleanCSG = groundCSG.subtract(holeCSG);
    const booleanRCSG = holeCSG.subtract(groundCSG);
    //Create the main occluder - to see the 3D scene through the portal when in real world
    const occluder = booleanCSG.toMesh("occluder", null, scene);
    //Create thee reverse occluder - to see the real world  through the portal when inside the 3D scene
    const occluderR = booleanRCSG.toMesh("occluderR", null, scene);
    //Create an occluder box to hide the 3D scene around the user when in real world
    const occluderFloor = BABYLON.MeshBuilder.CreateBox("ground", { width: 7, depth: 7, height: 0.001 }, scene);
    const occluderTop = BABYLON.MeshBuilder.CreateBox("occluderTop", { width: 7, depth: 7, height: 0.001 }, scene);
    const occluderRight = BABYLON.MeshBuilder.CreateBox("occluderRight", { width: 7, depth: 7, height: 0.001 }, scene);
    const occluderLeft = BABYLON.MeshBuilder.CreateBox("occluderLeft", { width: 7, depth: 7, height: 0.001 }, scene);
    const occluderback = BABYLON.MeshBuilder.CreateBox("occluderback", { width: 7, depth: 7, height: 0.001 }, scene);
    const occluderMaterial = new BABYLON.StandardMaterial("om", scene);
    occluderMaterial.disableLighting = true; // We don't need anything but the position information
    occluderMaterial.forceDepthWrite = true; //Ensure depth information is written to the buffer so meshes further away will not be drawn
    occluder.material = occluderMaterial;
    occluderR.material = occluderMaterial;
    occluderFloor.material = occluderMaterial;
    occluderTop.material = occluderMaterial;
    occluderRight.material = occluderMaterial;
    occluderLeft.material = occluderMaterial;
    occluderback.material = occluderMaterial;
    ground.dispose();
    hole.dispose();




    //Load Virtual world: the "Hill Valley Scene" and configure occluders
    engine.displayLoadingUI(); //Display the loading screen as the scene takes a few seconds to load
    const virtualWorldResult = await BABYLON.SceneLoader.ImportMeshAsync("", "https://www.babylonjs.com/Scenes/hillvalley/", "HillValley.babylon", scene);
    engine.hideLoadingUI(); //Hide Loadingscreen once the scene is loaded
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




    scene.setRenderingAutoClearDepthStencil(1, false, false, false); // Do not clean buffer info to ensure occlusion
    scene.setRenderingAutoClearDepthStencil(2, false, false, false); // ---- instead of glow-layer ----
    scene.setRenderingAutoClearDepthStencil(3, true, true, true); // ---- for rechteck ---- 
    scene.setRenderingAutoClearDepthStencil(0, true, true, true); // Clean for 1rst frame

    scene.autoClear = true;


    // Make the virtual world and occluders invisible before portal appears
    rootScene.setEnabled(false);
    rootOccluder.setEnabled(false);


    let portalAppearded = false;
    let portalPosition = new BABYLON.Vector3();


    scene.onPointerDown = (evt, pickInfo) => {
        if (hitTest && xr.baseExperience.state === BABYLON.WebXRState.IN_XR && !portalAppeared) {
            console.log("onPointerDown: Erstelle Rechteck für Fenstergrößeneinstellung");
            createRectangle();  // Funktion aufrufen!
    
            console.log("Warte auf XRSelect-Eingabe...");
            xr.baseExperience.sessionManager.onXRSelectObservable.addOnce(() => {
                console.log("XRSelect event wurde empfangen, fahre mit Portal-Code fort");
                // Rechteck ausblenden
                if (windowRect) {
                    windowRect.isVisible = false;
                }
                
                portalAppeared = true;


                //Enable the virtual world and move it to the hitTest position
                rootScene.setEnabled(true);
                rootOccluder.setEnabled(true);


                hitTest.transformationMatrix.decompose(undefined, undefined, portalPosition);


                rootOccluder.position = portalPosition;
                rootScene.position = portalPosition;


                //Move virtual scene 1 unit lower (this HillValley scene is at 1 above origin - and the grass at 1.2)
                rootScene.translate(BABYLON.Axis.Y, -1);

                //Positionate in front the car
                rootScene.translate(BABYLON.Axis.X, 29);
                rootScene.translate(BABYLON.Axis.Z, -11);




                //Align occluders
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


                //Add mesh for portal
                const pilar1 = BABYLON.MeshBuilder.CreateBox("pilar1", { height: 2, width: .1, depth: .1 });
                const pilar2 = BABYLON.MeshBuilder.CreateBox("pilar2", { height: 2, width: .1, depth: .1 });
                const pilar3 = BABYLON.MeshBuilder.CreateBox("pilar3", { height: 1.1, width: .1, depth: .1 });


                //Move pilars to make a portal
                pilar2.translate(BABYLON.Axis.X, 1, BABYLON.Space.LOCAL);
                pilar3.addRotation(0, 0, Math.PI / 2);
                pilar3.translate(BABYLON.Axis.Y, 1, BABYLON.Space.LOCAL);
                pilar3.translate(BABYLON.Axis.Y, -.5, BABYLON.Space.LOCAL);


                //Set-up transformnode to move portal mesh
                pilar1.parent = rootPilar;
                pilar2.parent = rootPilar;
                pilar3.parent = rootPilar;


                //move portal mesh to hitTest position
                rootPilar.position = portalPosition;


                //align portal mesh with occluder
                rootPilar.translate(BABYLON.Axis.Y, 1);
                rootPilar.translate(BABYLON.Axis.X, -.5);
                rootPilar.translate(BABYLON.Axis.Z, .05);  //push it a bit in virtual world to have it rendered in realworld


                //Add neon material and glowing effect to the portal
                //gl.addIncludedOnlyMesh(pilar1);
                //gl.addIncludedOnlyMesh(pilar2);
                //gl.addIncludedOnlyMesh(pilar3);
                pilar1.renderingGroupId = 2; // ---- statt glow layer ----
                pilar2.renderingGroupId = 2;
                pilar3.renderingGroupId = 2;
                pilar1.material = neonMaterial;
                pilar2.material = neonMaterial;
                pilar3.material = neonMaterial;


                //add particle effects to the portal
                BABYLON.ParticleHelper.ParseFromSnippetAsync("UY098C#488", scene, false).then(system => {
                    system.emitter = pilar3;
                });
                BABYLON.ParticleHelper.ParseFromSnippetAsync("UY098C#489", scene, false).then(system => {
                    system.emitter = pilar1;
                });
                BABYLON.ParticleHelper.ParseFromSnippetAsync("UY098C#489", scene, false).then(system => {
                    system.emitter = pilar2;
                });
            
            });

        }
    };


    //Hide GUI in AR mode
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        rectangle.isVisible = false;
    })
    xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
        rectangle.isVisible = true;


    })

    //Rendering loop
    scene.onBeforeRenderObservable.add(() => {


        marker.isVisible = !portalAppearded;


        if ((xrCamera !== undefined) && (portalPosition !== undefined)) {


            if (xrCamera.position.z > portalPosition.z) {


                isInRealWorld = false;
                occluder.isVisible = false;
                occluderR.isVisible = true;
                occluderFloor.isVisible = false;
                occluderTop.isVisible = false;
                occluderRight.isVisible = false;
                occluderLeft.isVisible = false;
                occluderback.isVisible = false;


            }
            else {
                isInRealWorld = true;
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


    return scene;


};
window.initFunction = async function() {



    var asyncEngineCreation = async function() {
        try {
            return createDefaultEngine();
        } catch(e) {
            console.log("the available createEngine function failed. Creating the default engine instead");
            return createDefaultEngine();
        }
    }


    window.engine = await asyncEngineCreation();

    const engineOptions = window.engine.getCreationOptions();
    if (engineOptions.audioEngine !== false) {

    }
    if (!engine) throw 'engine should not be null.';
    startRenderLoop(engine, canvas);
    window.scene = createScene();};
initFunction().then(() => {scene.then(returnedScene => { sceneToRender = returnedScene; });

});


// Resize
window.addEventListener("resize", function () {
    engine.resize();
});