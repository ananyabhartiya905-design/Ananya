/**
 * Procedural Track Generator for City, Desert, and Mountain tracks.
 * [track.js](file:///C:/Users/Ananya%20Bhartiya/Documents/antigravity/beautiful-euclid/src/world/track.js)
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { sampleCurve } from '../utils/helpers.js';

export const TRACK_TYPES = {
    CITY: 'city',
    DESERT: 'desert',
    MOUNTAIN: 'mountain'
};

class Track {
    constructor(type, name, curvePoints, width, laps, config) {
        this.type = type;
        this.name = name;
        this.curvePoints = curvePoints;
        this.width = width;
        this.laps = laps;
        this.config = config;

        // Create the 3D spline curve
        this.curve = new THREE.CatmullRomCurve3(curvePoints, true, 'centripetal');
        this.samples = sampleCurve(this.curve, 350); // Precompute 350 projection samples

        // Meshes to clean up later
        this.meshes = [];
        this.props = [];
    }

    /**
     * Build the track road, curbs, guardrails, and environment decoration.
     * @param {THREE.Scene} scene
     */
    build(scene) {
        // Clear old meshes
        this.cleanup(scene);

        // 1. GENERATE ROAD & CURB GEOMETRY
        const numSegments = 250;
        const roadVertices = [];
        const roadColors = [];
        const roadIndices = [];
        
        const curbVertices = [];
        const curbColors = [];
        const curbIndices = [];

        const railVertices = [];
        const railIndices = [];

        const points = [];
        const tangents = [];
        const normals = [];

        // Sample exact geometry points along the curve
        for (let i = 0; i <= numSegments; i++) {
            const t = i / numSegments;
            const pt = this.curve.getPointAt(t);
            const tan = this.curve.getTangentAt(t).normalize();
            // Normal vector flat on XZ plane
            const norm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
            
            points.push(pt);
            tangents.push(tan);
            normals.push(norm);
        }

        // Build Vertex Arrays
        for (let i = 0; i <= numSegments; i++) {
            const pt = points[i];
            const norm = normals[i];
            const w = this.width / 2;

            // Road Left and Right vertices
            const rl = new THREE.Vector3().copy(pt).addScaledVector(norm, -w);
            const rr = new THREE.Vector3().copy(pt).addScaledVector(norm, w);
            
            roadVertices.push(rl.x, rl.y, rl.z);
            roadVertices.push(rr.x, rr.y, rr.z);

            // Determine road coloring procedurally
            // Default dark asphalt, painted white/yellow lines at edges
            const asphaltColor = this.config.roadColor;
            const stripeColor = this.config.stripeColor;
            
            // Check if this segment is an ice patch (only on Mountain track)
            let isIce = false;
            if (this.type === TRACK_TYPES.MOUNTAIN) {
                // Paint ice patches at specific ranges of curve
                const t = i / numSegments;
                if ((t > 0.15 && t < 0.28) || (t > 0.65 && t < 0.78)) {
                    isIce = true;
                }
            }

            if (isIce) {
                roadColors.push(0.5, 0.8, 1.0); // Light blue ice
                roadColors.push(0.5, 0.8, 1.0);
            } else {
                roadColors.push(asphaltColor.r, asphaltColor.g, asphaltColor.b);
                roadColors.push(asphaltColor.r, asphaltColor.g, asphaltColor.b);
            }

            // Curbs: slightly outside road boundaries and raised
            const curbWidth = 0.85;
            const curbHeight = 0.08;
            
            const cl_inner = new THREE.Vector3().copy(rl);
            const cl_outer = new THREE.Vector3().copy(rl).addScaledVector(norm, -curbWidth);
            cl_inner.y += curbHeight;
            cl_outer.y += curbHeight;

            const cr_inner = new THREE.Vector3().copy(rr);
            const cr_outer = new THREE.Vector3().copy(rr).addScaledVector(norm, curbWidth);
            cr_inner.y += curbHeight;
            cr_outer.y += curbHeight;

            curbVertices.push(cl_outer.x, cl_outer.y, cl_outer.z);
            curbVertices.push(cl_inner.x, cl_inner.y, cl_inner.z);
            curbVertices.push(cr_inner.x, cr_inner.y, cr_inner.z);
            curbVertices.push(cr_outer.x, cr_outer.y, cr_outer.z);

            // Curb Striping (Alternating red and white/neon)
            const isRedCurb = (Math.floor(i / 2) % 2 === 0);
            const curbColorPrimary = this.config.curbColor1;
            const curbColorSecondary = this.config.curbColor2;
            const cCol = isRedCurb ? curbColorPrimary : curbColorSecondary;

            curbColors.push(cCol.r, cCol.g, cCol.b);
            curbColors.push(cCol.r, cCol.g, cCol.b);
            curbColors.push(cCol.r, cCol.g, cCol.b);
            curbColors.push(cCol.r, cCol.g, cCol.b);

            // Guardrails: translucent barrier lines
            const railHeight = 0.95;
            const railOffset = 0.9;
            const gL_bot = new THREE.Vector3().copy(rl).addScaledVector(norm, -railOffset);
            const gL_top = new THREE.Vector3().copy(gL_bot).add(new THREE.Vector3(0, railHeight, 0));

            const gR_bot = new THREE.Vector3().copy(rr).addScaledVector(norm, railOffset);
            const gR_top = new THREE.Vector3().copy(gR_bot).add(new THREE.Vector3(0, railHeight, 0));

            railVertices.push(gL_bot.x, gL_bot.y, gL_bot.z);
            railVertices.push(gL_top.x, gL_top.y, gL_top.z);
            railVertices.push(gR_bot.x, gR_bot.y, gR_bot.z);
            railVertices.push(gR_top.x, gR_top.y, gR_top.z);
        }

        // Build Indices
        for (let i = 0; i < numSegments; i++) {
            // Road triangles
            const r0 = i * 2;
            const r1 = i * 2 + 1;
            const r2 = (i + 1) * 2;
            const r3 = (i + 1) * 2 + 1;
            
            roadIndices.push(r0, r1, r2);
            roadIndices.push(r1, r3, r2);

            // Curb triangles (4 vertices per segment node)
            const baseC = i * 4;
            const nextC = (i + 1) * 4;
            
            // Left Curb triangles (outer to inner)
            roadIndices.push(baseC, baseC + 1, nextC);
            roadIndices.push(baseC + 1, nextC + 1, nextC);

            // Right Curb triangles (inner to outer)
            roadIndices.push(baseC + 2, baseC + 3, nextC + 2);
            roadIndices.push(baseC + 3, nextC + 3, nextC + 2);

            // Guardrail triangles
            const baseR = i * 4;
            const nextR = (i + 1) * 4;
            // Left rail
            railIndices.push(baseR, baseR + 1, nextR);
            railIndices.push(baseR + 1, nextR + 1, nextR);
            // Right rail
            railIndices.push(baseR + 2, baseR + 3, nextR + 2);
            railIndices.push(baseR + 3, nextR + 3, nextR + 2);
        }

        // 2. CREATE MESHES
        
        // Road mesh
        const roadGeom = new THREE.BufferGeometry();
        roadGeom.setAttribute('position', new THREE.Float32BufferAttribute(roadVertices, 3));
        roadGeom.setAttribute('color', new THREE.Float32BufferAttribute(roadColors, 3));
        roadGeom.setIndex(roadIndices);
        roadGeom.computeVertexNormals();

        const roadMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.5,
            metalness: 0.1,
            side: THREE.DoubleSide
        });

        const roadMesh = new THREE.Mesh(roadGeom, roadMat);
        roadMesh.receiveShadow = true;
        scene.add(roadMesh);
        this.meshes.push(roadMesh);

        // Curbs mesh
        const curbGeom = new THREE.BufferGeometry();
        curbGeom.setAttribute('position', new THREE.Float32BufferAttribute(curbVertices, 3));
        curbGeom.setAttribute('color', new THREE.Float32BufferAttribute(curbColors, 3));
        // Reuse curb indices from road logic since topology is similar
        const curbGeomIndices = [];
        for (let i = 0; i < numSegments; i++) {
            const base = i * 4;
            const next = (i + 1) * 4;
            
            // Left Curb (indices 0, 1)
            curbGeomIndices.push(base, base + 1, next);
            curbGeomIndices.push(base + 1, next + 1, next);

            // Right Curb (indices 2, 3)
            curbGeomIndices.push(base + 2, base + 3, next + 2);
            curbGeomIndices.push(base + 3, next + 3, next + 2);
        }
        curbGeom.setIndex(curbGeomIndices);
        curbGeom.computeVertexNormals();
        
        const curbMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.8,
            metalness: 0.05
        });
        const curbMesh = new THREE.Mesh(curbGeom, curbMat);
        curbMesh.castShadow = true;
        curbMesh.receiveShadow = true;
        scene.add(curbMesh);
        this.meshes.push(curbMesh);

        // Guardrails mesh
        const railGeom = new THREE.BufferGeometry();
        railGeom.setAttribute('position', new THREE.Float32BufferAttribute(railVertices, 3));
        railGeom.setIndex(railIndices);
        railGeom.computeVertexNormals();

        const railMat = new THREE.MeshStandardMaterial({
            color: this.config.railColor,
            transparent: true,
            opacity: this.config.railOpacity,
            side: THREE.DoubleSide,
            emissive: this.config.railColor,
            emissiveIntensity: this.config.railGlow
        });
        const railMesh = new THREE.Mesh(railGeom, railMat);
        scene.add(railMesh);
        this.meshes.push(railMesh);

        // Start/Finish banner arch
        this.buildFinishLine(scene, points[0], normals[0]);

        // 3. BUILD DECORATIVE ENVIRONMENT PROPS
        this.buildEnvironment(scene, points, normals, numSegments);
    }

    /**
     * Builds a grand finish line arch across the track.
     */
    buildFinishLine(scene, point, normal) {
        const archGroup = new THREE.Group();
        const w = this.width / 2;

        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x222230, metalness: 0.8, roughness: 0.3 });
        const screenMat = new THREE.MeshStandardMaterial({ color: 0x050510, emissive: this.config.railColor, emissiveIntensity: 0.6 });

        // Left pillar
        const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6.0, 0.8), pillarMat);
        pillarL.position.set(-w - 0.5, 3.0, 0);
        pillarL.castShadow = true;
        archGroup.add(pillarL);

        // Right pillar
        const pillarR = pillarL.clone();
        pillarR.position.x = w + 0.5;
        archGroup.add(pillarR);

        // Cross banner
        const crossbar = new THREE.Mesh(new THREE.BoxGeometry(this.width + 1.8, 1.2, 0.8), pillarMat);
        crossbar.position.set(0, 5.5, 0);
        crossbar.castShadow = true;
        archGroup.add(crossbar);

        // Neon Finish Text Screen
        const screen = new THREE.Mesh(new THREE.BoxGeometry(this.width * 0.5, 0.6, 0.82), screenMat);
        screen.position.set(0, 5.5, 0.02);
        archGroup.add(screen);

        // Align arch to track heading
        // Compute rotation to face along track tangent (normal points right, so rotate to align left/right)
        const angle = Math.atan2(normal.x, normal.z);
        archGroup.rotation.y = angle;
        
        archGroup.position.copy(point);
        scene.add(archGroup);
        this.props.push(archGroup);
    }

    /**
     * Spawns environment elements along the track sides.
     */
    buildEnvironment(scene, points, normals, numSegments) {
        const scale = 1.0;
        
        // Setup shared materials for trees/buildings to save draw calls
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1b, roughness: 0.9 });
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x1a4314, roughness: 0.8 });
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x6e5b4f, roughness: 0.9 });

        // Iterate through segments and place objects
        for (let i = 10; i < numSegments - 10; i += 8) {
            const pt = points[i];
            const norm = normals[i];
            
            // Randomly pick left or right side
            const side = Math.random() > 0.5 ? 1 : -1;
            const dist = this.width / 2 + 5.0 + Math.random() * 20.0;
            const propPos = new THREE.Vector3().copy(pt).addScaledVector(norm, side * dist);

            // Determine what to spawn based on track type
            if (this.type === TRACK_TYPES.CITY) {
                // Cyberpunk neon skyscrapers
                const height = 25 + Math.random() * 60;
                const bWidth = 8 + Math.random() * 10;
                const bDepth = 8 + Math.random() * 10;
                
                const bColor = new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 0.8, 0.15); // Neon tint dark
                const bMat = new THREE.MeshStandardMaterial({
                    color: bColor,
                    metalness: 0.9,
                    roughness: 0.1
                });

                const building = new THREE.Mesh(new THREE.BoxGeometry(bWidth, height, bDepth), bMat);
                building.position.set(propPos.x, height / 2 - 0.5, propPos.z);
                building.castShadow = true;
                building.receiveShadow = true;
                scene.add(building);
                this.props.push(building);

                // Add glowing neon windows lines (wireframe boxes overlaid)
                if (Math.random() > 0.3) {
                    const wireGeom = new THREE.BoxGeometry(bWidth + 0.1, height + 0.1, bDepth + 0.1);
                    const wireColor = Math.random() > 0.5 ? 0x00ffff : 0xff00ff;
                    const wireMat = new THREE.MeshBasicMaterial({
                        color: wireColor,
                        wireframe: true,
                        transparent: true,
                        opacity: 0.25
                    });
                    const wireframe = new THREE.Mesh(wireGeom, wireMat);
                    wireframe.position.copy(building.position);
                    scene.add(wireframe);
                    this.props.push(wireframe);
                }

            } else if (this.type === TRACK_TYPES.DESERT) {
                // Rocks, Cacti
                if (Math.random() > 0.3) {
                    // Cacti (procedural cylinder construction)
                    const cactusGroup = new THREE.Group();
                    const cHeight = 2.5 + Math.random() * 2.0;
                    
                    const cactusMat = new THREE.MeshStandardMaterial({ color: 0x3d702d, roughness: 0.9 });
                    
                    // Main stem
                    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, cHeight, 8), cactusMat);
                    stem.position.y = cHeight / 2;
                    stem.castShadow = true;
                    cactusGroup.add(stem);

                    // Left branch
                    const branchL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8), cactusMat);
                    branchL.rotation.z = Math.PI / 2;
                    branchL.position.set(-0.4, cHeight * 0.6, 0);
                    cactusGroup.add(branchL);
                    
                    const branchLUp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8), cactusMat);
                    branchLUp.position.set(-0.8, cHeight * 0.6 + 0.2, 0);
                    cactusGroup.add(branchLUp);

                    // Right branch
                    const branchR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8), cactusMat);
                    branchR.rotation.z = -Math.PI / 2;
                    branchR.position.set(0.4, cHeight * 0.45, 0);
                    cactusGroup.add(branchR);

                    const branchRUp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8), cactusMat);
                    branchRUp.position.set(0.8, cHeight * 0.45 + 0.2, 0);
                    cactusGroup.add(branchRUp);

                    cactusGroup.position.set(propPos.x, propPos.y, propPos.z);
                    scene.add(cactusGroup);
                    this.props.push(cactusGroup);
                } else {
                    // Big Canyons / Rocks
                    const rSize = 6 + Math.random() * 15;
                    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rSize, 1), rockMat);
                    rock.scale.set(1.0, 0.6 + Math.random() * 1.5, 1.0); // stretch vertically
                    rock.position.set(propPos.x, propPos.y + rSize * 0.4, propPos.z);
                    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
                    rock.castShadow = true;
                    rock.receiveShadow = true;
                    scene.add(rock);
                    this.props.push(rock);
                }

            } else if (this.type === TRACK_TYPES.MOUNTAIN) {
                // Snowy pine trees or glaciers
                if (Math.random() > 0.35) {
                    const treeGroup = new THREE.Group();
                    const tHeight = 4 + Math.random() * 4;
                    
                    // Trunk
                    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, tHeight * 0.3, 8), trunkMat);
                    trunk.position.y = tHeight * 0.15;
                    trunk.castShadow = true;
                    treeGroup.add(trunk);

                    // Cones (Leaf layers)
                    const layerCount = 3;
                    for (let l = 0; l < layerCount; l++) {
                        const coneRadius = (1.5 - l * 0.35) * (tHeight / 6);
                        const coneHeight = (2.0 - l * 0.3) * (tHeight / 6);
                        
                        const leaves = new THREE.Mesh(new THREE.ConeGeometry(coneRadius, coneHeight, 8), leafMat);
                        leaves.position.y = tHeight * 0.3 + l * (coneHeight * 0.6) + coneHeight * 0.5;
                        leaves.castShadow = true;
                        treeGroup.add(leaves);
                        
                        // Add snow tip caps
                        const snowTip = new THREE.Mesh(new THREE.ConeGeometry(coneRadius * 0.4, coneHeight * 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
                        snowTip.position.y = leaves.position.y + coneHeight * 0.3;
                        treeGroup.add(snowTip);
                    }

                    treeGroup.position.set(propPos.x, propPos.y, propPos.z);
                    scene.add(treeGroup);
                    this.props.push(treeGroup);
                } else {
                    // Large snow mountain backdrops
                    const mSize = 15 + Math.random() * 20;
                    const mountain = new THREE.Mesh(new THREE.ConeGeometry(mSize, mSize * 1.5, 5), new THREE.MeshStandardMaterial({ color: 0xe0e8f0, roughness: 0.9 }));
                    mountain.position.set(propPos.x, propPos.y + mSize * 0.7, propPos.z);
                    mountain.castShadow = true;
                    mountain.receiveShadow = true;
                    scene.add(mountain);
                    this.props.push(mountain);
                }
            }
        }
    }

    /**
     * Clears all geometry meshes and decorations from scene.
     * @param {THREE.Scene} scene
     */
    cleanup(scene) {
        this.meshes.forEach(m => {
            scene.remove(m);
            m.geometry.dispose();
            if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
            else m.material.dispose();
        });
        this.meshes = [];

        this.props.forEach(p => {
            scene.remove(p);
            p.traverse(child => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
        });
        this.props = [];
    }
}

