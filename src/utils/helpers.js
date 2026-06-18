/**
 * Mathematical utilities and track projection helpers.
 * [helpers.js](file:///C:/Users/Ananya%20Bhartiya/Documents/antigravity/beautiful-euclid/src/utils/helpers.js)
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * Linearly interpolates between two numbers.
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Linearly interpolates between two angles in radians, wrapping correctly around 2*PI.
 * @param {number} a - Start angle in radians
 * @param {number} b - End angle in radians
 * @param {number} t - Interpolation factor
 * @returns {number} Interpolated angle in radians
 */
export function lerpAngle(a, b, t) {
    let difference = b - a;
    // Normalize difference to -PI to PI range
    while (difference < -Math.PI) difference += Math.PI * 2;
    while (difference > Math.PI) difference -= Math.PI * 2;
    return a + difference * t;
}

/**
 * Projects a point onto a line segment.
 * @param {THREE.Vector3} p - Point to project
 * @param {THREE.Vector3} a - Segment start point
 * @param {THREE.Vector3} b - Segment end point
 * @param {THREE.Vector3} target - Output vector for the projected point
 * @returns {number} Projection factor (0 to 1)
 */
export function projectOnSegment(p, a, b, target) {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ap = new THREE.Vector3().subVectors(p, a);
    
    let t = ap.dot(ab) / ab.lengthSq();
    t = Math.max(0, Math.min(1, t)); // Clamp to segment
    
    target.copy(a).addScaledVector(ab, t);
    return t;
}

/**
 * Pre-samples a curve to speed up track projection searches.
 * @param {THREE.Curve} curve - The track curve
 * @param {number} count - Number of points to sample
 * @returns {Array<{point: THREE.Vector3, t: number}>} Array of sample points
 */
export function sampleCurve(curve, count) {
    const samples = [];
    for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        samples.push({
            point: curve.getPointAt(t),
            t: t
        });
    }
    return samples;
}

/**
 * Projects a 3D position onto a pre-sampled track curve.
 * Uses a localized search window if lastT is provided, falling back to global search.
 * @param {THREE.Vector3} position - Position of the car
 * @param {THREE.Curve} curve - The track spline
 * @param {Array<{point: THREE.Vector3, t: number}>} samples - Pre-sampled track points
 * @param {number} [lastT=0] - The track progress from the previous frame (for local search optimization)
 * @returns {{
 *   t: number,
 *   point: THREE.Vector3,
 *   tangent: THREE.Vector3,
 *   normal: THREE.Vector3,
 *   distance: number,
 *   lateralDistance: number
 * }} Projection data
 */
export function projectOnTrack(position, curve, samples, lastT = 0) {
    const count = samples.length;
    let bestIndex = 0;
    let minDistanceSq = Infinity;
    
    // Determine search bounds (full search if lastT is not valid, otherwise local window)
    let searchStart = 0;
    let searchEnd = count - 1;
    
    if (lastT !== undefined && lastT >= 0 && lastT <= 1) {
        const lastIndex = Math.round(lastT * (count - 1));
        const windowSize = Math.max(10, Math.round(count * 0.05)); // 5% of track search window
        searchStart = (lastIndex - windowSize + count) % count;
        searchEnd = (lastIndex + windowSize) % count;
    }
    
    const projPoint = new THREE.Vector3();
    const tempPoint = new THREE.Vector3();
    let bestT = 0;
    
    const checkSegment = (idx1, idx2) => {
        const a = samples[idx1].point;
        const b = samples[idx2].point;
        const segT = projectOnSegment(position, a, b, tempPoint);
        const distSq = position.distanceToSquared(tempPoint);
        
        if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            projPoint.copy(tempPoint);
            
            // Calculate progress t by interpolating segment progress
            const t1 = samples[idx1].t;
            let t2 = samples[idx2].t;
            if (t2 < t1) t2 += 1.0; // Wrap around for closed loop
            
            bestT = lerp(t1, t2, segT);
            if (bestT > 1.0) bestT -= 1.0;
            bestIndex = idx1;
        }
    };
    
    // Perform search
    if (searchStart <= searchEnd) {
        for (let i = searchStart; i < searchEnd; i++) {
            checkSegment(i, i + 1);
        }
        // Check final segment if it spans the boundary
        if (searchEnd === count - 1) {
            checkSegment(count - 1, 0);
        }
    } else {
        // Search wraps around boundary
        for (let i = searchStart; i < count - 1; i++) {
            checkSegment(i, i + 1);
        }
        checkSegment(count - 1, 0);
        for (let i = 0; i < searchEnd; i++) {
            checkSegment(i, i + 1);
        }
    }
    
    // If local search fails to find a good point (e.g. teleport or jump), fall back to global search
    const maxLocalDistSq = 40 * 40; // 40 units threshold
    if (minDistanceSq > maxLocalDistSq && lastT !== undefined) {
        minDistanceSq = Infinity;
        for (let i = 0; i < count - 1; i++) {
            checkSegment(i, i + 1);
        }
        checkSegment(count - 1, 0);
    }
    
    // Calculate track direction vectors at projection point
    const tangent = curve.getTangentAt(bestT).normalize();
    
    // Normal vector perpendicular to tangent on the XZ plane
    // In Three.js, Y is up, X is left/right, Z is forward/back
    // Let's create a normal vector pointing to the right of the track direction (flat XZ plane)
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    
    // Vector from track center to the car
    const toCar = new THREE.Vector3().subVectors(position, projPoint);
    
    // Calculate lateral offset (signed distance along track normal)
    // Project toCar onto normal vector
    const lateralDistance = toCar.dot(normal);
    
    return {
        t: bestT,
        point: projPoint,
        tangent: tangent,
        normal: normal,
        distance: Math.sqrt(minDistanceSq),
        lateralDistance: lateralDistance
    };
}
