// parseCIF.js

// Helper functions
function isLetter(character) {
  return /^[A-Za-z]$/.test(character);
}

function isNumber(value) {
  return !Number.isNaN(Number(value)) && Number.isFinite(Number(value));
}

// Function to parse the main sections of the CIF file
export function parseCifInfo(cifInfo) {
  const data = {
    cellParameters: {},
    chemicalComponents: {},
    atomPositions: [],
    spaceGroupName: "N/A",
    spaceGroupNumber: "N/A"
  };

  // --- Parse Space Group Name ---
  const spaceGroupHMAltMatch = cifInfo.match(/_space_group_name_H-M_alt\s+'([^']+)'/);
  const spaceGroupHallMatch = cifInfo.match(/_space_group_name_Hall\s+'([^']+)'/);

  if (spaceGroupHMAltMatch && spaceGroupHMAltMatch[1]) {
      data.spaceGroupName = spaceGroupHMAltMatch[1].trim();
  } else if (spaceGroupHallMatch && spaceGroupHallMatch[1]) {
      data.spaceGroupName = spaceGroupHallMatch[1].trim();
  } else {
      console.warn("Could not find _space_group_name_H-M_alt or _space_group_name_Hall tag.");
  }

  // --- Parse Space Group Number ---
  const spaceGroupNumberMatch = cifInfo.match(/_space_group_IT_number\s+(\d+)/);
  if (spaceGroupNumberMatch && spaceGroupNumberMatch[1]) {
    data.spaceGroupNumber = parseInt(spaceGroupNumberMatch[1], 10);
  } else {
    console.warn("Could not find _space_group_IT_number tag.");
  }


//   // --- Parse Chemical Components ---
//   const formulaMatch = cifInfo.match(/_chemical_formula_structural\s+'([^']+)'/);
//   if (formulaMatch && formulaMatch[1]) {
//     const formulaString = formulaMatch[1].trim();
//     const elementRegex = /([A-Z][a-z]*)(\d*)/g;
//     let match;
//     const elementsFound = [];
//     while ((match = elementRegex.exec(formulaString)) !== null) {
//       elementsFound.push({
//         element: match[1],
//         number: match[2] ? parseInt(match[2], 10) : 1
//       });
//     }

//     if (elementsFound.length > 0) {
//       data.chemicalComponents.element1 = elementsFound[0].element;
//       if (elementsFound.length > 1) {
//         data.chemicalComponents.element2 = elementsFound[1].element;
//       }
//     }
//   } else {
//     console.warn("Could not find _chemical_formula_structural tag. Chemical components might be missing.");
//   }