// ----------------------------------------------------
// DEFINITIONS FOR THE 3 SPECIFIC TRACKS
// ----------------------------------------------------

// Track 1: City Grid (Flat, rectangular, elevation overpass bridge)
const cityPoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(80, 0, 40),
    new THREE.Vector3(180, 0, 0),
    new THREE.Vector3(250, 10, -80),     // bridge goes up
    new THREE.Vector3(220, 14, -180),    // bridge staying high
    new THREE.Vector3(120, 14, -140),    // bridge
    new THREE.Vector3(20, 0, -260),      // back down to flat ground
    new THREE.Vector3(-100, 0, -220),
    new THREE.Vector3(-120, 0, -100),
    new THREE.Vector3(-70, 0, -30)
];

const cityConfig = {
    roadColor: new THREE.Color(0x101016),
    stripeColor: new THREE.Color(0x00f0ff),
    curbColor1: new THREE.Color(0xff007f),
    curbColor2: new THREE.Color(0x00f0ff),
    railColor: 0x00f0ff,
    railOpacity: 0.4,
    railGlow: 0.8,
    skyColor: 0x020208,
    fogColor: 0x020208,
    fogDensity: 0.007
};

// Track 2: Desert Dunes (Canyon sweeping hills, elevation jumps)
const desertPoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(140, 8, 80),
    new THREE.Vector3(300, 2, 220),
    new THREE.Vector3(440, -12, 120),    // dip into valley
    new THREE.Vector3(420, -14, -60),
    new THREE.Vector3(280, 16, -140),    // ramp!
    new THREE.Vector3(140, 2, -240),     // canyon leap landing (lower height)
    new THREE.Vector3(-60, 0, -200),
    new THREE.Vector3(-140, -5, -80),
    new THREE.Vector3(-80, 0, -10)
];

