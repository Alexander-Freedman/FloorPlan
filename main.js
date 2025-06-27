// Initialize Bootstrap tooltips when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  );
  tooltipTriggerList.map((el) => new bootstrap.Tooltip(el));
  console.log("Bootstrap tooltips initialized.");
});

// Log user action to Google Form
function logAction(action) {
  const formUrl =
    "https://docs.google.com/forms/d/e/1FAIpQLSflgeBvjw0Fe6cus1C6wV2e39cQU0RzpbaFxMrz8t-Mx-xvug/formResponse";
  const formData = new URLSearchParams();
  formData.append("entry.1427598345", getUserId()); // User ID
  formData.append("entry.1375503741", action); // Action
  fetch(formUrl, {
    method: "POST",
    mode: "no-cors",
    body: formData,
  });
  console.log("Logging action:", action);
}

// Create or retrieve a unique user ID (fingerprint)
function getUserId() {
  const key = "fp_user_id";
  let id = localStorage.getItem(key);
  if (!id) {
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      Math.random().toString(36).substring(2, 10),
    ].join("|");
    id = btoa(fingerprint).substring(0, 16);
    localStorage.setItem(key, id);
    console.log("Generated new user ID:", id);
  } else {
    console.log("Existing user ID:", id);
  }
  return id;
}

// Photopea scripts (for deleting text layers and saving as PDF)
const fullScript_primary = `
    function deleteTextLayers(layers) {
      for (var i = layers.length - 1; i >= 0; i--) {
        var L = layers[i];
        if (L.typename == 'ArtLayer') {
          var b = L.bounds, h = Math.round(b[3] - b[1]), w = Math.round(b[2] - b[0]);
          if (L.kind == LayerKind.TEXT || (h === w && w <= 13)) L.remove();
        } else if (L.typename == 'LayerSet') {
          deleteTextLayers(L.layers);
        }
      }
    }
    (function() { 
      deleteTextLayers(app.activeDocument.layers); 
      app.activeDocument.saveToOE("pdf");
      app.activeDocument.flatten();      
    })();
  `.trim();

const fullScript_trim = `
    var phrase = /floor\\s+plan\\s+drawings/i;
    function hasPhrase(layer) {
      if (layer.typename === "ArtLayer" && layer.kind === LayerKind.TEXT)
        return phrase.test(layer.textItem.contents);
      if (layer.layers)
        for (var j = 0; j < layer.layers.length; j++)
          if (hasPhrase(layer.layers[j])) return true;
      return false;
    }
    var pages = app.activeDocument.layers;
    for (var i = pages.length - 1; i >= 0; i--)
      if (!hasPhrase(pages[i])) pages[i].remove();
    function deleteTextLayers(layers) {
      for (var i = layers.length - 1; i >= 0; i--) {
        var L = layers[i];
        if (L.typename == 'ArtLayer') {
          var b = L.bounds, h = Math.round(b[3] - b[1]), w = Math.round(b[2] - b[0]);
          if (L.kind == LayerKind.TEXT || (h === w && w <= 13)) {
            L.remove();
          }
        } else if (L.typename == 'LayerSet') {
          deleteTextLayers(L.layers);
        }
      }
    }
    (function () {
      deleteTextLayers(app.activeDocument.layers);
      app.activeDocument.saveToOE('pdf');
      app.activeDocument.flatten();
    })();
  `.trim();

// Reference DOM elements
const input = document.getElementById("fileInput");
const trimCheckbox = document.getElementById("trimCheckbox");
const actionBtn = document.getElementById("actionBtn");
const exportCtrls = document.getElementById("export-controls");
const placeholder = document.getElementById("placeholder");
const pdfEmbed = document.getElementById("pdfEmbed");
const downloadBtn = document.getElementById("downloadBtn");
const saveAsBtn = document.getElementById("saveAsBtn");
const errorMsg = document.getElementById("errorMsg");
const statusMsg = document.getElementById("statusMsg");
const infoFilename = document.getElementById("info-filename");
const infoDate = document.getElementById("info-date");
const infoSize = document.getElementById("info-size");
const pdfCanvas = document.getElementById("pdfCanvas");
const overlay = document.getElementById("overlay");
const completeBtn = document.getElementById("completeBtn");
const clearBtn = document.getElementById("clearBtn");
const drawCtrls = document.getElementById("draw-controls");
const status = document.getElementById("status");
const canvasContainer = document.getElementById("canvasContainer");
const { jsPDF } = window.jspdf;
const trimSect = document.getElementById("trimSect");
const snapToBox = document.getElementById("snapToBox");
console.log("DOM elements referenced.");