// --- Parse Chemical Components ---
    const formulaMatch = cifInfo.match(/_chemical_formula_structural\s+'([^']+)'/);
    if (formulaMatch && formulaMatch[1]) {
    const formulaString = formulaMatch[1].trim();

    // Match element symbols (e.g. "Te", "Gd") and optional counts (e.g. "3")
    const elementRegex = /([A-Z][a-z]*)(\d*\.?\d*)/g;

    let match;
    const elementsFound = [];

    while ((match = elementRegex.exec(formulaString)) !== null) {
        const element = match[1];
        const count = match[2] ? parseFloat(match[2]) : 1;
        elementsFound.push({ element, number: count });
    }

    // Store as an array (general case)
    data.chemicalComponents.elements = elementsFound;

    // Optionally for backward compatibility:
    if (elementsFound.length > 0) {
        data.chemicalComponents.element1 = elementsFound[0].element;
    }
    if (elementsFound.length > 1) {
        data.chemicalComponents.element2 = elementsFound[1].element;
    }

    } else {
    console.warn("Could not find _chemical_formula_structural tag. Chemical components might be missing.");
    }



  // --- Parse Cell Parameters ---
  const parseCellParam = (tag) => {
    const match = cifInfo.match(new RegExp(`${tag}\\s*([\\d\\.]+)(?:\\(\\d+\\))?`));
    return match ? parseFloat(match[1]) : undefined;
  };

  data.cellParameters.a = parseCellParam('_cell_length_a');
  data.cellParameters.b = parseCellParam('_cell_length_b');
  data.cellParameters.c = parseCellParam('_cell_length_c');
  data.cellParameters.alpha = parseCellParam('_cell_angle_alpha');
  data.cellParameters.beta = parseCellParam('_cell_angle_beta');
  data.cellParameters.gamma = parseCellParam('_cell_angle_gamma');


  // Parse symmetry operations
    const SYMMETRY_TAGS = [
        '_space_group_symop_operation_xyz',
        '_symmetry_equiv_pos_as_xyz',
        '_symmetry_equiv_pos_xyz',
    ];
    let symmetryOperations = [];
    const cifLines = cifInfo.split('\n').map(line => line.trim()); //Split the CIF file into lines and trim whitespace
    // console.log("CIF Lines:", cifLines);
    let symmetryLoopStartIndex = -1;
    let foundSymmetryTag = '';
    let symmetryTagIndex = -1;
    
    for (let i = 0; i < cifLines.length; i++) {
        // console.log("Line read:", cifLines[i]);
        if (cifLines[i].toLowerCase() === 'loop_') {
            // console.log("Found loop beginning:", cifLines[i]);
            let j = i+1;
            let tags = [];
            while (j < cifLines.length && cifLines[j].startsWith('_')) {
                // console.log("Found symmetry tag:", cifLines[j]);
                tags.push(cifLines[j]);
                j++;
            }
            for (const tag of SYMMETRY_TAGS) {
                const index = tags.indexOf(tag);
                if (index !== -1) {
                    symmetryLoopStartIndex = i;
                    symmetryTagIndex = index;
                    foundSymmetryTag = tag;
                    break;
                }
            }
            if (symmetryLoopStartIndex !== -1) break; // Found the loop, exit outer loop
        }
    }
    
    if (symmetryLoopStartIndex !== -1 && foundSymmetryTag) {
        let dataLines = [];
        for (let i = symmetryLoopStartIndex + 1; i < cifLines.length; i++) {
            const line = cifLines[i];
            // console.log("Processing symmetry line:", line);
            if (line.startsWith('_')) continue;
            if (line.toLowerCase().startsWith('loop_') || line.startsWith('#') || line.trim() === '') break; // End of symmetry data
            dataLines.push(line);
        }

        for (const line of dataLines) {
            const parts = [];
            const regex = /'[^']*'|"[^"]*"|\S+/g;
            let match;
            while ((match = regex.exec(line)) !== null) {
                parts.push(match[0]);
            }
            if (parts.length > symmetryTagIndex)  {
                let op = parts[symmetryTagIndex].trim();
                if (op.startsWith("'") && op.endsWith("'") || op.startsWith('"') && op.endsWith('"')) {
                    op = op.substring(1, op.length - 1); // Remove quotes
                }
                if (op) symmetryOperations.push(op);
            }
        }
    }

  if (symmetryOperations.length === 0) {
    console.warn("No symmetry operations found or parsed from CIF, defaulting to 'x,y,z'.");
    symmetryOperations = ["x,y,z"];
  }
//   console.log("Parsed Symmetry Operations:", symmetryOperations);


