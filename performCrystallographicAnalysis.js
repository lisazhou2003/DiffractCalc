// performCrystallographicAnalysis.js

//Helper Functions (local to this js file)
function crossProduct(v1, v2) {
    return [
        v1[1] * v2[2] - v1[2] * v2[1],
        v1[2] * v2[0] - v1[0] * v2[2],
        v1[0] * v2[1] - v1[1] * v2[0]
    ];
}

function dotProduct(v1, v2) {
    return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
}

function multiplyMatrices(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length || !a[0].length || !b[0].length) {
       // console.error('Need non-empty 2-dimensional arrays for matrix multiplication.');
       return [];
    }
    const x = a.length;
    const z = a[0].length;
    const y = b[0].length;
    if (b.length !== z) {
       // console.error('Number of columns in the first matrix must match number of rows in the second.');
       return [];
    }

    const product = Array(x).fill(0).map(() => Array(y).fill(0));

    for (let i = 0; i < x; i++) {
       for (let j = 0; j < y; j++) {
          for (let k = 0; k < z; k++) {
             product[i][j] += a[i][k] * b[k][j];
          }
       }
    }
    return product;
}

function normalizeVector(v) {
    const magnitude = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return [0, 0, 0];
    return v.map(val => val / magnitude);
}

// Function to calculate inverse of a 3x3 matrix
function matrixInverse3x3(m) {
    const [[a, b, c], [d, e, f], [g, h, i]] = m;

    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if (det === 0) {
        // console.error("Matrix is singular, cannot invert.");
        return null;
    }

    const invDet = 1 / det;

    return [
        [(e * i - f * h) * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet],
        [(f * g - d * i) * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet],
        [(d * h - e * g) * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet]
    ];
}


// Get real-space lattice vectors for any crystal family
export function getDirectLatticeVectors(cellParameters) {
    const { a, b, c, alpha, beta, gamma } = cellParameters;

    const alphaRad = alpha * Math.PI / 180;
    const betaRad = beta * Math.PI / 180;
    const gammaRad = gamma * Math.PI / 180;

    // Using triclinic for generality: See https://www.aflowlib.org/prototype-encyclopedia/triclinic_lattice.html
    const a_vec = [a, 0, 0];
    const b_vec = [b*Math.cos(gammaRad), b*Math.sin(gammaRad), 0];

    let c_x, c_y, c_z;
    c_x = c*Math.cos(betaRad);
    c_y = (c*(Math.cos(alphaRad)-Math.cos(betaRad)*Math.cos(gammaRad)))/Math.sin(gamma)
    c_z = Math.sqrt(c*c - c_x*c_x - c_y*c_y);
    const c_vec = [c_x, c_y, c_z];

    return [a_vec, b_vec, c_vec];
}


// Get reciprocal lattice vectors from direct lattice vectors
export function getReciprocalLatticeVectors(directLatticeVectorsCartesian) {
    const [a_vec, b_vec, c_vec] = directLatticeVectorsCartesian;

    const bCrossC = crossProduct(b_vec, c_vec);
    const cCrossA = crossProduct(c_vec, a_vec);
    const aCrossB = crossProduct(a_vec, b_vec);

    const vol = dotProduct(a_vec, bCrossC); // Unit cell volume

    if (vol === 0) {
        // This should be handled before calling this function in main.js
        console.error("Unit cell volume is zero, cannot calculate reciprocal lattice vectors.");
        return null;
    }

    const aStar = bCrossC.map(x => x / vol);
    const bStar = cCrossA.map(x => x / vol);
    const cStar = aCrossB.map(x => x / vol);

    return [aStar, bStar, cStar];
}

// getMillerIndicesFromCamera() is AI generated
/**
 * Converts a Cartesian vector (e.g., camera eye position) into Miller indices (hkl).
 * This finds the (hkl) plane whose normal is parallel to the Cartesian vector.
 *
 * @param {object} cameraEye - Plotly camera eye object {x, y, z}.
 * @param {Array<Array<number>>} directLatticeVectorsCartesian - [a_vec_cart, b_vec_cart, c_vec_cart]
 * @param {Array<Array<number>>} reciprocalLatticeVectorsCartesian - [aStar, bStar, cStar]
 * @returns {Array<number>} - [h, k, l] Miller indices as integers, or null if calculation fails.
 */