// State variables
let originalName = "",
  latestBlob = null,
  latestUrl = "",
  messageHandler = null;
let trim_bool = false;
let snapToBool = true;
let canvasCtx, overlayCtx;
let pageWidth, pageHeight;
let pdfDoc = null;
let pdfPixels = null;
let allPolygons = []; // completed polygons
let polygon = []; // current drawing polygon points
let isDrawing = true;
 pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
console.log("State variables initialized.");

// Update trim flag when checkbox changes
trimCheckbox.addEventListener("change", () => {
  trim_bool = trimCheckbox.checked;
  console.log("Trim checkbox changed:", trim_bool);
});

// Format bytes for display
function fmtBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

// Handle file selection
input.addEventListener("change", () => {
  errorMsg.style.display = "none";
  statusMsg.style.display = "none";
  if (!input.files.length) return;
  const file = input.files[0];
  // Validate PDF file
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    console.warn("Invalid file type selected:", file.name);
    errorMsg.textContent = "Please select a PDF file.";
    errorMsg.style.display = "block";
    input.value = "";
    return;
  }

  console.log("File selected:", file.name, `(${fmtBytes(file.size)})`);

  // Show trim option and reset UI
  trimSect.setAttribute("style", "display: block");
  exportCtrls.classList.add("d-none");
  drawCtrls.classList.add("d-none");
  if (canvasContainer) canvasContainer.classList.add("d-none");

  // Reset previous PDF data ???
  if (latestUrl) {
    URL.revokeObjectURL(latestUrl);
    latestUrl = "";
  }

  actionBtn.disabled = false;
  originalName = file.name;
  infoFilename.textContent = originalName;
  infoDate.textContent = new Date().toLocaleString();
  infoSize.textContent = fmtBytes(file.size);

  // Reset drawing state
  allPolygons = [];
  polygon = [];
  isDrawing = true;
  completeBtn.disabled = true;
  clearBtn.disabled = true;

  placeholder.style.display = "none";
  pdfEmbed.hidden = false;
  pdfEmbed.setAttribute("style", "display: block")
  pdfEmbed.src = URL.createObjectURL(file);
});

// Try to find nearest "floor plan" lines by color
      function snapToContour(x, y) {
        const radius = 45;
        let best = { x, y, dist2: radius * radius };
        if (!pdfPixels) return { x, y };
        for (let dy = -radius; dy <= radius; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= pageHeight) continue;
          for (let dx = -radius; dx <= radius; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= pageWidth) continue;
            const d2 = dx * dx + dy * dy;
            if (d2 >= best.dist2) continue;
            const idx = (yy * pageWidth + xx) * 4;
            const r = pdfPixels[idx], g = pdfPixels[idx+1], b = pdfPixels[idx+2];
            if (Math.abs(r-g) < 20 && Math.abs(r-b) < 20 && r > 80 && r < 200) {
              best = { x: xx, y: yy, dist2: d2 };
            }
          }
        }
        return { x: best.x, y: best.y };
      }

// Handle drawing points on overlay
overlay.addEventListener("click", (e) => {
  if (!isDrawing) return;
  const rawX = e.offsetX;
  const rawY = e.offsetY;
  polygon.push({ x: rawX, y: rawY });
  completeBtn.disabled = polygon.length < 3;
  drawOverlay();
  console.log(
    `Overlay click at (${rawX}, ${rawY}). Polygon length: ${polygon.length}`
  );
  status.textContent = `Outlined points: ${polygon.length}.`;
});

// Preview line segment while moving mouse
overlay.addEventListener("mousemove", (e) => {
  if (!isDrawing || polygon.length === 0) return; // ???
  const rawX = e.offsetX;
  const rawY = e.offsetY;
  drawOverlay({ x: rawX, y: rawY });
});

// Finalize the polygon shape
completeBtn.addEventListener("click", () => {
  if (polygon.length < 3) return;
  console.log("Complete button clicked. Finalizing polygon.");
  isDrawing = false;
  clearBtn.disabled = true;
  if (snapToBool) {
    for (let i = 0; i < polygon.length; i++) {
      const snapped = snapToContour(polygon[i].x, polygon[i].y);
      polygon[i] = { x: snapped.x, y: snapped.y };
    }
    console.log("Polygon points snapped to contours.");
  }
  allPolygons.push(polygon);
  fillPolygon(polygon);
  polygon = [];
  isDrawing = true;
  completeBtn.disabled = true;
  status.textContent = "Shape filled. Continue or download.";
  console.log("Polygon completed and filled.");
});

// Clear all drawn shapes
clearBtn.addEventListener("click", () => {
  console.log("Clear button clicked. Clearing drawings.");
  allPolygons = [];
  polygon = [];
  isDrawing = true;
  clearBtn.disabled = true;
  drawOverlay();
  status.textContent = "Drawing cleared. Click to start again.";
});

