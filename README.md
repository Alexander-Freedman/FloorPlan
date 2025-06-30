# [Floor Plan Optimizer](https://alexander-freedman.github.io/FloorPlan/)

**Created by Alexander Freedman**

## Overview

**Floor Plan Optimizer** is a web-based tool developed for a floor installation company to streamline the cleanup of architectural floor plan PDFs. It removes unnecessary text layers while preserving the original linework, resulting in simplified, annotation-free plans ready for further processing or CAD conversion. After processing, users can draw blue hatch lines directly on the cleaned plan to mark key areas.

## Features

- **PDF Upload and Preview**  
  Select and preview floor plan PDFs directly in the browser.

- **Text Removal**  
  Utilizes a Photopea script to remove all text layers, retaining only structural and design elements.

- **Interactive Hatching**  
  After processing, draw blue hatch lines directly on the plan to mark rooms, materials, or areas.

- **Download and Save**  
  Export the cleaned and marked-up PDF using the browser’s built-in download or Save As functionality.

## Getting Started

1. Clone or download this repository to your local machine.
2. Open `index.html` in a modern web browser (Chrome, Firefox, Edge, Safari).
3. Click **Choose File** to upload a floor plan PDF.
4. Click **Process PDF** to clean the file.
5. Once processing is complete, use your cursor to draw blue hatch lines on the plan.
6. Download the marked-up PDF via the **Download** button or use your browser’s **Save As** option.

## File Structure

```
/ (project root)
├── index.html # Main application interface
├── main.js # JavaScript for PDF processing and drawing
├── styles.css # Styles for the web UI
├── code.png # Sample image or screenshot
└── README.md # Project documentation
```

## Support

For questions or issues, contact Alexander Freedman at  
[alexanderrfreedman@gmail.com](mailto:alexanderrfreedman@gmail.com)

---

© 2025 Alexander Freedman. All rights reserved.
