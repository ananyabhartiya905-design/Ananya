/**
 * Procedural 3D car models builder.
 * [car.js](file:///C:/Users/Ananya%20Bhartiya/Documents/antigravity/beautiful-euclid/src/world/car.js)
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * Creates a beautiful procedural low-poly sports car mesh.
 * @param {string} bodyColor - Hex color string for the car chassis
 * @param {boolean} addHeadlights - Whether to add real SpotLights to headlights
 * @returns {THREE.Group} Group containing the car model and wheels
 */
export function createCarModel(bodyColor = '#ff3b30', addHeadlights = false) {
    const carGroup = new THREE.Group();
    
    // Materials
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(bodyColor),
        metalness: 0.8,
        roughness: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });

    const trimMaterial = new THREE.MeshStandardMaterial({
        color: 0x111115,
        metalness: 0.7,
        roughness: 0.4
    });

    const glassMaterial = new THREE.MeshStandardMaterial({
        color: 0x112233,
        metalness: 0.9,
        roughness: 0.05,
        transparent: true,
        opacity: 0.75
    });

    const lightGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff
    });

    const tailGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3b30
    });

    const wheelMaterial = new THREE.MeshStandardMaterial({
        color: 0x1d1d23,
        roughness: 0.7,
        metalness: 0.2
    });

    const rimMaterial = new THREE.MeshStandardMaterial({
        color: 0xdddddd,
        metalness: 0.9,
        roughness: 0.2
    });

    // 1. CAR BODY CHASSIS (Aerodynamic Low-Poly)
    const bodyGroup = new THREE.Group();
    
    // Main lower chassis
    const baseChassis = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.35, 3.8),
        bodyMaterial
    );
    baseChassis.position.y = 0.2;
    baseChassis.castShadow = true;
    baseChassis.receiveShadow = true;
    bodyGroup.add(baseChassis);

    // Front hood slope
    const hoodGeom = new THREE.BoxGeometry(1.5, 0.2, 1.4);
    // Warp vertices to create a sloped look
    const pos = hoodGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        // vertices at the front (z > 0) are lowered
        if (pos.getZ(i) > 0) {
            pos.setY(i, pos.getY(i) - 0.1);
        }
    }
    hoodGeom.computeVertexNormals();
    const hood = new THREE.Mesh(hoodGeom, bodyMaterial);
    hood.position.set(0, 0.32, 1.2);
    hood.castShadow = true;
    bodyGroup.add(hood);

    // Rear engine deck / trunk
    const rearDeck = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.3, 1.2),
        bodyMaterial
    );
    rearDeck.position.set(0, 0.35, -1.3);
    rearDeck.castShadow = true;
    bodyGroup.add(rearDeck);

    // 2. COCKPIT CABIN (Glass)
    const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.45, 1.3),
        glassMaterial
    );
    // Slope cabin front windshield
    const cabinPos = cabin.geometry.attributes.position;
    for (let i = 0; i < cabinPos.count; i++) {
        // Vertices at the front (z > 0) and top (y > 0) are shifted backward
        if (cabinPos.getZ(i) > 0 && cabinPos.getY(i) > 0) {
            cabinPos.setZ(i, cabinPos.getZ(i) - 0.4);
        }
        // Vertices at the back (z < 0) and top (y > 0) are shifted slightly forward
        if (cabinPos.getZ(i) < 0 && cabinPos.getY(i) > 0) {
            cabinPos.setZ(i, cabinPos.getZ(i) + 0.15);
        }
    }
    cabin.geometry.computeVertexNormals();
    cabin.position.set(0, 0.65, -0.1);
    cabin.castShadow = true;
    bodyGroup.add(cabin);

    // 3. WING / SPOILER (Sporty rear wing)
    const wingSupportLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.35, 0.15),
        trimMaterial
    );
    wingSupportLeft.position.set(-0.6, 0.6, -1.8);
    wingSupportLeft.castShadow = true;
    bodyGroup.add(wingSupportLeft);

    const wingSupportRight = wingSupportLeft.clone();
    wingSupportRight.position.x = 0.6;
    bodyGroup.add(wingSupportRight);

    const wingMain = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.08, 0.4),
        bodyMaterial
    );
    // Slant spoiler slightly
    wingMain.rotation.x = 0.1;
    wingMain.position.set(0, 0.78, -1.8);
    wingMain.castShadow = true;
    bodyGroup.add(wingMain);

    // 4. LIGHTS
    // Headlights
    const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.1), lightGlowMaterial);
    headlightL.position.set(-0.55, 0.3, 1.9);
    bodyGroup.add(headlightL);
    
    const headlightR = headlightL.clone();
    headlightR.position.x = 0.55;
    bodyGroup.add(headlightR);

    if (addHeadlights) {
        // Add actual SpotLights pointing forward
        const createSpotlight = (xOffset) => {
            const spotLight = new THREE.SpotLight(0xffffff, 3.0, 40, Math.PI / 6, 0.5, 1);
            spotLight.position.set(xOffset, 0.3, 1.95);
            spotLight.castShadow = true;
            spotLight.shadow.mapSize.width = 512;
            spotLight.shadow.mapSize.height = 512;
            
            // Invisible target point forward
            const target = new THREE.Object3D();
            target.position.set(xOffset, 0.3, 20);
            bodyGroup.add(target);
            
            spotLight.target = target;
            bodyGroup.add(spotLight);
        };
        createSpotlight(-0.55);
        createSpotlight(0.55);
    }

    // Taillights
    const taillightL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.1), tailGlowMaterial);
    taillightL.position.set(-0.55, 0.32, -1.9);
    bodyGroup.add(taillightL);

    const taillightR = taillightL.clone();
    taillightR.position.x = 0.55;
    bodyGroup.add(taillightR);

    // 5. EXHAUST PIPES
    const exhaust = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8),
        trimMaterial
    );
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(-0.4, 0.12, -1.85);
    exhaust.castShadow = true;
    bodyGroup.add(exhaust);

    const exhaustR = exhaust.clone();
    exhaustR.position.x = 0.4;
    bodyGroup.add(exhaustR);

    carGroup.add(bodyGroup);

    // 6. WHEELS (Separate meshes for animation)
    const wheelRadius = 0.42;
    const wheelWidth = 0.32;
    
    const createWheel = (isFront) => {
        const wheelGroup = new THREE.Group();
        
        // Tire
        const tire = new THREE.Mesh(
            new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16),
            wheelMaterial
        );
        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;
        wheelGroup.add(tire);

        // Rim / Hubcap (low-poly spokes)
        const rim = new THREE.Mesh(
            new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, wheelWidth + 0.02, 12),
            rimMaterial
        );
        rim.rotation.z = Math.PI / 2;
        wheelGroup.add(rim);

        // Visual spoke detail (cross bars)
        const spoke = new THREE.Mesh(
            new THREE.BoxGeometry(wheelRadius * 1.2, 0.06, wheelWidth + 0.03),
            rimMaterial
        );
        wheelGroup.add(spoke);
        
        const spoke2 = spoke.clone();
        spoke2.rotation.x = Math.PI / 2;
        wheelGroup.add(spoke2);

        return wheelGroup;
    };

    // Positions for wheels (relative to center of car)
    const xDist = 0.88;
    const zDistF = 1.15;
    const zDistR = -1.15;
    const yOffset = 0.18;

    const fl = createWheel(true); fl.position.set(-xDist, yOffset, zDistF);
    const fr = createWheel(true); fr.position.set(xDist, yOffset, zDistF);
    const bl = createWheel(false); bl.position.set(-xDist, yOffset, zDistR);
    const br = createWheel(false); br.position.set(xDist, yOffset, zDistR);

    carGroup.add(fl);
    carGroup.add(fr);
    carGroup.add(bl);
    carGroup.add(br);

    // Save references to parts on the group for easy animation access
    carGroup.userData = {
        body: bodyGroup,
        wheels: { fl, fr, bl, br },
        exhausts: [
            new THREE.Vector3(-0.4, 0.12, -1.9),
            new THREE.Vector3(0.4, 0.12, -1.9)
        ],
        dimensions: {
            width: 1.9,
            height: 1.0,
            length: 4.0,
            radius: 1.0 // for sphere collision checks
        }
    };

    return carGroup;
}