// Toggle snap-to-contour
snapToBox.addEventListener("change", () => {
  snapToBool = snapToBox.checked;
  console.log("Snap to contour set to:", snapToBool);
});

// Draw existing polygons and preview line on overlay
function drawOverlay(preview) {
  overlayCtx.clearRect(0, 0, pageWidth, pageHeight);
  overlayCtx.strokeStyle = "blue";
  overlayCtx.lineWidth = 2;
  overlayCtx.setLineDash([]);

  // Draw all completed polygons (outline)
  allPolygons.forEach((poly) => {
    overlayCtx.beginPath();
    overlayCtx.moveTo(poly[0].x, poly[0].y);
    //UNCOMMENT TO HAVE OVERLAY ON PATH
    //poly.slice(1).forEach(p => overlayCtx.lineTo(p.x, p.y));
    overlayCtx.closePath();
    overlayCtx.stroke();
  });

  // Draw current polygon in progress
  if (polygon.length) {
    overlayCtx.beginPath();
    clearBtn.disabled = false;
    overlayCtx.moveTo(polygon[0].x, polygon[0].y);
    polygon.slice(1).forEach((p) => overlayCtx.lineTo(p.x, p.y));
    overlayCtx.stroke();
    if (preview) {
      overlayCtx.setLineDash([5, 5]);
      overlayCtx.beginPath();
      overlayCtx.moveTo(
        polygon[polygon.length - 1].x,
        polygon[polygon.length - 1].y
      );
      overlayCtx.lineTo(preview.x, preview.y);
      overlayCtx.stroke();
      // Draw anchor points
      polygon.forEach(p => {
        overlayCtx.beginPath();
        overlayCtx.fillStyle = '#E07B00';
        overlayCtx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
        overlayCtx.fill();
      });
      overlayCtx.setLineDash([]);
    }
  }
}

// Fill a polygon with parallel lines and merge into main canvas
function fillPolygon(poly) {
  overlayCtx.clearRect(0, 0, pageWidth, pageHeight);
  overlayCtx.save();
  overlayCtx.beginPath();
  overlayCtx.moveTo(poly[0].x, poly[0].y);
  poly.slice(1).forEach((p) => overlayCtx.lineTo(p.x, p.y));
  overlayCtx.closePath();
  overlayCtx.clip();
  overlayCtx.strokeStyle = "blue";
  overlayCtx.lineWidth = 1;
  const step = 40;
  for (let x0 = -pageHeight; x0 < pageWidth + pageHeight; x0 += step) {
    overlayCtx.beginPath();
    overlayCtx.moveTo(x0, 0);
    overlayCtx.lineTo(x0 + pageHeight, pageHeight);
    overlayCtx.stroke();
  }
  overlayCtx.restore();
  canvasCtx.drawImage(overlay, 0, 0);
  overlayCtx.clearRect(0, 0, pageWidth, pageHeight);
}

