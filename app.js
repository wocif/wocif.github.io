// ================================================================
// - Im Projekt geht es darum, ein Rechteck in AR skalieren und platzieren zu können.
// - Das Rechteck soll dann als Fenster oder auch Tür dienen.
// - Das Rechteck wird dann als Portal verwendet, wo man dann durch eine 3D-Szene gehen kann.
// - 3D-Szene wird als .glb-Datei geladen und wurde in Blender erstellt.
// ================================================================

//Hauptquelle: https://babylonjs.medium.com/visual-effects-a-portal-in-webxr-0241b0962426


// -----------------------------
// Globale Einstellungen & Variablen
// -----------------------------
let state = 0; //state = 0: nicht platziert, 1: Rotation, 2: Höhe, 3: Skalierung, 4: Portal aktiviert
let reticleMesh = null;  //Rechteck-Mesh, welches man zum skalieren nutzt, um zu entscheiden, wie groß das Portal sein soll
let portalAppeared = false;  //portal sichtbar oder nicht?
let portalPosition = new BABYLON.Vector3();  //endgültige Position des Portals

// -----------------------------
//Grundsetup BabylonJS
// -----------------------------


var canvas = document.getElementById("renderCanvas");
var engine = null; // Babylon 3D engine (aber erst später erstellt)
var scene = null; // Babylon 3D scene (aber erst später erstellt)
var sceneToRender = null;


//------------------------------
// Startet die Render-Schleife für BabylonJS-Engine
//------------------------------
var startRenderLoop = function (engine, canvas) {
    engine.runRenderLoop(function () {
        //hier soll sichergegestellt werden, dass die Szene existiert und eine Kamera hat
        if (sceneToRender && sceneToRender.activeCamera) {
            sceneToRender.render();
        }
    });
};

//Erstellung der BabylonJS-Engine mit bestimmten Einstellungen
var createDefaultEngine = function () {
    return new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true, //erhält den Zeichenpuffer
        stencil: true, //aktiviert den Stencil-Puffer für Effekte
        disableWebGL2Support: false //WebGL2-Unterstützung aktivieren
    });
};