const desertConfig = {
    roadColor: new THREE.Color(0x352b20),
    stripeColor: new THREE.Color(0xffaa00),
    curbColor1: new THREE.Color(0xffaa00),
    curbColor2: new THREE.Color(0x6b533b),
    railColor: 0xffaa00,
    railOpacity: 0.35,
    railGlow: 0.4,
    skyColor: 0xf5caa0, // Sandy sky
    fogColor: 0xe5ba90,
    fogDensity: 0.0055
};

// Track 3: Mountain Pass (Snowy, winding hairpins, icy patches)
const mountainPoints = [
    new THREE.Vector3(0, 10, 0),
    new THREE.Vector3(80, 22, 60),      // Climbing steep hills
    new THREE.Vector3(150, 36, 40),
    new THREE.Vector3(190, 42, -50),     // Mountain summit
    new THREE.Vector3(110, 28, -160),    // Downhill serpentine
    new THREE.Vector3(40, 16, -100),     // Hairpin bend
    new THREE.Vector3(-40, 6, -180),
    new THREE.Vector3(-130, 18, -100),
    new THREE.Vector3(-90, 12, -20)
];

const mountainConfig = {
    roadColor: new THREE.Color(0x282a30),
    stripeColor: new THREE.Color(0xffffff),
    curbColor1: new THREE.Color(0xffffff),
    curbColor2: new THREE.Color(0xff3b30),
    railColor: 0xff3b30,
    railOpacity: 0.5,
    railGlow: 0.7,
    skyColor: 0xaec6cf, // Snowy day sky
    fogColor: 0xaec6cf,
    fogDensity: 0.009
};

// Compile track list exports
export const tracks = [
    new Track(TRACK_TYPES.CITY, 'CITY GRID', cityPoints, 17.5, 3, cityConfig),
    new Track(TRACK_TYPES.DESERT, 'DESERT DUNES', desertPoints, 19.0, 3, desertConfig),
    new Track(TRACK_TYPES.MOUNTAIN, 'MOUNTAIN PASS', mountainPoints, 16.0, 3, mountainConfig)
];