// Process PDF when user clicks action button
actionBtn.addEventListener("click", async () => {
  actionBtn.disabled = true;
  trimSect.setAttribute("style", "display: none !important"); // ???
  console.log("Process button clicked. Trim option:", trim_bool);
  logAction("Process File");
  exportCtrls.classList.add("d-none");
  statusMsg.textContent = "Processing in API…";
  statusMsg.style.display = "block";

  // Read selected PDF file
  const dataURL = await new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(input.files[0]);
  });
  console.log("File read as DataURL.");

  // Create hidden iframe to send file & script to Photopea
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  if (trim_bool) {
    iframe.src =
      "https://www.photopea.com#" +
      encodeURIComponent(
        JSON.stringify({ files: [dataURL], script: fullScript_trim })
      );
  } else {
    iframe.src =
      "https://www.photopea.com#" +
      encodeURIComponent(
        JSON.stringify({ files: [dataURL], script: fullScript_primary })
      );
  }
  document.body.appendChild(iframe);
  console.log("Photopea iframe created.");

  // Handle response from Photopea
  // ?? if (messageHandler) {
  //      window.removeEventListener('message', messageHandler);
  //      messageHandler = null;
  //     }
  messageHandler = async function (e) {
    if (!(e.data instanceof ArrayBuffer)) return;
    window.removeEventListener("message", messageHandler);

    // Revoke previous blob URL
    if (latestUrl) {
      URL.revokeObjectURL(latestUrl);
      latestUrl = '';
    }

    // Create PDF blob from Photopea response
    const pdfBuffer = e.data;
    latestBlob = new Blob([pdfBuffer], { type: "application/pdf" });
    latestUrl = URL.createObjectURL(latestBlob);

    // Update UI for editing
    placeholder.hidden = true;
    pdfEmbed.hidden = true;
    canvasContainer.classList.remove("d-none");
    statusMsg.textContent = "Processed – rendering…";
    console.log("Processing complete. Rendering PDF to canvas…");

    try {
      // Render first page on canvas
      pdfDoc = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
      const page = await pdfDoc.getPage(1);
      const viewport = page.getViewport({ scale: 1.2 });
      pageWidth = viewport.width;
      pageHeight = viewport.height;
      pdfCanvas.width = pageWidth;
      pdfCanvas.height = pageHeight;
      overlay.width = pageWidth;
      overlay.height = pageHeight;

      canvasCtx = pdfCanvas.getContext("2d");
      overlayCtx = overlay.getContext("2d");

      await page.render({ canvasContext: canvasCtx, viewport }).promise;
      console.log("PDF page rendered on canvas.");
      pdfPixels = canvasCtx.getImageData(0, 0, pageWidth, pageHeight).data;

      // Initialize drawing tools
      allPolygons = [];
      polygon = [];
      isDrawing = true;
      completeBtn.disabled = true;
      clearBtn.disabled = true;
      drawCtrls.classList.remove("d-none");
      overlay.style.pointerEvents = "auto";
      status.textContent = "PDF rendered. Click to outline shape.";
      console.log("Canvas editor activated for annotation.");
      drawOverlay();
    } catch (err) {
      console.error("Error rendering PDF for editing:", err);
      status.textContent = `Error: ${err.message}`;
    }

    // Show export controls after processing
    exportCtrls.classList.remove("d-none");
    statusMsg.textContent = "Processed";
    console.log("Export controls enabled.");

    // Download button: save PDF
    downloadBtn.onclick = () => {
      console.log(
        "Download button clicked. Polygons present:", allPolygons.length );
      if (allPolygons.length === 0) {
        const a = document.createElement("a");
        a.href = latestUrl;
        a.download = originalName.replace(/\.[^.]+$/, "") + "-updated.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        console.log("Processed PDF downloaded.");
      } else {
        status.textContent = "Generating PDF…";
        const doc = new jsPDF({
          unit: "px",
          format: [pageWidth, pageHeight],
          compress: true,
        });
        const mergeCanvas = document.createElement("canvas");
        mergeCanvas.width = pageWidth;
        mergeCanvas.height = pageHeight;
        mergeCanvas.getContext("2d").drawImage(pdfCanvas, 0, 0);
        const imgData = mergeCanvas.toDataURL("image/jpeg");
        doc.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight);
        const filename =
          originalName.replace(/\.[^.]+$/, "") + "-annotated.pdf";
        doc.save(filename);
        status.textContent = "PDF ready.";
        console.log("Annotated PDF downloaded.");
      }
    };

    // Save-As button: prompt user to save
    saveAsBtn.onclick = async () => {
      console.log(
        "Save As button clicked. Polygons present:", allPolygons.length);
      if (!window.showSaveFilePicker) {
        alert("Save As not supported.");
        console.warn("showSaveFilePicker not available in this browser.");
        return;
      }
      try {
        let pdfBlobToSave = latestBlob;
        if (allPolygons.length !== 0) {
          status.textContent = "Generating PDF…";
          const doc = new jsPDF({
            unit: "px",
            format: [pageWidth, pageHeight],
          });
          const mergeCanvas = document.createElement("canvas");
          mergeCanvas.width = pageWidth;
          mergeCanvas.height = pageHeight;
          mergeCanvas.getContext("2d").drawImage(pdfCanvas, 0, 0);
          const imgData = mergeCanvas.toDataURL("image/png");
          doc.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
          pdfBlobToSave = doc.output("blob");
        }
        const handle = await window.showSaveFilePicker({
          suggestedName:
            originalName.replace(/\.[^.]+$/, "") +
            (allPolygons.length === 0 ? "-updated.pdf" : "-annotated.pdf"),
          types: [
            {
              description: "PDF Files",
              accept: { "application/pdf": [".pdf"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(pdfBlobToSave);
        await writable.close();
        status.textContent = "PDF saved.";
        console.log("PDF saved via Save As.");
        if (pdfBlobToSave !== latestBlob) {
          latestBlob = pdfBlobToSave;
          if (latestUrl) URL.revokeObjectURL(latestUrl);
          latestUrl = URL.createObjectURL(latestBlob);
        }
      } catch (err) {
        console.error("Save As failed:", err);
      }
    };
  };

  // Listen for Photopea response
  window.addEventListener("message", messageHandler);
});