// Parse Atomic Positions
  let atomSiteLoopStart = -1;

  for (let i = 0; i < cifLines.length; i++) {
    if(cifLines[i] === 'loop_') {
        for (let j = i + 1; j < Math.min(i + 10, cifLines.length); j++) { // Check next few lines for _atom_site_ tag
            if (cifLines[j].startsWith('_atom_site_')) {
                atomSiteLoopStart = i; // Get precise index of THIS loop_
                break;
            }
        }
    }
    if (atomSiteLoopStart !== -1) break; // Found the loop, exit outer loop
  }

  if (atomSiteLoopStart === -1) {
    console.error("Could not find the 'loop_' for atomic position data containing '_atom_site_' tags. Cannot parse atomic positions.");
    return null;
  }

    const atomSiteBlock = cifLines.slice(atomSiteLoopStart); //new
    // console.log("Atom Site Block:", atomSiteBlock);

  let labels = [];
  let dataStartsIndex = -1;

  for (let i = 0; i < atomSiteBlock.length; i++) {
    const line = atomSiteBlock[i];
    if (line.startsWith('_atom_site_')) {
        labels.push(line.replace('_atom_site_', '').trim());
    } 
    else if (labels.length > 0 && !line.startsWith('#') && !line.startsWith('loop_') ){
        dataStartsIndex = i;
        break; // Found the start of data lines after headers
    }
}

  if (dataStartsIndex === -1) {
    console.warn("Could not find start of atomic position data lines after headers for _atom_site_ loop.");
    return null;
  }

  const xIndex = labels.indexOf('fract_x');
  const yIndex = labels.indexOf('fract_y');
  const zIndex = labels.indexOf('fract_z');
  const labelIndex = labels.indexOf('label');

  if (xIndex === -1 || yIndex === -1 || zIndex === -1) {
    console.error("Missing fractional coordinate headers (_atom_site_fract_x,y,y) in atom_site loop. Cannot parse atomic positions.");
    return null;
  }
  if (labelIndex === -1) {
      console.warn("'_atom_site_label' not found. Atom labels might be incorrect.");
  }

  // Extract atom data lines, filtering out comments and empty lines
  const atomDataLines = atomSiteBlock.slice(dataStartsIndex).filter(line => !line.startsWith('#') && !line.startsWith('_') && !line.startsWith('loop_') && line.trim() !== '');

  if (atomDataLines.length === 0) {
      console.warn("Atom data lines extracted but appear to be empty or only contain comments/tags after filtering.");
      return null;
  }

  for (let i = 0; i < atomDataLines.length; i++) {
    const parts = atomDataLines[i].split(/\s+/).filter(Boolean); // \s is any whitespace character, + means one or more, filter(Boolean) removes empty strings

    // Determine atom label from _atom_site_label; can use this later for atomic scattering factors
    if (parts.length > Math.max(xIndex, yIndex, zIndex)) {
      let currentAtomLabel = 'Unknown';
      if (labelIndex !== -1 && parts[labelIndex]) {
          currentAtomLabel = parts[labelIndex];
      } else if (parts[0]) {
          currentAtomLabel = parts[0];
      }

      // Extract fractional atomic coordinates
      const initialCoords = {
        x: Number(parts[xIndex].split('(')[0]),
        y: Number(parts[yIndex].split('(')[0]),
        z: Number(parts[zIndex].split('(')[0])
      };

      if (isNaN(initialCoords.x) || isNaN(initialCoords.y) || isNaN(initialCoords.z)) {
          console.warn(`Skipping malformed atom line (non-numeric coords): ${atomDataLines[i]}`);
          continue;
      }

    // Extract chemical element from the label, eg. Te1 -> Te
      let actualElementType = currentAtomLabel.match(/([A-Z][a-z]*)/);
      actualElementType = actualElementType ? actualElementType[1] : 'Unknown';

      if (actualElementType === 'Unknown') {
          if (data.chemicalComponents.element1 && currentAtomLabel.includes(data.chemicalComponents.element1)) {
              actualElementType = data.chemicalComponents.element1;
          } else if (data.chemicalComponents.element2 && currentAtomLabel.includes(data.chemicalComponents.element2)) {
              actualElementType = data.chemicalComponents.element2;
          }
      }

      // Now apply symmetry operations to the original coordinates and get complete list of positions
      symmetryOperations.forEach(opString => { // i.e., for each symmetry operation...
        let x_new, y_new, z_new;
        try {
            const scope = { x: initialCoords.x, y: initialCoords.y, z: initialCoords.z };
            const ops = opString.split(',').map(s => s.trim());

            x_new = math.evaluate(ops[0], scope); // math.evaluate("x+1/2", 0.3) = 0.3 + 1/2 = 0.8
            y_new = math.evaluate(ops[1], scope);
            z_new = math.evaluate(ops[2], scope);

        } catch (e) {
            console.error(`Error evaluating symmetry operation '${opString}' for atom ${currentAtomLabel}:`, e);
            return;
        }
        // Reduce coordinates to the unit cell (0-1 range)
        x_new = (x_new % 1 + 1) % 1;
        y_new = (y_new % 1 + 1) % 1;
        z_new = (z_new % 1 + 1) % 1;

        data.atomPositions.push({
          x: x_new,
          y: y_new,
          z: z_new,
          label: actualElementType
        });
      });
    } else {
        console.warn(`Skipping malformed atom line (not enough parts): ${atomDataLines[i]}`);
    }
  }
  console.log('Parsed CIF data:', data);
  return data;
}