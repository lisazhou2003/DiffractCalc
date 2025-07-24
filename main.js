// main.js
import { parseCifInfo } from './parseCIF.js';
import { performCrystallographicAnalysis, getDirectLatticeVectors, getReciprocalLatticeVectors, getMillerIndicesFromCamera } from './performCrystallographicAnalysis.js';

// Global variables
let currentParsedCifData = null;
let debounceTimeoutForCamera = null;

// get DOM elements
const fileInput = document.getElementById("cifFile");
const messageDisplay = document.getElementById("message");
const statusDisplay = document.getElementById("status");

// define elements for CIF summary display
const displaySpaceGroup = document.getElementById("displaySpaceGroup");
const displayElements = document.getElementById("displayElements");
const displayA = document.getElementById("displayA");
const displayB = document.getElementById("displayB");
const displayC = document.getElementById("displayC");
const displayAlpha = document.getElementById("displayAlpha");
const displayBeta = document.getElementById("displayBeta");
const displayGamma = document.getElementById("displayGamma");
const updatePlotButton = document.getElementById("updatePlotButton");
const planeInput = document.getElementById("planeInput");
const structureCanvas = document.getElementById("structureCanvas"); 


// Helper function to display messages
function showMessage(message, type) {
  messageDisplay.textContent = message;
  messageDisplay.style.color = type === "error" ? "red" : "green";
}

// Function to clear summary display
function clearSummaryDisplay() {
  displaySpaceGroup.textContent = "N/A";
  displayElements.textContent = "N/A";
  displayA.textContent = "N/A";
  displayB.textContent = "N/A";
  displayC.textContent = "N/A";
  displayAlpha.textContent = "N/A";
  displayBeta.textContent = "N/A";
  displayGamma.textContent = "N/A";
}

// Function to update the plots and UI based on new plane
function updatePlotsAndUI(planeStr, cameraEye=null) {
    if (currentParsedCifData) {
        // Update the Miller Plane input field
        planeInput.value = planeStr;
        // Re-run analysis with the new plane input
        performCrystallographicAnalysis(currentParsedCifData, planeStr, showMessage, cameraEye);
        showMessage("Diffraction view updated!", "success");
    } else {
        showMessage("Please upload a CIF file first.", "error");
    }
}


// Main file handling function
function handleFileSelection(event) {
  const file = event.target.files[0];
  messageDisplay.textContent = ""; // Clear previous messages
  clearSummaryDisplay(); // Clear summary on new file selection
  statusDisplay.textContent = "Processing file...";

  if (!file) {
    showMessage("No file selected. Please choose a file.", "error");
    statusDisplay.textContent = "Upload a CIF file to begin.";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const cifInfo = reader.result.toString();
    // console.log("CIF Content (raw):\n", cifInfo); // for debugging

    currentParsedCifData = parseCifInfo(cifInfo); // Call the parsing function

    if (!currentParsedCifData) {
      showMessage("Failed to parse CIF file. Check console for details.", "error");
      statusDisplay.textContent = "Error parsing CIF file.";
      return;
    }

    // Display the the parsed information
    displaySpaceGroup.textContent = currentParsedCifData.spaceGroupName || "N/A";
    let elementsDisplay = [];
    if (currentParsedCifData.chemicalComponents.element1) elementsDisplay.push(currentParsedCifData.chemicalComponents.element1);
    if (currentParsedCifData.chemicalComponents.element2) elementsDisplay.push(currentParsedCifData.chemicalComponents.element2);
    displayElements.textContent = elementsDisplay.join(', ') || "N/A";

    displayA.textContent = currentParsedCifData.cellParameters.a !== undefined ? currentParsedCifData.cellParameters.a.toFixed(4) : "N/A";
    displayB.textContent = currentParsedCifData.cellParameters.b !== undefined ? currentParsedCifData.cellParameters.b.toFixed(4) : "N/A";
    displayC.textContent = currentParsedCifData.cellParameters.c !== undefined ? currentParsedCifData.cellParameters.c.toFixed(4) : "N/A";
    displayAlpha.textContent = currentParsedCifData.cellParameters.alpha !== undefined ? currentParsedCifData.cellParameters.alpha.toFixed(2) : "N/A";
    displayBeta.textContent = currentParsedCifData.cellParameters.beta !== undefined ? currentParsedCifData.cellParameters.beta.toFixed(2) : "N/A";
    displayGamma.textContent = currentParsedCifData.cellParameters.gamma !== undefined ? currentParsedCifData.cellParameters.gamma.toFixed(2) : "N/A";

    // Initial plotting
    updatePlotsAndUI(planeInput.value);

    showMessage("CIF file processed successfully!", "success");
    statusDisplay.textContent = "CIF file loaded. View crystal structure and diffraction pattern.";

    // The following piece of code is AI generated. 
    // --- NEW: Add Plotly camera listener after the chart is initialized ---
    // This listener should be added only once the Plotly div is ready and plot is created.
    // Plotly.react ensures the div is ready.
    structureCanvas.on('plotly_relayout', (eventdata) => {
        if (eventdata['scene.camera.eye'] || (eventdata['scene.camera'] && eventdata['scene.camera'].eye)) {
            clearTimeout(debounceTimeoutForCamera);
            debounceTimeoutForCamera = setTimeout(() => {
                const newCameraEye = eventdata['scene.camera.eye'] || eventdata['scene.camera'].eye;

                if (newCameraEye && currentParsedCifData) {
                    const directLatticeVectors = getDirectLatticeVectors(currentParsedCifData.cellParameters);
                    const reciprocalLatticeVectors = getReciprocalLatticeVectors(directLatticeVectors);

                    if (!directLatticeVectors || !reciprocalLatticeVectors) {
                        console.error("Lattice vectors not available for camera conversion.");
                        return;
                    }

                    const millerIndices = getMillerIndicesFromCamera(
                        newCameraEye,
                        directLatticeVectors,
                        reciprocalLatticeVectors
                    );

                    if (millerIndices && millerIndices.length === 3) {
                        const hklString = `${millerIndices[0]},${millerIndices[1]},${millerIndices[2]}`;
                        console.log("Derived HKL from camera:", hklString);
                        // Pass the current camera eye to updatePlotsAndUI
                        updatePlotsAndUI(hklString, newCameraEye); // MODIFICATION HERE
                    } else {
                        console.warn("Could not derive valid Miller indices from camera position.");
                    }
                }
            }, 200);
        }
    });

  };

  reader.onerror = () => {
    showMessage("Error reading the file. Please try again.", "error");
    statusDisplay.textContent = "Error reading file.";
  };
  reader.readAsText(file);
}


// Event Listeners
fileInput.addEventListener("change", handleFileSelection);

// "Update Diffraction View" button
updatePlotButton.addEventListener('click', () => {
    if (currentParsedCifData) {
        updatePlotsAndUI(planeInput.value);
    } else {
        showMessage("Please upload a CIF file first.", "error");
    }
});


// Initial message
window.addEventListener('load', () => {
    statusDisplay.textContent = 'Upload a CIF file to begin.';
});