// -----------------------------
//Hauptfunktion für die Szenenerstellung
// -----------------------------
const createScene = async function () {
    //Zuerst BabylonJS-Szene erstellen
    const scene = new BABYLON.Scene(engine);

    //Kamera erstellen -> FreeCamera verwendet für freie Bewegung
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);
    //durch attachControl() wird die Kamera an das Canvas gebunden
    camera.attachControl(canvas, true);

    //Lichtquelle erstellen -> HemisphericLight für gleichmäßige Beleuchtung
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1000, 5), scene);
    light.intensity = 1;

    //Lichtquelle erstellen -> PointLight für punktuelle Lichtquelle
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(0, 1000, 5), scene);
    light2.intensity = 0.5;

    // -----------------------------
    // GUI erstellen bevor AR-Session, um AR-Verfügbarkeit auf jeweiligen Gerät zu prüfen
    // -----------------------------
    //Quelle: https://doc.babylonjs.com/features/featuresDeepDive/gui/gui/#fullscreen-mode

    //Prüfen, ob WebX-AR-Modus verfügbar ist
    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');


    //Erstellung einer FullScreenGUI für die Anzeige
    //Quelle: https://doc.babylonjs.com/features/featuresDeepDive/gui/gui/#fullscreen-mode
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("FullscreenUI");

    //Erstellung eines schwarzen Rechtecks für die Anzeige
    const rectangle = new BABYLON.GUI.Rectangle("rect");
    rectangle.background = "black"; //Hintergrundfarbe
    rectangle.color = "blue"; //Randfarbe
    rectangle.width = "80%"; //Breite
    rectangle.height = "50%"; //Höhe
    advancedTexture.addControl(rectangle); //Rechteck zur GUI hinzufügen

    //Erstellung eines Textfeldes für die Anzeige
    const nonXRPanel = new BABYLON.GUI.StackPanel();
    rectangle.addControl(nonXRPanel);
    const text1 = new BABYLON.GUI.TextBlock("text1");
    text1.fontFamily = "Helvetica"; //Schriftart
    text1.textWrapping = true; //erlaubt zeilenumbruch
    text1.color = "white"; //Textfarbe
    text1.fontSize = "14px"; //Schriftgröße
    text1.height = "400px"; //Höhe
    text1.paddingLeft = "10px"; //linker Rand
    text1.paddingRight = "10px"; //rechter Rand

    //Überprüfung, ob AR verfügbar ist
    if (!arAvailable) {
        text1.text = "AR is not available in your system. Please use a supported device (e.g., Meta Quest 3 or modern Android) and browser (e.g., Chrome).";
        nonXRPanel.addControl(text1);
        return scene;
    } else {
        text1.text = "WebXR Demo: AR Portal.\n\nEnter AR and look at the floor for a hit-test marker to appear. Then tap anywhere to begin placement.";
        nonXRPanel.addControl(text1);
    }


    // -----------------------------
    // WebXR Experience Helpers für AR erstellen, welches die AR-Session startet
    // -----------------------------

    //Quelle: https://doc.babylonjs.com/features/featuresDeepDive/webXR/webXRExperienceHelpers
    const xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: "immersive-ar", //start AR-Session im immersiven Modus
            referenceSpaceType: "local-floor", //benutzt den Boden als Referent für AR-Objekte
            onError: (error) => {
                alert(error);
            }
        },
        optionalFeatures: true //optionale features aktivieren falls verfügbar
    });

    // -----------------------------
    // Hit-test und Marker
    // -----------------------------

    //Quelle: https://medium.com/taikonauten-magazine-english/webxr-with-babylon-js-part-4-hit-testing-2994a0866534

    //aktiviert das featuremanagement für WebXR -> da Hit-Test-Feature benötigt wird
    const fm = xr.baseExperience.featuresManager;

    //Aktiviert das Hit-Test-Feature
    const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");

    //Zugriff auf die XR-Kamera
    const xrCamera = xr.baseExperience.camera;


    //Material erstellen für den Marker und das Portal-Rahmen
    const neonMaterial = new BABYLON.StandardMaterial("neonMaterial", scene);
    neonMaterial.emissiveColor = new BABYLON.Color3(0.35, 0.96, 0.88);

    //------------------------------
    //HitTestMarker wird erstellt
    //------------------------------

    // Create the hit-test marker (a torus) as in the original Babylon code
    const marker = BABYLON.MeshBuilder.CreateBox("marker", {
        width: 0.5,   // Length of the line
        height: 0.02, // Thickness (adjust as needed)
        depth: 0.05   // Width of the line
    }, scene);

    // Optional: Material for color and transparency
    const material = new BABYLON.StandardMaterial("markerMaterial", scene);
    material.diffuseColor = new BABYLON.Color3(1, 0, 0); // Red color
    marker.material = material;

    marker.isVisible = false;
    marker.rotationQuaternion = new BABYLON.Quaternion();
    marker.renderingGroupId = 2;



    //---------------------------------------------------------------
    //Markierung wird basierend auf dem Hit-Test-Feature aktualisiert
    //----------------------------------------------------------------
    let hitTest;
    xrTest.onHitTestResultObservable.add((results) => {
        if (results.length) {
            //zeigt den Marker an, wenn das Hit-Test-Feature Ergebnisse liefert
            marker.isVisible = !portalAppeared && (state === 0);
            //speichert das 1. des Hit-Tests
            hitTest = results[0];
            //zerlegt die Transformationen des Hit-Tests, um Position und Rotation zu aktualisieren
            hitTest.transformationMatrix.decompose(undefined, marker.rotationQuaternion, marker.position);
        } else {
            //keine markierung sichtbar, wenn kein Hit-Test ergebnis vorliegt
            marker.isVisible = false;
            hitTest = undefined;
        }
    });


    // -----------------------------
    // Root-Transform Nodes für virtuelle Welt und Occluder , Portal
    // -----------------------------


    //Erstellt wird ein unsichtbaren Bereich, der Objekte in der AR-Umgebung blockieren kann
    //Dies wird verwendet, um sicherzustellen, dass Teile der virtuellen Szene nicht durch die echte Welt sichtbar sind (sondern nur die Teile, die durch das Portal sichtbar sind)
    const rootOccluder = new BABYLON.TransformNode("rootOccluder", scene);

    //Erstellung des Hauptknotens für die virtuelle Welt
    const rootScene = new BABYLON.TransformNode("rootScene", scene);
    rootScene.rotationQuaternion = new BABYLON.Quaternion();

    //Erstellung von seperate Knoten für die Portal-Säulen
    const rootPilar = new BABYLON.TransformNode("rootPilar", scene);
    rootPilar.rotationQuaternion = new BABYLON.Quaternion();

    //senkt virtuelle Szene leichtt, um sie an die Bodenhöhe anzupassen (in AR)
    rootScene.position.y -= 1.6;


    // -----------------------------
    // Laden der virtuellen Welt
    // -----------------------------
    engine.displayLoadingUI(); //ladescreen wird angezeigt

    //Laden der virtuellen Welt aus einer .glb-Datei
    //Quelle: https://doc.babylonjs.com/features/featuresDeepDive/importers/loadingFileTypes
    const virtualWorldResult = await BABYLON.SceneLoader.ImportMeshAsync(
        "",
        "./",
        "finalscene.glb",
        scene
    );
    engine.hideLoadingUI(); //erst nach dem Laden der Szene wird der Ladescreen ausgeblendet


    //weist alle Meshes der virtuellen Welt dem  rootScene-Knoten zu und setzt die Rendering-Gruppe auf 1
    for (let child of virtualWorldResult.meshes) {
        child.renderingGroupId = 1; //definiert die Rendering-Gruppe für die virtuelle Welt
        child.parent = rootScene; //alle Objekte werden rootScene untergeordnet
    }

    // -----------------------------
    // Rendering-Einstellungen der Szene
    // -----------------------------

    //Stellt das automatische Löschen des Tiefenpuffers für verschiedene Rendering-Gruppen ein
    scene.setRenderingAutoClearDepthStencil(1, false, false, false);
    scene.setRenderingAutoClearDepthStencil(0, true, true, true);
    scene.autoClear = true; //aktiviert das automatische Löschen des Bildschirms für nächste Renderings


    //Deaktiviert virtuelle Welt und den Occluder-Knoten bis zur Portal aktiviert wird
    //Der Occluder wird verwendet, um Objekte auszublenden, die nicht sichtbar sein sollen (z. B. hinter einer Wand)
    rootScene.setEnabled(false);
    rootOccluder.setEnabled(false);


    // -----------------------------
    // Erstellung des Rechtecks (also die Platzierung des Portals)
    // -----------------------------

    //Funktion zur Erstellung eines Reticle Meshes für das Portal
    function createReticle() {
        if (!reticleMesh) {
            reticleMesh = BABYLON.MeshBuilder.CreatePlane("reticleMesh", {width: 1, height: 0.5}, scene);
            let reticleMat = new BABYLON.StandardMaterial("reticleMaterial", scene);
            reticleMat.diffuseColor = new BABYLON.Color3(0, 0, 1);
            reticleMat.backFaceCulling = false; //deaktiviert das "Verstecken der Rückseite" für die Rückseite des reticles
            reticleMesh.material = reticleMat;
            reticleMesh.renderingGroupId = 2;  //hat eigene renderingsgruppe
            reticleMesh.isVisible = false; //nicht sichtbar bis zur ersten Interaktion
            reticleMesh.rotationQuaternion = BABYLON.Quaternion.Identity(); //default-Rotation
            reticleMesh.scaling = new BABYLON.Vector3(1, 1, 1); //standard größe

        }
    }


    // -----------------------------
    // onPointerDown(): steuert den Prozess von der  Skalierung & Platzierung des Portals
    // -----------------------------

    //es reagiert auf Benutzerinteraktionen während der Session
    scene.onPointerDown = (evt, pickInfo) => {
        //zuerst wird geprüft, ob man sich in einer WebXR-Session befindet
        if (xr.baseExperience.state === BABYLON.WebXRState.IN_XR) {

            //zustand = 0: noch nichts ist platziert
            //erst wenn auf dem Controller gedrückt wird, wird der Marker sichtbar -> für den Start den Hittest
            if (state === 0 && hitTest) {
                createReticle(); //rectile erstellen
                reticleMesh.position.copyFrom(marker.position); //setze die Position des Reticles auf die des Markers
                reticleMesh.position.set(reticleMesh.position.x, 1, reticleMesh.position.z)

                //passt die Rotation des Reticles an die des Markers an -> wird aber an der y-Achse gespiegelt
                reticleMesh.rotationQuaternion = marker.rotationQuaternion.multiply(
                    BABYLON.Quaternion.RotationYawPitchRoll(Math.PI, 0, 0)
                );
                reticleMesh.isVisible = true;
                state = 1;  //dann wird in den 1. Zustand gewechselt
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

                //wenn alle Einstellungen abgeschlossen sind, dann wird das Portal aktiviert
                activatePortal();
            }
        }
    };


    // -----------------------------
    // Gamepad Input Handling für rechteckeinstellungen
    // -----------------------------

    //Funktion wird vor jeden Rendering durchgeführt, um Angaben des Gamepads zu verarbeiten
    scene.onBeforeRenderObservable.add(() => {

        //zuerst wird geprüft, ob die webxr-Session aktiv ist und ob der Reticle-Mesh existiert (also ob das Portal auch schon aktiviert ist)
        if (xr.baseExperience && xr.baseExperience.sessionManager.session && reticleMesh && state < 6) {
            const xrSession = xr.baseExperience.sessionManager.session;

            //alle gamepads input quellen werden durchlaufen, um eingaben zu erkenne
            for (const inputSource of xrSession.inputSources) {
                if (inputSource.gamepad) {

                    const gamepad = inputSource.gamepad;
                    const yAxis = gamepad.axes[3];  //vertikale Achse des Gamepads

                    if (state === 1) {
                        //Zustand 1: Anpassung der Höhe (y-Position) -> also Recticle nach oben/unten verschieben
                        reticleMesh.position.y += yAxis * 0.01;
                        gamepad.axes[2] = 0; //setzt dann xachse wieder auf 0, um konflikte zu vermeiden

                    } else if (state === 2) {
                        //Zustand 2: Skalierung des Reticle in Y-Richtung (Höhe des Portals)
                        const scaley = Math.max(0.1, reticleMesh.scaling.y + yAxis * 0.01); //verhindert negative Werte
                        reticleMesh.scaling.y = scaley; // Nur Y-Achse ändern
                        gamepad.axes[2] = 0; //setzt dann xachse wieder auf 0, um konflikte zu vermeiden

                    } else if (state === 3) {
                        //Noch mal Höhe
                        reticleMesh.position.y += yAxis * 0.01;
                        gamepad.axes[2] = 0;

                    } else if (state === 4) {
                        //Skalierung in X-Richtung
                        const scalex = Math.max(0.1, reticleMesh.scaling.x + yAxis * 0.01);
                        reticleMesh.scaling.x = scalex; //Nur X-Achse ändern
                        gamepad.axes[2] = 0;

                    } else if (state === 5) {
                        //Rotation um Y-Achse
                        let deltaRotation = BABYLON.Quaternion.RotationYawPitchRoll(yAxis * 0.005, 0, 0);
                        reticleMesh.rotationQuaternion = deltaRotation.multiply(reticleMesh.rotationQuaternion);
                        gamepad.axes[2] = 0;
                    }

                }
            }
        }


    });

    // -----------------------------
    // Activate Portal: Finalize Placement and Create Portal Geometry
    // -----------------------------
    function activatePortal() {

        portalAppeared = true;
        if (reticleMesh) {
            reticleMesh.isVisible = false;  //rechteck soll nicht mehr sichtbar sein, wenn das Portal aktiviert wird
        }

        //aktiviert die virtuelle Welt und den Occluder-Wände
        rootScene.setEnabled(true);
        rootOccluder.setEnabled(true);

        // -----------------------------
        // Update Occluder Visibility based on XR Camera vs. Portal Position
        // -----------------------------

        //Funktion wird in jedem Rendering aufgerufen, um die Sichtbarkeit der Occluder zu aktualisieren
        scene.onBeforeRenderObservable.add(() => {

            //wenn die XR-Kamera und die Portal-Position definiert sind
            if ((xrCamera !== undefined) && (portalPosition !== undefined)) {

                //wenn Kamera vor Portal steht, dann wird die virtuelle Welt sichtbar und die Occluder unsichtbar
                if (xrCamera.position.z > portalPosition.z && (xr.baseExperience.state === BABYLON.WebXRState.IN_XR)) {
                    //virtuelle Welt
                    //occluder sind unsichtbar
                    occluder.isVisible = false;
                    occluderReverse.isVisible = true;
                    occluderFloor.isVisible = false;
                    occluderTop.isVisible = false;
                    occluderRight.isVisible = false;
                    occluderLeft.isVisible = false;
                    occluderback.isVisible = false;
                } else {
                    // real world
                    //occluder sind sichtbar
                    occluder.isVisible = true;
                    occluderReverse.isVisible = false;
                    occluderFloor.isVisible = true;
                    occluderTop.isVisible = true;
                    occluderRight.isVisible = true;
                    occluderLeft.isVisible = true;
                    occluderback.isVisible = true;
                }
            }
        });


        //infos von boundingsbox des reticle
        const reticleBoundingInfo = reticleMesh.getBoundingInfo();

        //berechnung der portal-postion basierend auf der boundingbox des reticles
        portalPosition.x = (reticleBoundingInfo.boundingBox.minimumWorld.x + reticleBoundingInfo.boundingBox.maximumWorld.x) / 2
        portalPosition.y = (reticleBoundingInfo.boundingBox.minimumWorld.y + reticleBoundingInfo.boundingBox.maximumWorld.y) / 2
        portalPosition.z = (reticleBoundingInfo.boundingBox.minimumWorld.z + reticleBoundingInfo.boundingBox.maximumWorld.z) / 2


        /* 
            -----------------------------
            Occluders Definitions
            ----------------------------- 
        // */

        //Bodenfläche (um die virtuelle Welt zu blockieren) wird erstellt und ein "Loch", um die Sicht durch das Portal zu ermöglichen
        let ground = BABYLON.MeshBuilder.CreateBox("ground", {width: 500, depth: 500, height: 0.001}, scene);
        let hole = BABYLON.MeshBuilder.CreateBox("hole", {
            width: reticleBoundingInfo.boundingBox.extendSizeWorld.x * 2,
            height: 0.01,
            depth: reticleBoundingInfo.boundingBox.extendSizeWorld.y * 2
        }, scene);



        //CSG (Constructive Solid Geometry) wird verwendet, um die Geometrie des Portals zu erstellen
        const groundCSG = BABYLON.CSG.FromMesh(ground);
        const holeCSG = BABYLON.CSG.FromMesh(hole);
        const booleanCSG = groundCSG.subtract(holeCSG);
        const booleanRCSG = holeCSG.subtract(groundCSG);


        //Hauptoccluder wird erstellt
        //Quelle: https://youtu.be/8yie1UJWPFA?si=ULKALgneo1ZBOP02
        let occluder = booleanCSG.toMesh("occluder", null, scene);


        //occluder Material wird erstellt
        let occluderMat = new BABYLON.StandardMaterial("occluderMat", scene);
        occluderMat.diffuseColor = new BABYLON.Color3(0, 1, 0);  // Beispiel für eine grüne Farbe
        occluder.material = occluderMat;

        //weiter occluder werden erstellt für andere Seiten
        let occluderReverse = booleanRCSG.toMesh("occluderR", null, scene);
        let occluderFloor = BABYLON.MeshBuilder.CreateBox("occluderFloor", {width: 7, depth: 7, height: 0.001}, scene); // on floot infront portal
        let occluderTop = BABYLON.MeshBuilder.CreateBox("occluderTop", {width: 7, depth: 7, height: 0.001}, scene);
        let occluderRight = BABYLON.MeshBuilder.CreateBox("occluderRight", {width: 7, depth: 7, height: 0.001}, scene);
        let occluderLeft = BABYLON.MeshBuilder.CreateBox("occluderLeft", {width: 7, depth: 7, height: 0.001}, scene);
        let occluderback = BABYLON.MeshBuilder.CreateBox("occluderback", {width: 7, depth: 7, height: 0.001}, scene); // vor Portal, hinter User

        //matieral für diese alle occluder erstellen
        const occluderMaterial = new BABYLON.StandardMaterial("om", scene);
        occluderMaterial.disableLighting = true;
        occluderMaterial.forceDepthWrite = true;

        //material wird angewendet
        occluder.material = occluderMaterial;
        //occluderFrontBottom.material = occluderMaterial; // bottom
        occluderReverse.material = occluderMaterial;
        occluderFloor.material = occluderMaterial;
        occluderTop.material = occluderMaterial;
        occluderRight.material = occluderMaterial;
        occluderLeft.material = occluderMaterial;
        occluderback.material = occluderMaterial;

        //temporäre Meshes verstecken
        ground.isVisible = false;
        hole.isVisible = false;


        //jedes Mesh wird dem Occluder-Knoten zugewiesen und rendering gruppe wird gesetzt
        for (let child of virtualWorldResult.meshes) {
            child.renderingGroupId = 1;
            child.parent = rootScene;
        }

        //alle occluder in renderung gruppe 0, damit sie immer zuerst gerendert werden
        occluder.renderingGroupId = 0;
        occluderReverse.renderingGroupId = 0;
        occluderFloor.renderingGroupId = 0;
        occluderTop.renderingGroupId = 0;
        occluderRight.renderingGroupId = 0;
        occluderLeft.renderingGroupId = 0;
        occluderback.renderingGroupId = 0;

        //parent von Occluder auf rootOccluder setzen
        occluder.parent = rootOccluder;
        occluderReverse.parent = rootOccluder;
        occluderFloor.parent = rootOccluder;
        occluderTop.parent = rootOccluder;
        occluderRight.parent = rootOccluder;
        occluderLeft.parent = rootOccluder;
        occluderback.parent = rootOccluder;

        //Sichtbarkeit der Occluder wird gesetzt
        const oclVisibility = 0.001;
        occluder.isVisible = true;
        occluderReverse.isVisible = false;
        occluderFloor.isVisible = false; //changed !!!!!!!!!!!!!!!
        occluderTop.isVisible = true;
        occluderRight.isVisible = true;
        occluderLeft.isVisible = true;
        occluderback.isVisible = true;
        occluder.visibility = oclVisibility;
        occluderReverse.visibility = oclVisibility;
        occluderFloor.visibility = oclVisibility;
        occluderTop.visibility = oclVisibility;
        occluderRight.visibility = oclVisibility;
        occluderLeft.visibility = oclVisibility;
        occluderback.visibility = oclVisibility;


        //y = Höhe
        rootScene.position.x = portalPosition.x;
        rootScene.position.z = portalPosition.z;


        //-----------------------------
        //Säulen erstelle vom Portal
        //-----------------------------

        //Säulen werden basierend auf der größe des Reticles erstellt
        rootPilar.position.copyFrom(portalPosition);
        rootPilar.rotationQuaternion = reticleMesh.rotationQuaternion.clone(); //kopiere Rotation von reticle


        //größe des reticles wird ermittelt
        const reticlePosXMax = reticleBoundingInfo.boundingBox.maximumWorld.x;
        const reticlePosXMin = reticleBoundingInfo.boundingBox.minimumWorld.x;
        const reticlePosYMax = reticleBoundingInfo.boundingBox.maximumWorld.y;
        const reticlePosYMin = reticleBoundingInfo.boundingBox.minimumWorld.y;


        //Höhe und Breite des Reticles werden ermittelt
        const reticleSizeX = (reticlePosXMax - reticlePosXMin)
        const reticleSizeY = (reticlePosYMax - reticlePosYMin)
        //const reticleSizeX = reticleMesh.scaling.x; // Breite des Rechtecks
        //const reticleSizeY = reticleMesh.scaling.y; // Höhe des Rechtecks


        //Höhe der vertikalen Säulen und Größe
        const pillarHeight = reticleSizeY;
        const pillarWidth = 0.03;
        const pillarDepth = 0.03;

        //4 säulen werden erstellt
        const rahmenL = BABYLON.MeshBuilder.CreateBox("rahmenL", {
            height: pillarHeight,
            width: pillarWidth,
            depth: pillarDepth
        }, scene);
        const rahmenR = rahmenL.clone("rahmenR");
        const rahmenO = BABYLON.MeshBuilder.CreateBox("rahmenO", {
            height: reticleSizeX,
            width: pillarWidth,
            depth: pillarDepth
        }, scene);
        const rahmenU = rahmenO.clone("rahmenU");

        //Positionierung der vertikalen Säulen (links & rechts)
        rahmenL.position.set(-reticleSizeX / 2, 0, 0); // Linke Kante
        rahmenR.position.set(reticleSizeX / 2, 0, 0);  // Rechte Kante

        //Positionierung der horizontalen Säulen (oben & unten)
        rahmenO.rotation.z = Math.PI / 2;  // Rotation für horizontale Säulen
        rahmenO.position.set(0, reticleSizeY / 2, 0); // Obere Kante (keine Manipulation der Z-Achse)

        rahmenU.rotation.z = Math.PI / 2;  //Rotation für horizontale Säulen
        rahmenU.position.set(0, -reticleSizeY / 2, 0); //Untere Kante (keine Manipulation der Z-Achse)

        rahmenL.rotation.x = reticleMesh.rotation.x;
        rahmenR.rotation.x = reticleMesh.rotation.x;
        rahmenO.rotation.x = reticleMesh.rotation.x;
        rahmenU.rotation.x = reticleMesh.rotation.x;




        //------------------------------
        //Positionierung & Roation der Occluder
        //------------------------------

        rootOccluder.position.copyFrom(portalPosition);
        rootOccluder.rotationQuaternion = reticleMesh.rotationQuaternion.clone().multiply(
            BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(-1, 0, 0), Math.PI / 2)
        );

        //Occluder werden positioniert und rotiert
        occluderFloor.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(-1, 0, 0), Math.PI / 2);
        occluderFloor.translate(BABYLON.Axis.Y, 1);
        occluderFloor.translate(BABYLON.Axis.Z, 3.5); //changed
        occluderTop.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(-1, 0, 0), Math.PI / 2);
        occluderTop.translate(BABYLON.Axis.Y, -2);
        occluderTop.translate(BABYLON.Axis.Z, 3.5);

        //occluder hinten und seitlich positioniert
        occluderback.translate(BABYLON.Axis.Y, 7); //hinten
        occluderback.translate(BABYLON.Axis.Z, 2);
        occluderRight.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, Math.PI / 2);
        occluderRight.translate(BABYLON.Axis.Y, -3.4);
        occluderRight.translate(BABYLON.Axis.X, 3.5);
        occluderLeft.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, Math.PI / 2);
        occluderLeft.translate(BABYLON.Axis.Y, 3.4);
        occluderLeft.translate(BABYLON.Axis.X, 3.5);



        //Säulen werden als Children der rootPilar gesetzt -> für Erben der Transformationen
        rahmenL.parent = rootPilar;
        rahmenR.parent = rootPilar;
        rahmenO.parent = rootPilar;
        rahmenU.parent = rootPilar;

        //Rendering-Gruppe für die Säulen wird gesetzt
        rahmenL.renderingGroupId = 2;
        rahmenR.renderingGroupId = 2;
        rahmenO.renderingGroupId = 2;
        rahmenU.renderingGroupId = 2;
        rahmenL.material = neonMaterial;
        rahmenR.material = neonMaterial;
        rahmenO.material = neonMaterial;
        rahmenU.material = neonMaterial;

    }

    // -----------------------------
    //GUI wird ausgeblendet, wenn die AR-Session gestartet wird
    // -----------------------------
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        rectangle.isVisible = false;
    });
    xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
        rectangle.isVisible = true;
    });


    return scene;
};

// -----------------------------
// Engine initialisieren und Render-Schleife starten also start der szene
// -----------------------------
window.initFunction = async function () {
    var asyncEngineCreation = async function () {
        try {
            return createDefaultEngine();
        } catch (e) {
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
        sceneToRender = returnedScene; //wenn szene erstellt wird, wird sie zum rendering genutzt
    });
});

// -----------------------------
// Resize Event Listener
// -----------------------------
window.addEventListener("resize", function () {
    engine.resize(); //passt engine an fenstergrößen an
});