export function getMillerIndicesFromCamera(cameraEye, directLatticeVectorsCartesian, reciprocalLatticeVectorsCartesian) {
    const V_cart = [cameraEye.x, cameraEye.y, cameraEye.z]; // The view direction (normal to screen)

    // The reciprocal lattice vectors a*, b*, c* (in Cartesian coordinates) form a matrix M_reciprocal:
    // [ aStar[0] bStar[0] cStar[0] ]
    // [ aStar[1] bStar[1] cStar[1] ]
    // [ aStar[2] bStar[2] cStar[2] ]
    // A reciprocal lattice vector G_hkl_cart = M_reciprocal * [h, k, l]^T
    // To find [h, k, l]^T from G_hkl_cart, we need [h, k, l]^T = M_reciprocal_inv * G_hkl_cart^T

    // The vector V_cart is proportional to the reciprocal lattice vector G_hkl for the plane (hkl).
    // So, we need to convert V_cart (Cartesian) to its components in the reciprocal basis.

    // Method: The transpose of the matrix of direct lattice vectors maps reciprocal components to Cartesian space.
    // The inverse of the reciprocal lattice matrix (M_reciprocal_cartesian) maps Cartesian space to reciprocal components.

    // Let M_reciprocal_cartesian be:
    // [[aStar[0], bStar[0], cStar[0]],
    //  [aStar[1], bStar[1], cStar[1]],
    //  [aStar[2], bStar[2], cStar[2]]]
    const M_reciprocal_cartesian = [
        [reciprocalLatticeVectorsCartesian[0][0], reciprocalLatticeVectorsCartesian[1][0], reciprocalLatticeVectorsCartesian[2][0]],
        [reciprocalLatticeVectorsCartesian[0][1], reciprocalLatticeVectorsCartesian[1][1], reciprocalLatticeVectorsCartesian[2][1]],
        [reciprocalLatticeVectorsCartesian[0][2], reciprocalLatticeVectorsCartesian[1][2], reciprocalLatticeVectorsCartesian[2][2]]
    ];

    const M_reciprocal_cartesian_inv = matrixInverse3x3(M_reciprocal_cartesian);

    if (!M_reciprocal_cartesian_inv) {
        console.error("Could not invert reciprocal lattice matrix to determine hkl.");
        return null;
    }

    // Now, multiply the inverse matrix by the Cartesian vector V_cart to get h, k, l
    // [h, k, l]^T = M_reciprocal_cartesian_inv * V_cart^T
    const hkl_float = multiplyMatrices(M_reciprocal_cartesian_inv, [[V_cart[0]], [V_cart[1]], [V_cart[2]]]);

    if (!hkl_float || hkl_float.length !== 3 || hkl_float[0].length !== 1) {
        console.error("Matrix multiplication failed for hkl derivation.");
        return null;
    }

    // Extract h, k, l and normalize to smallest integers
    let h = hkl_float[0][0];
    let k = hkl_float[1][0];
    let l = hkl_float[2][0];

    // Normalize to smallest integers
    const tolerance = 1e-6; // Tolerance for considering a number close to zero
    h = Math.abs(h) < tolerance ? 0 : h;
    k = Math.abs(k) < tolerance ? 0 : k;
    l = Math.abs(l) < tolerance ? 0 : l;

    if (h === 0 && k === 0 && l === 0) {
        return [0, 0, 0]; // Special case: no defined plane
    }

    // Find the greatest common divisor to normalize to integers
    // Use math.gcd if available, otherwise implement simple GCD
    const values = [Math.round(h * 1000), Math.round(k * 1000), Math.round(l * 1000)]; // Multiply by a factor to convert to integers for GCD
    const commonDivisor = math.gcd(math.gcd(values[0], values[1]), values[2]);

    if (commonDivisor === 0) { // Avoid division by zero if all values are effectively zero
        return [0, 0, 0];
    }

    const h_int = Math.round(h / (commonDivisor / 1000));
    const k_int = Math.round(k / (commonDivisor / 1000));
    const l_int = Math.round(l / (commonDivisor / 1000));

    // Ensure the first non-zero index is positive if not all are zero
    if (!(h_int === 0 && k_int === 0 && l_int === 0)) {
        if (h_int < 0 || (h_int === 0 && k_int < 0) || (h_int === 0 && k_int === 0 && l_int < 0)) {
            return [-h_int, -k_int, -l_int]; // Flip sign to ensure positive first non-zero index
        }
    }

    return [h_int, k_int, l_int];
}



