ANATOMY ATLAS - Interactive 3D Human Body
=========================================

HOW TO RUN
1. Unzip the folder.
2. Double-click index.html (Chrome, Edge, Firefox or Safari).
   It needs internet the first time, to load three.js and the fonts from a CDN.

If double-click does not work, start a tiny local server in this folder:
   python -m http.server 8000
and open http://localhost:8000

RUN COMPLETELY OFFLINE
Download these two files once and put them in the libs/ folder:
  https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js
  https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js
(Keep the names three.min.js and OrbitControls.js. The page falls back to libs/ automatically.)

FEATURES
- 3D body with skin see-through slider
- 26 selectable organs and bones; hover for names, click for details
- 360-degree rotation (drag), rotate buttons, auto-rotate
- Zoom with wheel/pinch or buttons, Reset view
- Body-system filter (nervous, circulatory, respiratory, digestive, urinary, endocrine, skeletal)
- Search by organ, system or function (Enter selects first match)
- Location and function panel with "Did you know?" fact
- Quiz: 14 questions, explanations, "Show in 3D", final score and review

FILES
index.html       page structure
css/style.css    design
js/data.js       organ text and quiz questions (edit here to add content)
js/app.js        3D model and explorer
js/quiz.js       quiz and tabs

NOTE: The model is built from simple shapes for teaching, not a medical-grade scan.
Clicking over the ribs picks the organ behind them; choose "Skeletal" to click bones.
