const rootOccluder = new BABYLON.TransformNode("rootOccluder", scene);
    rootOccluder.rotationQuaternion = new BABYLON.Quaternion();
    const rootScene = new BABYLON.TransformNode("rootScene", scene);
    rootScene.rotationQuaternion = new BABYLON.Quaternion();
    const rootPilar = new BABYLON.TransformNode("rootPilar", scene);
    rootPilar.rotationQuaternion = new BABYLON.Quaternion();
    rootScene.position.y -= 1;
    let ground = BABYLON.MeshBuilder.CreateBox("ground", { width: 500, depth: 500, height: 0.001 }, scene);
    let hole = BABYLON.MeshBuilder.CreateBox("hole", { size: 1, width: 1, height: 0.01 }, scene);
    const groundCSG = BABYLON.CSG.FromMesh(ground);
    const holeCSG = BABYLON.CSG.FromMesh(hole);
    const booleanCSG = groundCSG.subtract(holeCSG);
    const booleanRCSG = holeCSG.subtract(groundCSG);
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
    const occluderMaterial = new BABYLON.StandardMaterial("om", scene);
    occluderMaterial.disableLighting = true;
    occluderMaterial.forceDepthWrite = true;
    for (let child of virtualWorldResult.meshes) {
        child.renderingGroupId = 1;
        child.parent = rootScene;
    }
    function createReticle() {
        if (!reticleMesh) {
            reticleMesh = BABYLON.MeshBuilder.CreatePlane("reticleMesh", { width: 1, height: 0.5 }, scene);
            let reticleMat = new BABYLON.StandardMaterial("reticleMaterial", scene);
            reticleMat.diffuseColor = new BABYLON.Color3(0, 0, 1);
            reticleMat.backFaceCulling = false;
            reticleMesh.material = reticleMat;
            reticleMesh.renderingGroupId = 2;  // Render in its own group
            reticleMesh.isVisible = false;
            reticleMesh.rotation = BABYLON.Vector3.Zero();
            reticleMesh.scaling = new BABYLON.Vector3(1, 1, 1);
        }
    }
    scene.onPointerDown = (evt, pickInfo) => {
        if (xr.baseExperience.state === BABYLON.WebXRState.IN_XR) {
            if (state === 0 && hitTest) {
                createReticle();
                reticleMesh.position.copyFrom(marker.position);
                reticleMesh.position.set(reticleMesh.position.x, 1, reticleMesh.position.z)
                let euler = marker.rotationQuaternion.toEulerAngles();
                reticleMesh.rotation.y = euler.y + Math.PI;
                reticleMesh.isVisible = true;
                state = 1;  
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
                activatePortal();
            }
        }
    };
    scene.onBeforeRenderObservable.add(() => {
        if (xr.baseExperience && xr.baseExperience.sessionManager.session && reticleMesh && state < 6) {
            const xrSession = xr.baseExperience.sessionManager.session;
            for (const inputSource of xrSession.inputSources) {
                if (inputSource.gamepad) {
                    const gamepad = inputSource.gamepad;
                    const yAxis = gamepad.axes[3];  
                    if (state === 1) {
                        reticleMesh.position.y += yAxis * 0.01;
                        gamepad.axes[2] = 0;
                    
                    } else if (state === 2) {
                        const scaley = Math.max(0.1, reticleMesh.scaling.y + yAxis * 0.01);
                        reticleMesh.scaling.y = scaley; 
                        gamepad.axes[2] = 0;

                    } else if (state === 3) {
                        reticleMesh.position.y += yAxis * 0.01;
                        gamepad.axes[2] = 0;

                    } else if (state === 4) {
                        const scalex = Math.max(0.1, reticleMesh.scaling.x + yAxis * 0.01);
                        reticleMesh.scaling.x = scalex; 
                        gamepad.axes[2] = 0;
                    
                    } else if (state === 5) {
                        reticleMesh.rotation.y += yAxis * 0.005;
                        gamepad.axes[2] = 0;
                    }
                    
                }
            }
        } 
        function activatePortal() {
        
            portalAppeared = true;
            if (reticleMesh) {
                reticleMesh.isVisible = true;  // Hide reticle after placement // CHANGED
            }
            rootScene.setEnabled(true);
            rootOccluder.setEnabled(true);
            const reticleBoundingInfo = reticleMesh.getBoundingInfo();
            portalPosition.y = (reticleBoundingInfo.boundingBox.minimumWorld.y +reticleBoundingInfo.boundingBox.maximumWorld.y) / 2
            portalPosition.x = (reticleBoundingInfo.boundingBox.minimumWorld.x +reticleBoundingInfo.boundingBox.maximumWorld.x) / 2
            portalPosition.z = (reticleBoundingInfo.boundingBox.minimumWorld.z +reticleBoundingInfo.boundingBox.maximumWorld.z) / 2
            rootScene.position.x = portalPosition.x;
            rootScene.position.z = portalPosition.z;
            rootPilar.position.copyFrom(portalPosition);
            rootPilar.rotation.copyFrom(reticleMesh.rotation);
            const reticlePosXMax = reticleBoundingInfo.boundingBox.maximumWorld.x;
            const reticlePosXMin = reticleBoundingInfo.boundingBox.minimumWorld.x;
            const reticlePosYMax = reticleBoundingInfo.boundingBox.maximumWorld.y;
            const reticlePosYMin = reticleBoundingInfo.boundingBox.minimumWorld.y;
            const reticleSizeX =  (reticlePosXMax - reticlePosXMin)
            const reticleSizeY =  (reticlePosYMin - reticlePosYMax)
            const pillarHeight = reticleSizeY;
            const pillarWidth = 0.1;
            const pillarDepth = 0.1;
            const rahmenL = BABYLON.MeshBuilder.CreateBox("rahmenL", { height: pillarHeight, width: pillarWidth, depth: pillarDepth }, scene);
            const rahmenR = rahmenL.clone("rahmenR");
            const rahmenO = BABYLON.MeshBuilder.CreateBox("rahmenO", { height: reticleSizeX, width: pillarWidth, depth: pillarDepth }, scene);
            const rahmenU = rahmenO.clone("rahmenU");
            rahmenL.position.set(-reticleSizeX / 2, 0, 0); // Linke Kante
            rahmenR.position.set(reticleSizeX / 2, 0, 0);  // Rechte Kante
            rahmenO.rotation.z = Math.PI / 2;  // Rotation für horizontale Säulen
            rahmenO.position.set(0, reticleSizeY / 2, 0); // Obere Kante (keine Manipulation der Z-Achse)
            rahmenU.rotation.z = Math.PI / 2;  // Rotation für horizontale Säulen
            rahmenU.position.set(0, -reticleSizeY / 2, 0); // Untere Kante (keine Manipulation der Z-Achse)
            rahmenL.rotation.x = reticleMesh.rotation.x;
            rahmenR.rotation.x = reticleMesh.rotation.x;
            rahmenO.rotation.x = reticleMesh.rotation.x;
            rahmenU.rotation.x = reticleMesh.rotation.x;
            rootOccluder.position.copyFrom(portalPosition);
            rootOccluder.rotation.copyFrom(reticleMesh.rotation);
            rootOccluder.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(-1, 0, 0), Math.PI / 2); //TODO ??
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
            occluderFrontBottom.translate(BABYLON.Axis.X, -3);
        }
...