// Function to compute structure factor and plot them.
export function performCrystallographicAnalysis(parsedData, zoneAxisStr, showMessage) {
    const { cellParameters, chemicalComponents, atomPositions, spaceGroupName } = parsedData;
    const { a: cellLengthA, b: cellLengthB, c: cellLengthC, alpha: cellAlphaAngle, beta: cellBetaAngle, gamma: cellGammaAngle } = cellParameters;
    const { elements = [] } = chemicalComponents;

    if (atomPositions.length === 0 || !cellLengthA || !cellLengthB || !cellLengthC) {
        showMessage("Missing essential data for crystallographic analysis (atoms or cell parameters). Please upload a valid CIF file.", "error");
        return;
    }
    const directLatticeVectorsCartesian = getDirectLatticeVectors(cellParameters);
    const [a_vec_cart, b_vec_cart, c_vec_cart] = directLatticeVectorsCartesian;

    const reciprocalLatticeVectorsCartesian = getReciprocalLatticeVectors(directLatticeVectorsCartesian);

    if (!reciprocalLatticeVectorsCartesian) {
        showMessage("Failed to calculate reciprocal lattice vectors. Check console for details.", "error");
        return;
    }
    const [aStar, bStar, cStar] = reciprocalLatticeVectorsCartesian;
    // console.log("Reciprocal Lattice Vectors (a*, b*, c*):", reciprocalLatticeVectorsCartesian);

    // Calculate the kinematic structure factor
    const k_max = 1 // Angstrom^-1, maximum reciprocal space vector length
    const h_range = Math.ceil(k_max/dotProduct(aStar, aStar) ** 0.5);
    const k_range = Math.ceil(k_max/dotProduct(bStar, bStar) ** 0.5);
    const l_range = Math.ceil(k_max/dotProduct(cStar, cStar) ** 0.5);

    const listofPlanes = [];
    const structureFactors = {};
    const structureFactorMagnitudes = [];

    for (let h = -h_range; h <= h_range; h++) {
        for (let k = -k_range; k <= k_range; k++) {
            for (let l = -l_range; l <= l_range; l++) {
                listofPlanes.push([h, k, l]);

                let F_re = 0;
                let F_im = 0;

                atomPositions.forEach(atom => {
                    const angle = 2 * Math.PI * (h * atom.x + k * atom.y + l * atom.z);
                    F_re += Math.cos(angle);
                    F_im += Math.sin(angle);
                });

                const magnitude = Math.sqrt(F_re ** 2 + F_im ** 2);
                structureFactors[`${h},${k},${l}`] = magnitude; //only storing and plotting magnitude |F|; maybe store |F|^2 instead?
                structureFactorMagnitudes.push(magnitude);
            }
        }
    }
    // console.log("Calculated Structure Factors:", structureFactors);

    let zoneAxis = zoneAxisStr.split(',').map(Number); // Split by comma now
    // Handle cases where input is "1,0,0" or "100" etc.
    if (zoneAxis.length !== 3 || zoneAxis.some(isNaN) || zoneAxis.every(val => val === 0)) {
        console.warn("Invalid or zero Miller plane input, defaulting to 1,0,0.");
        // showMessage("Invalid or zero Miller plane input, defaulting to 1,0,0.", "error");
        zoneAxis = [1, 0, 0];
        zoneAxisStr = "1,0,0"; // Update string if default is used
    }

    // Calculate the reciprocal lattice vector G_hkl which is normal to the (hkl) plane
    const g_hkl = [
        zoneAxis[0] * aStar[0] + zoneAxis[1] * bStar[0] + zoneAxis[2] * cStar[0],
        zoneAxis[0] * aStar[1] + zoneAxis[1] * bStar[1] + zoneAxis[2] * cStar[1],
        zoneAxis[0] * aStar[2] + zoneAxis[1] * bStar[2] + zoneAxis[2] * cStar[2]
    ];
    const normalPlaneVector = normalizeVector(g_hkl);
    // console.log("Normal vector to desired plane:", normalPlaneVector);

    // Create a new orthogonal basis for projection: xVector, yVector, and normalPlaneVector
    const dummyVector = Math.abs(normalPlaneVector[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let yVector = crossProduct(dummyVector, normalPlaneVector);
    yVector = normalizeVector(yVector);
    let xVector = crossProduct(normalPlaneVector, yVector);
    xVector = normalizeVector(xVector);

    // Project reciprocal lattice points onto this new basis for 2D diffraction plot
    const projectedCoords = listofPlanes.map(([h,k,l]) => {
        const gVec = [
            h * aStar[0] + k * bStar[0] + l * cStar[0],
            h * aStar[1] + k * bStar[1] + l * cStar[1],
            h * aStar[2] + k * bStar[2] + l * cStar[2]
        ];
        return [
            dotProduct(gVec, xVector), // X-coordinate in the new basis
            dotProduct(gVec, yVector), // Y-coordinate in the new basis
            dotProduct(gVec, normalPlaneVector) // Z-coordinate (component along the normal)
        ];
    });
    // console.log("Projected Reciprocal Space Coordinates:", projectedCoords);

    // Prepare data for diffraction pattern visualization
    let diffractionDataPoints = [];
    projectedCoords.forEach((coords, index) => {
        const magnitude = structureFactorMagnitudes[index];
        // Ensure h,k,l are not all zero and have some intensity
        if (magnitude > 0.001 || (listofPlanes[index][0] === 0 && listofPlanes[index][1] === 0 && listofPlanes[index][2] === 0 && magnitude > 0)) {
            diffractionDataPoints.push({
                x: coords[0],
                y: coords[1],
                label: listofPlanes[index].join(','),
                markerSize: (magnitude / (Math.max(...structureFactorMagnitudes) || 1)) * 10 + 5 // Scale marker size dynamically, min size 5
            });
        }
    });
    // console.log("Diffraction Data Points:", diffractionDataPoints);


    // Plotting the crystal structure using Plotly; generated by AI
    const atomCoordByElement = {};

    atomPositions.forEach(atom => {
        // For plotting, we scale fractional coordinates by cell lengths for a better visual representation
        // (though Plotly also handles fractional directly, this makes atoms appear in correct relative scale)
        const x_cart = atom.x * a_vec_cart[0] + atom.y * b_vec_cart[0] + atom.z * c_vec_cart[0];
        const y_cart = atom.x * a_vec_cart[1] + atom.y * b_vec_cart[1] + atom.z * c_vec_cart[1];
        const z_cart = atom.x * a_vec_cart[2] + atom.y * b_vec_cart[2] + atom.z * c_vec_cart[2];

        if (!atomCoordByElement[atom.label]) {
            atomCoordByElement[atom.label] = { x: [], y: [], z: [] };
        }
        atomCoordByElement[atom.label].x.push(x_cart);
        atomCoordByElement[atom.label].y.push(y_cart);
        atomCoordByElement[atom.label].z.push(z_cart);
    });

    const markerSize = 15; // Increased marker size for solid balls
    const { a, b, c, alpha, beta, gamma } = cellParameters;
    const plotlyLayout = {
        title: {
            text: `Zone axis: ${zoneAxisStr}`
        },
        legend: {
            font: {
                size: 20
            }
        },
        scene: {
            // New: Set projection type to orthographic for better symmetry understanding
            camera: {
                projection: {
                    type: 'orthographic' 
                },
                // Initial camera eye is set to look along the normal, as before.
                // This will be overridden by user interaction once plot loads.
                eye: {
                    x: normalPlaneVector[0] * 2,
                    y: normalPlaneVector[1] * 2,
                    z: normalPlaneVector[2] * 2
                },
                // up: {
                //     x: xVector[0],
                //     y: xVector[1],
                //     z: xVector[2]
                // }
            },

            xaxis: { visible: false }, // Use Angstroms for axis labels
            yaxis: { visible: false },
            zaxis: { visible: false },
            aspectmode: 'data' // ensures aspect ratio of orignal data is maintained
        },
        // Prevent Plotly from showing specific modes by default.
        modebar: {
            remove: ['zoom3d', 'pan3d', 'hoverClosest3d', 'hoverCompare3d']
        }
    };

    // const plotlyData = [traceType1, traceType2].filter(trace => trace.x.length > 0);
    const traceColors = ['rgba(65, 192, 234, 1.0)', 'rgba(217, 217, 217, 1.0)', 'rgba(255, 99, 132, 1.0)', 'rgba(0, 200, 83, 1.0)'];

    const plotlyData = elements.map((entry, index) => {
        const label = entry.element;
        const coords = atomCoordByElement[label] || { x: [], y: [], z: [] };
        return {
            x: coords.x,
            y: coords.y,
            z: coords.z,
            mode: 'markers',
            marker: {
                size: markerSize,
                color: traceColors[index % traceColors.length],
                opacity: 1.0,
                line: {
                    color: 'rgba(0, 0, 0, 0.1)',
                    width: 0.5
                }
            },
            type: 'scatter3d',
            name: label
        };
    }).filter(trace => trace.x.length > 0);

    // Use Plotly.react to efficiently update the plot without re-creating it from scratch
    Plotly.react('structureCanvas', plotlyData, plotlyLayout);


    // Plot diffraction pattern using CanvasJS
    const canvasjsChart = new CanvasJS.Chart("diffractionCanvas", {
        axisX: {
            gridThickness: 0,
            lineThickness: 1,
            tickThickness: 0,
            minimum: -1.0, 
            maximum: 1.0,
            labelFormatter: function() { return ""; } 
        },
        axisY: {
            gridThickness: 0,
            lineThickness: 1,
            tickThickness: 0,
            minimum: -1.0, 
            maximum: 1.0,
            labelFormatter: function() { return ""; } 
        },
        title: {
            text: `Zone axis: ${zoneAxisStr}`,
            fontFamily: 'tahoma',
            fontSize: 20
        },
        data: [{
            type: "scatter",
            markerColor: "black",
            toolTipContent: "({label})<br/>Intensity: {markerSize}",
            dataPoints: diffractionDataPoints,
            marker: {
                type: "circle"
            }
        }]
    });
    canvasjsChart.render();
}