// --- Globals ---
let classData = null;   // entity_classes.json (array of {sc, ss, ss2?})
let occurrences = [];   // parsed JSONL records
let loaded = false;

// Selection state
let selectedCIs = null;     // null = nothing, Set of ci values
let selectedRole = null;    // null = nothing, 'Proponent' | 'Opponent'
let selectedAuthor = null;  // null = nothing, string author name
let selectedPerson = null;  // null = nothing, string entity name
let selectedOrg = null;     // null = nothing, string entity name

// Built during layout
let treeNodes = [];         // flat list of entries with screen positions
let fileBranchMap = {};     // "year-rnd-filename" → {points, cumDist, totalLen, ci}
let fileRoleMap = {};       // "year-rnd-filename" → role string
let roundFileOrder = {};    // "year-rnd" → [filenames in order]
let classBands = {};        // classBands[yearNum][className] = {yStart, yEnd}
let proClassBands = {};     // proClassBands[yearNum][className] = {yStart, yEnd}
let oppClassBands = {};     // oppClassBands[yearNum][className] = {yStart, yEnd}
let subclassBands = {};     // subclassBands[yearNum][className][subName] = {yStart, yEnd}
let subclassColors = {};    // subclassColors[className][subName] = hex color
let treeData = {};          // global so colorway switcher can recompute subclass colors
let yearStats = {};         // yearStats[yr] = { files, words, orgs }
let fileWordCount = {};     // "year-rnd-filename" → word count
let authorBranchKeys = {}; // authorName → [branch key strings]
let activeResult = null;    // { branchKeys: Set, fileCount, totalWords } or null
let questionsList = [];    // individual questions, sorted ascending by length
let canvasW = 800;
let canvasH = 800;
let centerY = 400;
let layoutYears = [];  // sorted year numbers in column order
let zoomLevel = 1.0;


// Layout constants
const PAD_TOP = 380;
const PAD_BOTTOM = 580;
const PAD_LEFT = 360;
const PAD_RIGHT = 200;
let colW = 450;  // computed dynamically for 24:18 aspect ratio
const CONTENT_GAP = 30;  // whitespace between content edge and spiral zone
const CENTER_GAP = 100;  // gap between proponent section (top) and opponent section (bottom)
const CANVAS_TOP_MARGIN = 800;   // extra blank canvas space above the spiral zone
const FILE_H = 3;
const CLASS_GAP = 10;
const SUBCLASS_GAP = 8;
const YEAR_LABEL_W = 50;
const CLASS_W = 30;
const SUB_W = 30;
const MAX_HORIZ = 80;       // max horizontal px before spiraling
const MIN_FILE_W = 3;

// File length: linear scale
const PX_PER_WORD = 0.050;

// Spiral parameters
const SPIRAL_R0 = 3;
const SPIRAL_GROWTH = 0.5;  // px per radian — gap between coils ≈ π px
const SPIRAL_DTHETA = 0.15;

// Class display order (top to bottom)
const CLASS_ORDER = [
  'Audiovisual Works',
  'Computer Programs',
  'All Works',
  'Literary Works',
  'Unclassified',
];

// Named colorways — each defines plot colors + background/fill colors
const COLORWAYS = {
  'Classic': {
    bg: '#F4F0E2',
    polygon: '#ffffff',
    tint: 'rgba(80,52,20,0.10)',
    defaultDot: '#807A70',
    classes: {
      'Audiovisual Works': '#002D45',
      'Computer Programs': '#4A1E6E',
      'Literary Works': '#D48000',
      'All Works': '#980830',
    },
  },
  'Editorial': {
    bg: '#F4F1EB',
    polygon: '#FFFEF8',
    tint: 'rgba(120,90,60,0.06)',
    defaultDot: '#aaaaaa',
    classes: {
      'Audiovisual Works': '#2D5F8A',
      'Computer Programs': '#6B4C8A',
      'Literary Works': '#C47A1E',
      'All Works': '#C24B4B',
    },
  },
  'Sage': {
    bg: '#EEF0EB',
    polygon: '#F8F9F5',
    tint: 'rgba(60,80,40,0.06)',
    defaultDot: '#aaaaaa',
    classes: {
      'Audiovisual Works': '#3D6B55',
      'Computer Programs': '#8B6B4A',
      'Literary Works': '#C9A84C',
      'All Works': '#A84848',
    },
  },
  'Official': {
    bg: '#EDF0F4',
    polygon: '#F8FAFB',
    tint: 'rgba(40,60,100,0.06)',
    defaultDot: '#aaaaaa',
    classes: {
      'Audiovisual Works': '#1E4B8C',
      'Computer Programs': '#5B3D8C',
      'Literary Works': '#D4930A',
      'All Works': '#C23B5A',
    },
  },
  'Antique': {
    bg: '#F0E8D8',
    polygon: '#FAF5EB',
    tint: 'rgba(100,60,20,0.08)',
    defaultDot: '#aaaaaa',
    classes: {
      'Audiovisual Works': '#2C4A6E',
      'Computer Programs': '#6E3A7A',
      'Literary Works': '#B87A00',
      'All Works': '#C04040',
    },
  },
  'Dark': {
    bg: '#1A1A1E',
    polygon: '#252529',
    tint: 'rgba(200,180,120,0.06)',
    defaultDot: '#666666',
    classes: {
      'Audiovisual Works': '#4FC3F7',
      'Computer Programs': '#CE93D8',
      'Literary Works': '#FFD54F',
      'All Works': '#FF80AB',
    },
  },
  'Vivid': {
    bg: '#FAFAFA',
    polygon: '#FFFFFF',
    tint: 'rgba(0,0,0,0.04)',
    defaultDot: '#bbbbbb',
    classes: {
      'Audiovisual Works': '#D50000',
      'Computer Programs': '#0057FF',
      'Literary Works': '#FF6D00',
      'All Works': '#00897B',
    },
  },
  'Neon': {
    bg: '#0A0A12',
    polygon: '#13131F',
    tint: 'rgba(255,200,80,0.05)',
    defaultDot: '#444455',
    classes: {
      'Audiovisual Works': '#FF2D6F',
      'Computer Programs': '#00E5FF',
      'Literary Works': '#FFE500',
      'All Works': '#3DFF8F',
    },
  },
  'Candy': {
    bg: '#FFF0FA',
    polygon: '#FFFFFF',
    tint: 'rgba(180,0,100,0.05)',
    defaultDot: '#ddbbcc',
    classes: {
      'Audiovisual Works': '#FF4B8B',
      'Computer Programs': '#5B5EFF',
      'Literary Works': '#FFB700',
      'All Works': '#00CC88',
    },
  },
  'Sunset': {
    bg: '#FFF3EE',
    polygon: '#FFFAF7',
    tint: 'rgba(160,40,0,0.06)',
    defaultDot: '#ccaaaa',
    classes: {
      'Audiovisual Works': '#FF3D00',
      'Computer Programs': '#9C27B0',
      'Literary Works': '#FF8F00',
      'All Works': '#FFD600',
    },
  },
  'Aurora': {
    bg: '#E8F5F2',
    polygon: '#F4FEFA',
    tint: 'rgba(0,100,80,0.05)',
    defaultDot: '#99bbbb',
    classes: {
      'Audiovisual Works': '#00897B',
      'Computer Programs': '#7B1FA2',
      'Literary Works': '#E91E63',
      'All Works': '#0288D1',
    },
  },
  'Retro': {
    bg: '#FFFBF0',
    polygon: '#FFFFFF',
    tint: 'rgba(80,40,0,0.05)',
    defaultDot: '#bbaa88',
    classes: {
      'Audiovisual Works': '#CC3300',
      'Computer Programs': '#0055AA',
      'Literary Works': '#FF9900',
      'All Works': '#007755',
    },
  },
  'Stone': {
    bg: '#E8E5DF',
    polygon: '#A8A49C',
    tint: 'rgba(60,50,40,0.07)',
    defaultDot: '#888880',
    classes: {
      'Audiovisual Works': '#FF6B1A',
      'Computer Programs': '#4DAAFF',
      'Literary Works': '#FFD000',
      'All Works': '#00E87A',
    },
  },
  'Blueprint': {
    bg: '#D6DDE8',
    polygon: '#8E9DB0',
    tint: 'rgba(30,50,90,0.08)',
    defaultDot: '#7788aa',
    classes: {
      'Audiovisual Works': '#FF4136',
      'Computer Programs': '#FFB700',
      'Literary Works': '#DD55FF',
      'All Works': '#00FF80',
    },
  },
  'Écru': {
    bg: '#EDE8DE',
    polygon: '#A89E8C',
    tint: 'rgba(80,60,30,0.07)',
    defaultDot: '#998877',
    classes: {
      'Audiovisual Works': '#FF1A33',
      'Computer Programs': '#2B90FF',
      'Literary Works': '#FFAA00',
      'All Works': '#00E065',
    },
  },
  'Kraft': {
    bg: '#6B5340',
    polygon: '#DDD4C4',
    tint: 'rgba(180,140,90,0.08)',
    defaultDot: '#bbaa99',
    classes: {
      'Audiovisual Works': '#FF5C1A',
      'Computer Programs': '#4DB8FF',
      'Literary Works': '#FFD000',
      'All Works': '#00E87A',
    },
  },
  'Slate': {
    bg: '#3A3F4A',
    polygon: '#CDD2DA',
    tint: 'rgba(150,170,200,0.07)',
    defaultDot: '#9aaabb',
    classes: {
      'Audiovisual Works': '#FF4D4D',
      'Computer Programs': '#4DAAFF',
      'Literary Works': '#FFD700',
      'All Works': '#44FF99',
    },
  },
  'Forest': {
    bg: '#2E3D2E',
    polygon: '#C8D4C6',
    tint: 'rgba(80,140,80,0.07)',
    defaultDot: '#88aa88',
    classes: {
      'Audiovisual Works': '#FF5050',
      'Computer Programs': '#55AAFF',
      'Literary Works': '#FFD000',
      'All Works': '#44FFAA',
    },
  },
};

let activeColorway = COLORWAYS['Classic'];

function setColorway(name) {
  // Colorway switching disabled — palette locked to Classic.
  // Rebuild ci → color map
  if (classData) {
    for (let i = 0; i < classData.length; i++) {
      ciToColor[i] = activeColorway.classes[classData[i].sc] || activeColorway.defaultDot;
    }
  }
  // Recompute subclass color shades with new base colors
  computeSubclassColors(treeData);
  // Sync page background and legend to new colorway
  document.body.style.background = activeColorway.bg;
  buildLegend();
  redraw();
}
window.setColorway = setColorway;

const DEFAULT_DOT_COLOR = '#999999';

// ci → hex color, built after data load
let ciToColor = {};

function setup() {
  let container = document.getElementById('canvas-container');
  let cnv = createCanvas(100, 100);
  if (container) cnv.parent(container);
  pixelDensity(1);
  const _seedParam = new URLSearchParams(window.location.search).get('seed');
  noiseSeed(_seedParam !== null ? parseInt(_seedParam) : 1201);
  noLoop();
  loadAllData();
}

const OCC_FILES = [
  'data/occurrences_2000.jsonl',
  'data/occurrences_2003.jsonl',
  'data/occurrences_2006.jsonl',
  'data/occurrences_2008.jsonl',
  'data/occurrences_2012.jsonl',
  'data/occurrences_2015_r1.jsonl',
  'data/occurrences_2015_r2.jsonl',
  'data/occurrences_2015_r3.jsonl',
  'data/occurrences_2015_r4.jsonl',
  'data/occurrences_2018.jsonl',
  'data/occurrences_2021.jsonl',
  'data/occurrences_2024.jsonl',
];

async function loadAllData() {
  let [classResp, csvResp, wcResp, qResp, authorResp, ...occResps] = await Promise.all([
    fetch('data/entity_classes.json'),
    fetch('data/file_class_map.csv'),
    fetch('data/hierarchical_word_counts.json'),
    fetch('data/questions_by_length.txt'),
    fetch('data/author_branch_keys.json'),
    ...OCC_FILES.map(f => fetch(f)),
  ]);

  classData = await classResp.json();
  let csvText = await csvResp.text();
  let wcJson = await wcResp.json();
  authorBranchKeys = await authorResp.json();
  let occTexts = await Promise.all(occResps.map(r => r.text()));
  let occText = occTexts.join('\n');

  // Extract individual questions with their source year.
  let qRaw = await qResp.text();
  // Metadata lines: "   N. [NNN chars] [YYYY, documents, YYYY_roundN]"
  // Question text:  "      text..." (6-space indent)
  let qs = [], curQ = '', curYear = null;
  for (let line of qRaw.split('\n')) {
    let metaMatch = line.match(/^\s+\d+\.\s+\[\d+ chars\]\s+\[(\d{4}),/);
    if (metaMatch) {
      if (curQ && curYear !== null) { qs.push({ text: curQ, year: curYear }); curQ = ''; }
      curYear = parseInt(metaMatch[1]);
    } else if (/^      \S/.test(line)) {
      if (curQ) curQ += ' ';
      curQ += line.trim();
    }
  }
  if (curQ && curYear !== null) qs.push({ text: curQ, year: curYear });
  questionsList = qs.filter(q => !q.text.toLowerCase().includes('transvestite')).sort((a, b) => a.text.length - b.text.length);

  // Build ci → color map
  for (let i = 0; i < classData.length; i++) {
    ciToColor[i] = activeColorway.classes[classData[i].sc] || activeColorway.defaultDot;
  }

  // Parse CSV (handles quoted fields with commas) → map of "year-round-filename" → {sc, ss, ss2}
  let fileClassInfo = {};
  let csvLines = csvText.split('\n');
  let headers = csvLines[0].split(',');

  function parseCSVRow(line) {
    let cols = [];
    let current = '';
    let inQuotes = false;
    for (let ch = 0; ch < line.length; ch++) {
      let c = line[ch];
      if (inQuotes) {
        if (c === '"' && ch + 1 < line.length && line[ch + 1] === '"') {
          current += '"';
          ch++;
        } else if (c === '"') {
          inQuotes = false;
        } else {
          current += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === ',') {
          cols.push(current);
          current = '';
        } else {
          current += c;
        }
      }
    }
    cols.push(current);
    return cols;
  }

  for (let i = 1; i < csvLines.length; i++) {
    if (!csvLines[i].trim()) continue;
    let cols = parseCSVRow(csvLines[i]);
    let row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cols[j] || '';
    }
    let key = row.year + '-' + row.round + '-' + row.filename;
    fileClassInfo[key] = {
      sc: row.standardized_class || '',
      ss: row.standardized_subclass || '',
      ss2: row.standardized_subclass2 || '',
    };
    if (row.role) fileRoleMap[key] = row.role;
  }

  // Build class lookup: "sc|ss|ss2" → ci
  let classLookup = {};
  for (let i = 0; i < classData.length; i++) {
    let c = classData[i];
    let key = c.sc + '|' + c.ss + '|' + (c.ss2 || '');
    classLookup[key] = i;
  }

  // Build tree structure and file order from hierarchical word counts
  treeData = {};
  let yearOrder = Object.keys(wcJson.years).sort();

  for (let yearStr of yearOrder) {
    let yearNum = parseInt(yearStr);
    let yearInfo = wcJson.years[yearStr];
    let roundKeys = Object.keys(yearInfo.rounds).sort();

    for (let rk of roundKeys) {
      let rndNum = parseInt(rk.split('round')[1]);
      let rndInfo = yearInfo.rounds[rk];
      let fileKeys = Object.keys(rndInfo.files);
      let filenames = [];

      for (let fk of fileKeys) {
        let f = rndInfo.files[fk];
        let fn = f.filename;
        let wc = f.word_count;
        filenames.push(fn);

        let csvKey = yearNum + '-' + rndNum + '-' + fn;
        let info = fileClassInfo[csvKey] || { sc: '', ss: '', ss2: '' };
        let sc = info.sc || 'Unclassified';
        let ss = info.ss || '(none)';

        let clsKey = info.sc + '|' + info.ss + '|' + info.ss2;
        let ci = classLookup[clsKey];
        if (ci === undefined) ci = -1;

        if (!treeData[yearNum]) treeData[yearNum] = {};
        if (!treeData[yearNum][sc]) treeData[yearNum][sc] = {};
        if (!treeData[yearNum][sc][ss]) treeData[yearNum][sc][ss] = [];
        treeData[yearNum][sc][ss].push({
          filename: fn,
          wordCount: wc,
          year: yearNum,
          rnd: rndNum,
          ci: ci,
        });
        fileWordCount[yearNum + '-' + rndNum + '-' + fn] = wc;
      }

      roundFileOrder[yearNum + '-' + rndNum] = filenames;
    }
  }

  // Parse JSONL
  let lines = occText.split('\n');
  for (let line of lines) {
    if (line) occurrences.push(JSON.parse(line));
  }

  // Compute layout
  let years = yearOrder.map(Number);
  computeLayout(treeData, years);
  computeSubclassColors(treeData);

  // Compute per-year stats for annotations
  yearStats = {};
  for (let yr of years) {
    let files = 0, words = 0;
    for (let sc of Object.values(treeData[yr] || {}))
      for (let ss of Object.values(sc))
        for (let f of ss) { files++; words += f.wordCount; }
    yearStats[yr] = { files, words, orgs: 0 };
  }
  // Count unique org entities per year from occurrence records
  for (let rec of occurrences) {
    if (rec.t === 'org' && yearStats[rec.y]) {
      if (!yearStats[rec.y]._orgSet) yearStats[rec.y]._orgSet = new Set();
      yearStats[rec.y]._orgSet.add(rec.e);
    }
  }
  for (let yr of years) {
    if (yearStats[yr]._orgSet) {
      yearStats[yr].orgs = yearStats[yr]._orgSet.size;
      delete yearStats[yr]._orgSet;
    }
  }

  // Build UI
  buildClassDropdown();
  buildRoleDropdown();
  buildAuthorDropdown();
  buildPersonDropdown();
  buildOrgDropdown();
  // Default zoom: fit horizontally to window
  zoomLevel = Math.min(1, windowWidth / canvasW);
  buildZoomControls();

  loaded = true;
  resizeCanvas(Math.round(canvasW * zoomLevel), Math.round(canvasH * zoomLevel));
  applyURLParams();
  redraw();
}

function wcToPixels(wc) {
  return Math.max(MIN_FILE_W, wc * PX_PER_WORD);
}

// Sort class names according to a given order array (defaults to CLASS_ORDER)
function sortClasses(classNames, orderArray) {
  let ord = orderArray || CLASS_ORDER;
  return classNames.slice().sort((a, b) => {
    let ai = ord.indexOf(a);
    let bi = ord.indexOf(b);
    if (ai === -1) ai = ord.length;
    if (bi === -1) bi = ord.length;
    return ai - bi;
  });
}

// Bezier curve-off constants
const R_CURVE_MIN = 50;
const R_CURVE_MAX = 100;
const KAPPA = 0.5523;            // cubic bezier handle ratio for quarter circle

// Deterministic pseudo-random from a seed (returns 0-1)
function seededRand(seed, n) {
  let x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}

// Minimum visual spiral appended to every branch regardless of file length
const MIN_SPIRAL_BASE = 150;  // minimum spiral for any file

// Build a polyline: guide line, smooth arc to graph edge, spiral in bracket area
// assignedTarget: optional {x, y} pre-computed spiral target for even spacing
function computeBranchPoints(fx1, fy, totalPx, centerY, angle, guideDist, seed, xColLeft, xColRight, assignedTarget) {
  let points = [];
  let cumDist = [];

  points.push({ x: fx1, y: fy });
  cumDist.push(0);

  if (totalPx <= MIN_FILE_W) {
    points.push({ x: fx1 + totalPx, y: fy });
    cumDist.push(totalPx);
    return { points, cumDist };
  }

  let dx = Math.cos(angle);
  let dy = Math.sin(angle);

  // Seeded random values
  let r1 = seededRand(seed, 0);
  let r5 = seededRand(seed, 4);

  // Bend direction: above center = up, below = down
  let r2 = seededRand(seed, 1);
  let bendDir = (fy <= centerY) ? -1 : 1;
  if (Math.abs(fy - centerY) < 40) {
    bendDir = r2 < 0.5 ? -1 : 1;
  }

  // How far this file is from the nearest graph edge (0 = at edge, 1 = at center)
  let distFromEdge = (bendDir === -1) ? fy - PAD_TOP : canvasH - PAD_BOTTOM - fy;
  let halfContent = (canvasH - PAD_TOP - PAD_BOTTOM) / 2;
  let distNorm = Math.min(1, distFromEdge / halfContent); // 0 at edge, 1 at center

  let lineLen, curveStartX, curveStartY, remainLen, totalArcLen = 0;

  if (totalPx <= guideDist) {
    // Short files: straight line only, no spiral
    points.push({ x: fx1 + dx * totalPx, y: fy + dy * totalPx });
    cumDist.push(totalPx);
    return { points, cumDist };
  } else {
    // Phase 1: Straight guide — center files start curving earlier (more gradual arc)
    let curveFrac = 0.3 + (1 - distNorm) * 0.5 + r1 * 0.2;
    curveFrac = Math.min(1, curveFrac);
    lineLen = guideDist * curveFrac;
    curveStartX = fx1 + dx * lineLen;
    curveStartY = fy + dy * lineLen;
    points.push({ x: curveStartX, y: curveStartY });
    cumDist.push(lineLen);

    remainLen = totalPx - lineLen;

    // Target position: use pre-assigned target if available, otherwise fallback
    let targetX, edgeY;
    if (assignedTarget) {
      targetX = assignedTarget.x;
      edgeY = assignedTarget.y;
    } else {
      let r3 = seededRand(seed, 2);
      let r4 = seededRand(seed, 3);
      let bracketLeft = xColLeft + 5;
      let bracketRight = xColLeft + YEAR_LABEL_W + CLASS_W + SUB_W - 5;
      targetX = bracketRight - distNorm * (bracketRight - bracketLeft) + (r3 - 0.5) * 10;
      let edgeDepth = CONTENT_GAP + 10 + distNorm * 50 + r4 * 20;
      if (bendDir === -1) {
        edgeY = PAD_TOP - edgeDepth;
      } else {
        edgeY = canvasH - PAD_BOTTOM + edgeDepth;
      }
    }

    // Phase 2: Smooth bezier arc from curve-off point to target position
    let P0 = { x: curveStartX, y: curveStartY };
    let P3 = { x: targetX, y: edgeY };

    let arcDx = P3.x - P0.x;
    let arcDy = P3.y - P0.y;
    let arcChord = Math.sqrt(arcDx * arcDx + arcDy * arcDy);

    // Handle length: longer arcs get proportionally longer handles = smoother curves
    let handleFrac = 0.35 + r5 * 0.15;
    let handleLen = arcChord * handleFrac;

    // P1: continue in guide direction from P0
    let P1 = { x: P0.x + dx * handleLen, y: P0.y + dy * handleLen };
    // P2: approach P3 vertically (from the graph side)
    let P2 = { x: P3.x, y: P3.y - bendDir * handleLen };

    // Sample the bezier arc into a polyline, measuring distance
    let nSteps = Math.max(12, Math.ceil(arcChord / 3));
    let bezAccum = 0;
    let bezPoints = [];

    for (let step = 1; step <= nSteps; step++) {
      let t = step / nSteps;
      let mt = 1 - t;
      let px = mt*mt*mt*P0.x + 3*mt*mt*t*P1.x + 3*mt*t*t*P2.x + t*t*t*P3.x;
      let py = mt*mt*mt*P0.y + 3*mt*mt*t*P1.y + 3*mt*t*t*P2.y + t*t*t*P3.y;

      let prev = bezPoints.length > 0 ? bezPoints[bezPoints.length - 1] : P0;
      let ddx = px - prev.x;
      let ddy = py - prev.y;
      bezAccum += Math.sqrt(ddx * ddx + ddy * ddy);
      bezPoints.push({ x: px, y: py, dist: bezAccum });
    }

    // Walk along the arc, consuming file length budget
    totalArcLen = bezAccum;
    let arcBudget = Math.min(remainLen, totalArcLen);

    for (let bp of bezPoints) {
      if (bp.dist > arcBudget) break;
      points.push({ x: bp.x, y: bp.y });
      cumDist.push(lineLen + bp.dist);
    }

    remainLen = totalPx - lineLen - totalArcLen;
  }

  // Phase 3: Spiral — minimum coil scales with word count so longer files curl more
  let minSpiralLen = Math.max(MIN_SPIRAL_BASE, totalPx * 0.4);
  let spiralLen = Math.max(remainLen, minSpiralLen);
  let spiralStart = points[points.length - 1];

  // Spiral direction: tangent at end of bezier (roughly vertical at this point)
  let spiralAngle = Math.atan2(bendDir, 0);  // straight up or down
  let sPerpX = -Math.sin(spiralAngle);
  let sPerpY = Math.cos(spiralAngle);
  let scx = spiralStart.x + bendDir * SPIRAL_R0 * sPerpX;
  let scy = spiralStart.y + bendDir * SPIRAL_R0 * sPerpY;
  let spiralAccum = 0;
  let theta = 0;

  let margin = 10; // stop spirals before canvas edge
  while (spiralAccum < spiralLen) {
    theta += SPIRAL_DTHETA;
    let r = SPIRAL_R0 + SPIRAL_GROWTH * theta;
    let sAngle = spiralAngle + bendDir * (theta - Math.PI / 2);
    let px = scx + r * Math.cos(sAngle);
    let py = scy + r * Math.sin(sAngle);

    // Clamp: stop spiral if it would run off canvas (upward spirals may enter CANVAS_TOP_MARGIN zone)
    if (px < margin || px > canvasW - margin || py < -(CANVAS_TOP_MARGIN - margin) || py > canvasH - margin) break;

    let prev = points[points.length - 1];
    let ddx = px - prev.x;
    let ddy = py - prev.y;
    spiralAccum += Math.sqrt(ddx * ddx + ddy * ddy);

    points.push({ x: px, y: py });
    cumDist.push(lineLen + totalArcLen + Math.min(spiralAccum, spiralLen));
  }

  return { points, cumDist };
}

// Get a point along a branch polyline at parameter t (0..1)
function getPointOnBranch(branch, t) {
  let targetDist = t * branch.totalLen;
  let cd = branch.cumDist;
  let pts = branch.points;

  // Binary search
  let lo = 0, hi = cd.length - 1;
  while (lo < hi - 1) {
    let mid = (lo + hi) >> 1;
    if (cd[mid] <= targetDist) lo = mid;
    else hi = mid;
  }

  let segStart = cd[lo];
  let segEnd = cd[hi];
  let frac = (segEnd > segStart) ? (targetDist - segStart) / (segEnd - segStart) : 0;
  return [
    pts[lo].x + (pts[hi].x - pts[lo].x) * frac,
    pts[lo].y + (pts[hi].y - pts[lo].y) * frac,
  ];
}

function computeLayout(treeData, years) {
  treeNodes = [];
  fileBranchMap = {};
  proClassBands = {};
  oppClassBands = {};
  layoutYears = years.slice();

  // Compute global subclass order per class (biggest first, consistent across years)
  let globalSubOrder = {};
  for (let sc of CLASS_ORDER) {
    let ssCounts = {};
    for (let yr of years) {
      let classes = treeData[yr] || {};
      if (!classes[sc]) continue;
      for (let ss of Object.keys(classes[sc])) {
        ssCounts[ss] = (ssCounts[ss] || 0) + classes[sc][ss].length;
      }
    }
    globalSubOrder[sc] = Object.entries(ssCounts)
      .sort((a, b) => b[1] - a[1])
      .map(e => e[0]);
  }

  function orderedSubs(sc, subs) {
    let ordered = (globalSubOrder[sc] || []).filter(ss => subs[ss]);
    for (let ss of Object.keys(subs)) {
      if (!ordered.includes(ss)) ordered.push(ss);
    }
    return ordered;
  }

  // Split treeData into proponent and opponent trees based on fileRoleMap
  let proTreeData = {};
  let oppTreeData = {};
  for (let yr of Object.keys(treeData)) {
    let yrNum = parseInt(yr);
    for (let sc of Object.keys(treeData[yr])) {
      for (let ss of Object.keys(treeData[yr][sc])) {
        for (let f of treeData[yr][sc][ss]) {
          let key = f.year + '-' + f.rnd + '-' + f.filename;
          let role = fileRoleMap[key];
          let target = (role === 'Proponent') ? proTreeData : oppTreeData;
          if (!target[yrNum]) target[yrNum] = {};
          if (!target[yrNum][sc]) target[yrNum][sc] = {};
          if (!target[yrNum][sc][ss]) target[yrNum][sc][ss] = [];
          target[yrNum][sc][ss].push(f);
        }
      }
    }
  }

  // Compute max height for a tree section
  function computeMaxH(tree) {
    let maxH = 0;
    for (let yr of years) {
      let classes = tree[yr] || {};
      let classNames = sortClasses(Object.keys(classes));
      let h = 0;
      for (let ci2 = 0; ci2 < classNames.length; ci2++) {
        let sc = classNames[ci2];
        let subs = classes[sc];
        let subNames = orderedSubs(sc, subs);
        for (let si = 0; si < subNames.length; si++) {
          h += subs[subNames[si]].length * FILE_H;
          if (si < subNames.length - 1) h += SUBCLASS_GAP;
        }
        if (ci2 < classNames.length - 1) h += CLASS_GAP;
      }
      if (h > maxH) maxH = h;
    }
    return maxH;
  }

  let maxProH = computeMaxH(proTreeData);
  let maxOppH = computeMaxH(oppTreeData);

  canvasH = Math.max(windowHeight, maxProH + maxOppH + PAD_TOP + PAD_BOTTOM + CENTER_GAP + CANVAS_TOP_MARGIN);
  // Enforce 2:1 aspect ratio — width driven by height
  canvasW = Math.max(windowWidth, Math.round(canvasH * 2));
  colW = (canvasW - PAD_LEFT - PAD_RIGHT) / years.length;
  centerY = PAD_TOP + (canvasH - PAD_TOP - PAD_BOTTOM) / 2;

  let proTop = PAD_TOP;
  let proBottom = centerY - CENTER_GAP / 2;
  let oppTop = centerY + CENTER_GAP / 2;
  let oppBottom = canvasH - PAD_BOTTOM;

  subclassBands = {};

  // Layout one section (pro or opp) for all years into treeNodes
  // align: 'bottom' = flush to yMax (flat bottom edge), 'top' = flush to yMin (flat top edge)
  function layoutSection(tree, sectionClassOrder, yMin, yMax, sectionBands, sectionTag, align) {
    for (let yi = 0; yi < years.length; yi++) {
      let yr = years[yi];
      let xBase = PAD_LEFT + yi * colW;
      let classes = tree[yr] || {};
      let classNames = sortClasses(Object.keys(classes), sectionClassOrder);
      if (!sectionBands[yr]) sectionBands[yr] = {};
      if (!subclassBands[yr]) subclassBands[yr] = {};

      // Compute total height for this year in this section
      let totalH = 0;
      for (let ci2 = 0; ci2 < classNames.length; ci2++) {
        let sc = classNames[ci2];
        let subs = classes[sc];
        let subNames = orderedSubs(sc, subs);
        for (let si = 0; si < subNames.length; si++) {
          totalH += subs[subNames[si]].length * FILE_H;
          if (si < subNames.length - 1) totalH += SUBCLASS_GAP;
        }
        if (ci2 < classNames.length - 1) totalH += CLASS_GAP;
      }

      // Align within available section range
      let yStart = (align === 'bottom') ? yMax - totalH : yMin;
      let y = yStart;

      for (let ci2 = 0; ci2 < classNames.length; ci2++) {
        let sc = classNames[ci2];
        let subs = classes[sc];
        let subNames = orderedSubs(sc, subs);

        let classYStart = y;
        if (!subclassBands[yr][sc]) subclassBands[yr][sc] = {};

        for (let si = 0; si < subNames.length; si++) {
          let ss = subNames[si];
          let files = subs[ss];
          let subYStart = y;

          for (let fi = 0; fi < files.length; fi++) {
            let f = files[fi];
            let fy = y + FILE_H / 2;
            let fx1 = xBase + YEAR_LABEL_W + CLASS_W + SUB_W;
            let totalPx = wcToPixels(f.wordCount);

            treeNodes.push({
              year: f.year,
              rnd: f.rnd,
              filename: f.filename,
              ci: f.ci,
              sc: sc,
              section: sectionTag,
              _file: { fy, fx1, totalPx, sc, yi, section: sectionTag },
            });

            y += FILE_H;
          }

          let subYEnd = y;
          let subYMid = (subYStart + subYEnd) / 2;

          subclassBands[yr][sc][ss] = { yStart: subYStart, yEnd: subYEnd };

          treeNodes.push({
            type: 'subclass',
            label: ss,
            x: xBase + YEAR_LABEL_W + CLASS_W,
            y: subYMid,
            yStart: subYStart,
            yEnd: subYEnd,
          });

          if (si < subNames.length - 1) y += SUBCLASS_GAP;
        }

        let classYEnd = y;
        let classYMid = (classYStart + classYEnd) / 2;

        sectionBands[yr][sc] = { yStart: classYStart, yEnd: classYEnd };

        treeNodes.push({
          type: 'class',
          label: sc,
          x: xBase + YEAR_LABEL_W,
          y: classYMid,
          yStart: classYStart,
          yEnd: classYEnd,
        });

        if (ci2 < classNames.length - 1) y += CLASS_GAP;
      }
    }
  }

  // Opponents use reversed class order so colors mirror around the center line
  let oppClassOrder = CLASS_ORDER.slice().reverse();
  layoutSection(proTreeData, CLASS_ORDER, proTop, proBottom, proClassBands, 'pro', 'bottom');
  layoutSection(oppTreeData, oppClassOrder, oppTop, oppBottom, oppClassBands, 'opp', 'top');

  // classBands points to proClassBands for stream graph compatibility
  classBands = proClassBands;

  // Add year labels at top
  for (let yi = 0; yi < years.length; yi++) {
    let yr = years[yi];
    let xBase = PAD_LEFT + yi * colW;
    treeNodes.push({
      type: 'year',
      label: '' + yr,
      x: xBase + YEAR_LABEL_W,
      y: centerY,
    });
  }

  // === Pass 1: Compute angle, guide, seed, bendDir for all file nodes ===
  for (let node of treeNodes) {
    if (!node._file) continue;
    let { fy, fx1, totalPx, sc, yi, section } = node._file;
    let yr = years[yi];

    // Use section-appropriate class bands so guide lines stay within their half
    let sectionBands = section === 'pro' ? proClassBands : oppClassBands;

    let angle = 0;
    let guideDist = MAX_HORIZ;
    let curBand = sectionBands[yr] && sectionBands[yr][sc];

    if (yi < years.length - 1) {
      let nextYr = years[yi + 1];
      let nextBand = sectionBands[nextYr] && sectionBands[nextYr][sc];
      if (curBand && nextBand) {
        let p = curBand.yEnd > curBand.yStart ?
                (fy - curBand.yStart) / (curBand.yEnd - curBand.yStart) : 0.5;
        let targetY = nextBand.yStart + p * (nextBand.yEnd - nextBand.yStart);
        angle = Math.atan2(targetY - fy, colW);
        node.guide = { x: fx1 + colW, y: targetY };
        guideDist = Math.sqrt(colW * colW + (targetY - fy) * (targetY - fy));
      }
    } else if (yi > 0) {
      let prevYr = years[yi - 1];
      let prevBand = sectionBands[prevYr] && sectionBands[prevYr][sc];
      if (curBand && prevBand) {
        let p = curBand.yEnd > curBand.yStart ?
                (fy - curBand.yStart) / (curBand.yEnd - curBand.yStart) : 0.5;
        let prevY = prevBand.yStart + p * (prevBand.yEnd - prevBand.yStart);
        angle = Math.atan2(fy - prevY, colW);
        guideDist = Math.sqrt(colW * colW + (fy - prevY) * (fy - prevY));
      }
    }

    let seed = hashStr(node.year + '-' + node.rnd + '-' + node.filename);
    let r2 = seededRand(seed, 1);
    let bendDir = (fy <= centerY) ? -1 : 1;
    if (Math.abs(fy - centerY) < 40) {
      bendDir = r2 < 0.5 ? -1 : 1;
    }

    node._file.angle = angle;
    node._file.guideDist = guideDist;
    node._file.seed = seed;
    node._file.bendDir = bendDir;
  }

  // === Pass 2: Group curving files by (yi, bendDir) and assign spaced spiral targets ===
  let spiralGroups = {};
  for (let node of treeNodes) {
    if (!node._file) continue;
    let { totalPx, guideDist, yi, bendDir } = node._file;
    if (totalPx <= guideDist) continue; // short files don't curve
    let key = yi + '_' + bendDir;
    if (!spiralGroups[key]) spiralGroups[key] = [];
    spiralGroups[key].push(node);
  }

  const SPIRAL_SPACING = 22;
  for (let key of Object.keys(spiralGroups)) {
    let group = spiralGroups[key];
    let yi = group[0]._file.yi;
    let bendDir = group[0]._file.bendDir;
    let xColLeft = PAD_LEFT + yi * colW;

    // Sort by distance from edge: closest to edge first
    if (bendDir === -1) {
      group.sort((a, b) => a._file.fy - b._file.fy);
    } else {
      group.sort((a, b) => b._file.fy - a._file.fy);
    }

    // Normal area spans the column; extended area reaches into right padding for outlier
    let areaLeft = xColLeft + 5;
    let areaRight = xColLeft + colW - 5;
    let areaWidth = areaRight - areaLeft;
    let areaRightExt = Math.min(canvasW - 30, xColLeft + colW * 1.8);  // extended right bound

    // Limit spiral depth so targets stay well clear of the canvas edges.
    // Upward spirals can borrow into CANVAS_TOP_MARGIN (the header zone).
    let depthAvail;
    if (bendDir === -1) {
      depthAvail = PAD_TOP + CANVAS_TOP_MARGIN - CONTENT_GAP - 30;
    } else {
      depthAvail = PAD_BOTTOM - CONTENT_GAP - 30;
    }
    depthAvail = Math.min(depthAvail, 550);
    depthAvail = Math.max(20, depthAvail);

    // Size-based depth: small files stay close to plot, large files rise higher.
    // Vertical outliers: top 1–2 by spiral length placed significantly higher.
    // Horizontal outlier: largest non-vertical-outlier placed far to the right.
    let spiralLens = group.map(n => Math.max(0, n._file.totalPx - n._file.guideDist));
    let minPx = Math.min(...spiralLens);
    let maxPx = Math.max(...spiralLens);
    let pxRange = maxPx - minPx;

    let sortedBySize = [...group].sort((a, b) =>
      (b._file.totalPx - b._file.guideDist) - (a._file.totalPx - a._file.guideDist));
    let nOutliers = group.length >= 6 ? 2 : group.length >= 3 ? 1 : 0;
    let outlierSet = new Set(sortedBySize.slice(0, nOutliers));
    // Horizontal outlier: biggest spiral not already a vertical outlier
    let hOutlier = group.length >= 4
      ? sortedBySize.find(n => !outlierSet.has(n)) || null
      : null;

    let arcBaseY = bendDir === -1
      ? PAD_TOP - CONTENT_GAP
      : canvasH - PAD_BOTTOM + CONTENT_GAP;

    // Full padding depth (for vertical outliers); capped at depthAvail + 100 to stay on canvas
    let fullDepth = depthAvail + 100;

    for (let i = 0; i < group.length; i++) {
      let t = group.length > 1 ? i / (group.length - 1) : 0.5;
      let tx = areaLeft + t * areaWidth;

      let { totalPx, guideDist } = group[i]._file;
      let spiralLen = Math.max(0, totalPx - guideDist);
      let sizeFrac = pxRange > 0 ? (spiralLen - minPx) / pxRange : 0.5;

      // Normal files are capped to PAD_TOP headroom; only outliers reach into CANVAS_TOP_MARGIN
      let normalDepth = Math.min(PAD_TOP - CONTENT_GAP - 30, 320);
      let depth;
      if (outlierSet.has(group[i])) {
        // Vertical outliers: leap well above the main arc into CANVAS_TOP_MARGIN
        depth = depthAvail + (fullDepth - depthAvail) * (0.5 + sizeFrac * 0.5);
      } else {
        // Normal: small files shallow (near plot), large files approach normalDepth peak
        depth = normalDepth * (0.04 + Math.pow(sizeFrac, 0.6) * 0.60);
      }

      let ty = bendDir === -1 ? arcBaseY - depth : arcBaseY + depth;

      // Horizontal outlier: push far right and use mid depth
      if (group[i] === hOutlier) {
        tx = areaRight + (areaRightExt - areaRight) * (0.6 + sizeFrac * 0.4);
        ty = bendDir === -1
          ? arcBaseY - depthAvail * (0.3 + sizeFrac * 0.4)
          : arcBaseY + depthAvail * (0.3 + sizeFrac * 0.4);
      }

      let seed = group[i]._file.seed;
      tx += (seededRand(seed, 10) - 0.5) * 6;
      ty += (seededRand(seed, 11) - 0.5) * 6;

      tx = Math.max(30, Math.min(canvasW - 30, tx));
      ty = Math.max(-(CANVAS_TOP_MARGIN - 30), Math.min(canvasH - 30, ty));

      group[i]._file.spiralTarget = { x: tx, y: ty };
    }

    // Physics: repel overlapping spiral targets until none overlap
    // Per-node y bounds: outliers may reach into CANVAS_TOP_MARGIN; normal files stay within PAD_TOP
    let normalYMin = bendDir === -1 ? PAD_TOP - (PAD_TOP - CONTENT_GAP - 30) : canvasH - PAD_BOTTOM + CONTENT_GAP;
    let outlierYMin = bendDir === -1 ? -(CANVAS_TOP_MARGIN - 30) : canvasH - PAD_BOTTOM + CONTENT_GAP;
    let yMax = bendDir === -1 ? PAD_TOP - CONTENT_GAP : canvasH - 20;

    let phys = group.map(n => {
      let spiralLen = Math.max(0, n._file.totalPx - n._file.guideDist);
      let disc = SPIRAL_R0 * SPIRAL_R0 + 2 * SPIRAL_GROWTH * spiralLen;
      let r = Math.min(Math.sqrt(disc), 180);
      let isOutlier = outlierSet.has(n);
      return { target: n._file.spiralTarget, r, yMin: isOutlier ? outlierYMin : normalYMin };
    });

    let converged = false;
    let physIter = 0;
    while (!converged && physIter++ < 300) {
      converged = true;
      for (let i = 0; i < phys.length; i++) {
        for (let j = i + 1; j < phys.length; j++) {
          let a = phys[i], b = phys[j];
          let dx = b.target.x - a.target.x;
          let dy = b.target.y - a.target.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          let minDist = a.r + b.r + 8;
          if (dist < minDist && dist > 0.1) {
            let push = (minDist - dist) * 0.5;
            let nx = dx / dist, ny = dy / dist;
            a.target.x -= nx * push * 0.5;
            a.target.y -= ny * push * 0.5;
            b.target.x += nx * push * 0.5;
            b.target.y += ny * push * 0.5;
            a.target.x = Math.max(areaLeft, Math.min(areaRightExt, a.target.x));
            a.target.y = Math.max(a.yMin, Math.min(yMax, a.target.y));
            b.target.x = Math.max(areaLeft, Math.min(areaRightExt, b.target.x));
            b.target.y = Math.max(b.yMin, Math.min(yMax, b.target.y));
            converged = false;
          }
        }
      }
    }
  }

  // === Pass 3: Compute branches ===
  for (let node of treeNodes) {
    if (!node._file) continue;
    let { fy, fx1, totalPx, sc, yi, angle, guideDist, seed, spiralTarget } = node._file;

    let xColLeft = PAD_LEFT + yi * colW;
    let xColRight = PAD_LEFT + (yi + 1) * colW;
    let { points, cumDist } = computeBranchPoints(fx1, fy, totalPx, centerY, angle, guideDist, seed, xColLeft, xColRight, spiralTarget || null);
    let branch = { points, cumDist, totalLen: totalPx, ci: node.ci };
    node.branch = branch;

    let branchKey = node.year + '-' + node.rnd + '-' + node.filename;
    fileBranchMap[branchKey] = branch;

    delete node._file;
  }
}

// Shade a hex color toward white by factor (0 = original, 1 = white)
function shadeColor(hex, factor) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.round(r + (255 - r) * factor);
  g = Math.round(g + (255 - g) * factor);
  b = Math.round(b + (255 - b) * factor);
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

// Darken a hex color by multiplying channels toward black (factor 0=unchanged, 1=black)
function darkenColor(hex, factor) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.round(r * (1 - factor));
  g = Math.round(g * (1 - factor));
  b = Math.round(b * (1 - factor));
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

// Compute per-subclass colors: darker shades for bigger subclasses
function computeSubclassColors(treeData) {
  subclassColors = {};
  for (let sc of CLASS_ORDER) {
    let baseColor = activeColorway.classes[sc];
    if (!baseColor) continue;

    // Count total files per subclass across all years
    let ssCounts = {};
    for (let yr of Object.keys(treeData)) {
      let classes = treeData[yr];
      if (!classes[sc]) continue;
      for (let ss of Object.keys(classes[sc])) {
        ssCounts[ss] = (ssCounts[ss] || 0) + classes[sc][ss].length;
      }
    }

    // Sort by count descending (biggest first = darkest)
    let sorted = Object.entries(ssCounts).sort((a, b) => b[1] - a[1]);
    subclassColors[sc] = {};
    for (let i = 0; i < sorted.length; i++) {
      let [ss] = sorted[i];
      // Factor: 0 for biggest (original color), up to 0.5 for smallest
      let factor = sorted.length > 1 ? (i / (sorted.length - 1)) * 0.5 : 0;
      subclassColors[sc][ss] = shadeColor(baseColor, factor);
    }
  }
}

function buildClassDropdown() {
  let sel = document.getElementById('class-select');
  sel.innerHTML = '';

  let ciCounts = {};
  for (let rec of occurrences) {
    if (rec.ci !== undefined) {
      ciCounts[rec.ci] = (ciCounts[rec.ci] || 0) + 1;
    }
  }

  let scGroups = {};
  for (let ciStr of Object.keys(ciCounts)) {
    let ci = parseInt(ciStr);
    let c = classData[ci];
    if (!c) continue;
    let sc = c.sc;
    if (!scGroups[sc]) scGroups[sc] = { total: 0, entries: [] };
    let label = c.ss;
    if (c.ss2) label += ' / ' + c.ss2;
    scGroups[sc].entries.push({ ci, count: ciCounts[ci], label });
    scGroups[sc].total += ciCounts[ci];
  }

  let noneOpt = document.createElement('option');
  noneOpt.value = '-1';
  noneOpt.textContent = '\u2014 Filter by class \u2014';
  sel.appendChild(noneOpt);

  // Use CLASS_ORDER for dropdown grouping
  for (let sc of CLASS_ORDER) {
    let group = scGroups[sc];
    if (!group) continue;

    let allOpt = document.createElement('option');
    allOpt.value = 'sc:' + sc;
    allOpt.textContent = '\u25b8 ' + sc + ' (all) \u2014 ' + group.total.toLocaleString();
    sel.appendChild(allOpt);

    group.entries.sort((a, b) => b.count - a.count);
    for (let entry of group.entries) {
      let opt = document.createElement('option');
      opt.value = '' + entry.ci;
      opt.textContent = '     ' + entry.label + ' \u2014 ' + entry.count.toLocaleString();
      sel.appendChild(opt);
    }
  }

  sel.addEventListener('change', () => {
    let val = sel.value;
    if (val === '-1') {
      selectedCIs = null;
    } else if (val.startsWith('sc:')) {
      let scName = val.substring(3);
      selectedCIs = new Set();
      for (let i = 0; i < classData.length; i++) {
        if (classData[i].sc === scName) selectedCIs.add(i);
      }
    } else {
      selectedCIs = new Set([parseInt(val)]);
    }
    rebuildDependentDropdowns();
    refreshActiveResult();
    updateURL();
    redraw();
  });
}

function buildRoleDropdown() {
  let sel = document.getElementById('role-select');
  sel.innerHTML = '';

  // Count files per role
  let roleCounts = {};
  for (let role of Object.values(fileRoleMap)) {
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  }

  let noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = '\u2014 Filter by role \u2014';
  sel.appendChild(noneOpt);

  let roleOrder = ['Proponent', 'Opponent', 'Supporter'];
  for (let role of roleOrder) {
    let cnt = roleCounts[role];
    if (!cnt) continue;
    let opt = document.createElement('option');
    opt.value = role;
    opt.textContent = role + ' (' + cnt.toLocaleString() + ' files)';
    sel.appendChild(opt);
  }

  sel.addEventListener('change', () => {
    selectedRole = sel.value || null;
    rebuildDependentDropdowns();
    refreshActiveResult();
    updateURL();
    redraw();
  });
}

function buildAuthorDropdown() {
  let sel = document.getElementById('author-select');
  if (!sel) return;
  sel.innerHTML = '';

  let noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = '\u2014 Filter by author \u2014';
  sel.appendChild(noneOpt);

  let names = Object.keys(authorBranchKeys).sort((a, b) => a.localeCompare(b));
  for (let name of names) {
    let opt = document.createElement('option');
    opt.value = name;
    let count = authorBranchKeys[name].length;
    opt.textContent = name + ' (' + count + ')';
    sel.appendChild(opt);
  }

  if (!sel._hasListener) {
    sel._hasListener = true;
    sel.addEventListener('change', () => {
      selectedAuthor = sel.value || null;
      rebuildDependentDropdowns();
      refreshActiveResult();
      updateURL();
      redraw();
    });
  }
}

function buildPersonDropdown(recs) {
  recs = recs || occurrences;
  let sel = document.getElementById('person-select');
  let prev = sel.value;
  sel.innerHTML = '';

  let counts = {};
  for (let rec of recs) {
    if (rec.t === 'person') counts[rec.e] = (counts[rec.e] || 0) + 1;
  }

  let noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = '\u2014 Select a person \u2014';
  sel.appendChild(noneOpt);

  let sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (let [name, cnt] of sorted) {
    let opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name + ' (' + cnt.toLocaleString() + ')';
    sel.appendChild(opt);
  }

  sel.value = (counts[prev] !== undefined) ? prev : '';
  selectedPerson = sel.value || null;

  if (!sel._hasListener) {
    sel._hasListener = true;
    sel.addEventListener('change', () => { selectedPerson = sel.value || null; refreshActiveResult(); updateURL(); redraw(); });
  }
}

function buildOrgDropdown(recs) {
  recs = recs || occurrences;
  let sel = document.getElementById('org-select');
  let prev = sel.value;
  sel.innerHTML = '';

  let counts = {};
  for (let rec of recs) {
    if (rec.t === 'org') counts[rec.e] = (counts[rec.e] || 0) + 1;
  }

  let noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = '\u2014 Select an organization \u2014';
  sel.appendChild(noneOpt);

  let sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (let [name, cnt] of sorted) {
    let opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name + ' (' + cnt.toLocaleString() + ')';
    sel.appendChild(opt);
  }

  sel.value = (counts[prev] !== undefined) ? prev : '';
  selectedOrg = sel.value || null;

  if (!sel._hasListener) {
    sel._hasListener = true;
    sel.addEventListener('change', () => { selectedOrg = sel.value || null; refreshActiveResult(); updateURL(); redraw(); });
  }
}

// Rebuild person/org dropdowns scoped to the current class + role + author filters.
function rebuildDependentDropdowns() {
  let recs = occurrences;

  if (selectedCIs) {
    recs = recs.filter(r => r.ci !== undefined && selectedCIs.has(r.ci));
  }

  if (selectedRole) {
    recs = recs.filter(r => {
      let fileList = roundFileOrder[r.y + '-' + r.r];
      if (!fileList || fileList.length === 0) return false;
      let filename = fileList[Math.min(Math.floor(r.pr * fileList.length), fileList.length - 1)];
      return fileRoleMap[r.y + '-' + r.r + '-' + filename] === selectedRole;
    });
  }

  if (selectedAuthor) {
    let authorKeys = new Set(authorBranchKeys[selectedAuthor] || []);
    recs = recs.filter(r => {
      let fileList = roundFileOrder[r.y + '-' + r.r];
      if (!fileList || fileList.length === 0) return false;
      let filename = fileList[Math.min(Math.floor(r.pr * fileList.length), fileList.length - 1)];
      return authorKeys.has(r.y + '-' + r.r + '-' + filename);
    });
  }

  buildPersonDropdown(recs);
  buildOrgDropdown(recs);
}

function computeActiveBranchKeys() {
  const anyFilter = selectedCIs || selectedRole || selectedAuthor || selectedPerson || selectedOrg;
  if (!anyFilter) return null;

  // Author-only shortcut: return precomputed keys directly
  if (selectedAuthor && !selectedCIs && !selectedRole && !selectedPerson && !selectedOrg) {
    let branchKeys = new Set(authorBranchKeys[selectedAuthor] || []);
    let totalWords = 0;
    for (let bk of branchKeys) totalWords += fileWordCount[bk] || 0;
    return { branchKeys, fileCount: branchKeys.size, totalWords };
  }

  let authorKeys = selectedAuthor ? new Set(authorBranchKeys[selectedAuthor] || []) : null;

  // One pass: track which filter conditions each branch satisfies
  let branchConds = {};
  for (let rec of occurrences) {
    let fileList = roundFileOrder[rec.y + '-' + rec.r];
    if (!fileList || fileList.length === 0) continue;
    let fileIdx = Math.min(Math.floor(rec.pr * fileList.length), fileList.length - 1);
    let bk = rec.y + '-' + rec.r + '-' + fileList[fileIdx];
    if (!branchConds[bk]) branchConds[bk] = { cl: false, pe: false, or: false, to: false };
    if (selectedCIs && rec.ci !== undefined && selectedCIs.has(rec.ci)) branchConds[bk].cl = true;
    if (selectedPerson && rec.t === 'person' && rec.e === selectedPerson)  branchConds[bk].pe = true;
    if (selectedOrg    && rec.t === 'org'    && rec.e === selectedOrg)     branchConds[bk].or = true;
  }

  let branchKeys = new Set();
  for (let [bk, conds] of Object.entries(branchConds)) {
    if (selectedCIs    && !conds.cl)                          continue;
    if (selectedRole   && fileRoleMap[bk] !== selectedRole)   continue;
    if (selectedPerson && !conds.pe)                          continue;
    if (selectedOrg    && !conds.or)                          continue;
    if (authorKeys     && !authorKeys.has(bk))                continue;
    branchKeys.add(bk);
  }

  let totalWords = 0;
  for (let bk of branchKeys) totalWords += fileWordCount[bk] || 0;
  return { branchKeys, fileCount: branchKeys.size, totalWords };
}

function refreshActiveResult() {
  activeResult = computeActiveBranchKeys();
}

function updateURL() {
  let params = new URLSearchParams();
  // Preserve seed param if present
  let existing = new URLSearchParams(window.location.search);
  if (existing.get('seed')) params.set('seed', existing.get('seed'));

  let classSel = document.getElementById('class-select');
  if (classSel && classSel.value !== '-1') params.set('class', classSel.value);
  if (selectedRole)   params.set('role',   selectedRole);
  if (selectedAuthor) params.set('author', selectedAuthor);
  if (selectedPerson) params.set('person', selectedPerson);
  if (selectedOrg)    params.set('org',    selectedOrg);

  let qs = params.toString();
  window.history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
}

function applyURLParams() {
  let params = new URLSearchParams(window.location.search);
  if (!params.toString()) return;

  let classVal = params.get('class');
  if (classVal) {
    let sel = document.getElementById('class-select');
    if (sel) {
      sel.value = classVal;
      if (classVal.startsWith('sc:')) {
        let scName = classVal.substring(3);
        selectedCIs = new Set();
        for (let i = 0; i < classData.length; i++) {
          if (classData[i].sc === scName) selectedCIs.add(i);
        }
      } else {
        selectedCIs = new Set([parseInt(classVal)]);
      }
      rebuildDependentDropdowns();
    }
  }

  let roleVal = params.get('role');
  if (roleVal) {
    let sel = document.getElementById('role-select');
    if (sel) { sel.value = roleVal; selectedRole = roleVal; }
  }

  let authorVal = params.get('author');
  if (authorVal) {
    let sel = document.getElementById('author-select');
    if (sel) { sel.value = authorVal; selectedAuthor = authorVal; }
  }

  let personVal = params.get('person');
  if (personVal) {
    let sel = document.getElementById('person-select');
    if (sel) { sel.value = personVal; selectedPerson = personVal; }
  }

  let orgVal = params.get('org');
  if (orgVal) {
    let sel = document.getElementById('org-select');
    if (sel) { sel.value = orgVal; selectedOrg = orgVal; }
  }

  refreshActiveResult();
  redraw();
}

function buildZoomControls() {
  let controls = document.getElementById('controls-main') || document.getElementById('controls');

  let zoomOut = document.createElement('button');
  zoomOut.textContent = '\u2212';
  zoomOut.addEventListener('click', () => {
    zoomLevel = Math.max(0.1, Math.round((zoomLevel - 0.1) * 10) / 10);
    applyZoom();
  });
  controls.appendChild(zoomOut);

  let zoomLabel = document.createElement('span');
  zoomLabel.id = 'zoom-label';
  zoomLabel.style.cssText = 'font-family:monospace; font-size:10px; color:var(--muted); min-width:36px; text-align:center; display:inline-block; text-transform:uppercase; letter-spacing:0.05em;';
  zoomLabel.textContent = Math.round(zoomLevel * 100) + '%';
  controls.appendChild(zoomLabel);

  let zoomIn = document.createElement('button');
  zoomIn.textContent = '+';
  zoomIn.addEventListener('click', () => {
    zoomLevel = Math.min(4, Math.round((zoomLevel + 0.1) * 10) / 10);
    applyZoom();
  });
  controls.appendChild(zoomIn);

  let fitBtn = document.createElement('button');
  fitBtn.textContent = 'Fit';
  fitBtn.addEventListener('click', fitToScreen);
  controls.appendChild(fitBtn);

  if (new URLSearchParams(window.location.search).get('admin') === '1') {
    let hiresBtn = document.createElement('button');
    hiresBtn.textContent = 'Export Hi-Res (18k)';
    hiresBtn.style.cssText = 'border-color:var(--cp); color:var(--cp);';
    hiresBtn.addEventListener('click', saveHiRes);
    controls.appendChild(hiresBtn);
  }

  setupInteractionListeners();
}

function setupInteractionListeners() {
  let container = document.getElementById('canvas-container');
  if (!container) return;

  // Double-click: zoom in 25%, centered on cursor position
  container.addEventListener('dblclick', (e) => {
    let rect = container.getBoundingClientRect();
    let clickX = e.clientX - rect.left;
    let clickY = e.clientY - rect.top;
    let fracX = (container.scrollLeft + clickX) / (canvasW * zoomLevel);
    let fracY = (container.scrollTop  + clickY) / (canvasH * zoomLevel);
    zoomLevel = Math.min(4, Math.round((zoomLevel + 0.25) * 100) / 100);
    applyZoom();
    container.scrollLeft = fracX * canvasW * zoomLevel - clickX;
    container.scrollTop  = fracY * canvasH * zoomLevel - clickY;
  });

  // Pinch-to-zoom (mobile)
  let pinchStartDist = null;
  let pinchStartZoom = null;
  let pinchMidX = 0;
  let pinchMidY = 0;

  function pinchDist(touches) {
    let dx = touches[0].clientX - touches[1].clientX;
    let dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      pinchStartDist = pinchDist(e.touches);
      pinchStartZoom = zoomLevel;
      let rect = container.getBoundingClientRect();
      pinchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      pinchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
    }
  }, { passive: false });

  container.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinchStartDist !== null) {
      e.preventDefault();
      let fracX = (container.scrollLeft + pinchMidX) / (canvasW * zoomLevel);
      let fracY = (container.scrollTop  + pinchMidY) / (canvasH * zoomLevel);
      zoomLevel = Math.max(0.1, Math.min(4, pinchStartZoom * pinchDist(e.touches) / pinchStartDist));
      applyZoom();
      container.scrollLeft = fracX * canvasW * zoomLevel - pinchMidX;
      container.scrollTop  = fracY * canvasH * zoomLevel - pinchMidY;
    }
  }, { passive: false });

  container.addEventListener('touchend', () => {
    if (pinchStartDist !== null) {
      pinchStartDist = null;
      pinchStartZoom = null;
    }
  });
}

function fitToScreen() {
  let container = document.getElementById('canvas-container');
  let availW = container.clientWidth || window.innerWidth;
  zoomLevel = Math.max(0.1, Math.min(4, availW / canvasW));
  applyZoom();
}

function applyZoom() {
  document.getElementById('zoom-label').textContent = Math.round(zoomLevel * 100) + '%';
  resizeCanvas(Math.round(canvasW * zoomLevel), Math.round(canvasH * zoomLevel));
  redraw();
}

function buildLegend() {
  let el = document.getElementById('legend');
  el.innerHTML = '';

  for (let sc of CLASS_ORDER) {
    let color = activeColorway.classes[sc];
    if (!color) continue;
    let item = document.createElement('span');
    item.className = 'legend-item';
    item.innerHTML = '<span class="legend-swatch" style="background:' + color + '"></span>' + sc;
    el.appendChild(item);
  }
}

function bgIsDark(hex) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
}

function hexToRGBA(hex, alpha) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function wrapTextLines(ctx, text, maxWidth) {
  let lines = [];
  for (let para of text.split('\n')) {
    if (lines.length > 0) lines.push('');  // blank line between paragraphs
    let words = para.split(' ');
    let line = '';
    for (let w of words) {
      let test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function windowResized() {
  if (loaded) {
    resizeCanvas(Math.round(canvasW * zoomLevel), Math.round(canvasH * zoomLevel));
  }
  redraw();
}

// drawTextStreams — tape strips curling out from the polygon bottom edge.
// Each tape carries one question; length matches text width; longer ones curl more.
// Starting angles follow the polygon bottom-edge normals, as in the old version.
function drawTextStreams(colBots, filterYi = -1, maxYiTapeIdx = Infinity) {
  if (!questionsList || questionsList.length === 0 || !colBots || colBots.length === 0) return;

  let ctx = drawingContext;
  let isDark = bgIsDark(activeColorway.bg);
  let tapeBg    = 'rgba(255,255,255,0.95)';
  let textColor = isDark ? 'rgba(30,20,10,0.82)'    : 'rgba(28,18,8,0.80)';

  let fontSize = 11;
  let tapeH    = fontSize + 9;
  ctx.font = fontSize + 'px monospace';
  ctx.textBaseline = 'middle';

  // Bottom-edge geometry — same as old version
  let fxOff = YEAR_LABEL_W + CLASS_W + SUB_W;
  let n = layoutYears.length;
  let botPts = [{ x: 0, y: colBots[0] }];
  for (let i = 0; i < n; i++) botPts.push({ x: PAD_LEFT + i * colW + fxOff, y: colBots[i] });
  botPts.push({ x: canvasW, y: colBots[n - 1] });

  // Interpolate position + local tangent angle along a polyline parameterised by arc length
  function pathAt(pts, cum, d) {
    d = Math.max(0, Math.min(cum[cum.length - 1], d));
    let lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) { let m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
    let t = (cum[lo + 1] > cum[lo]) ? (d - cum[lo]) / (cum[lo + 1] - cum[lo]) : 0;
    return {
      x: pts[lo].x + t * (pts[lo + 1].x - pts[lo].x),
      y: pts[lo].y + t * (pts[lo + 1].y - pts[lo].y),
      angle: Math.atan2(pts[lo + 1].y - pts[lo].y, pts[lo + 1].x - pts[lo].x),
    };
  }

  // Build path: straight along normal then Archimedean spiral.
  // Uses spirals-project logic: uniform arc-length steps (dTheta = arcStep / r),
  // open coil spacing, and a meaningful minRadius.
  function buildPath(sx, sy, nx, ny, totalLen, bendDir, curlFrac) {
    const MIN_R       = 22;   // center hole radius
    const COIL_GAP    = 30;   // px between coils
    const ARC_STEP    = 8;    // arc-length per step
    const radPerRad   = COIL_GAP / (2 * Math.PI);

    let straightL = Math.max(8, totalLen * (1 - curlFrac));
    let spiralL   = totalLen - straightL;

    let pts = [{ x: sx, y: sy }], cum = [0];

    // Perlin flow-field section: sample noise at each step to continuously steer the angle.
    // This gives each tape an organic curl along its length rather than a rigid straight line.
    let ang = Math.atan2(ny, nx);
    let cx = sx, cy = sy;
    let nSteps = Math.max(2, Math.ceil(straightL / ARC_STEP));
    for (let s = 0; s < nSteps; s++) {
      ang += (noise(cx / 600, cy / 600) - 0.5) * 0.05;
      cx += Math.cos(ang) * ARC_STEP;
      cy += Math.sin(ang) * ARC_STEP;
      cum.push(cum[cum.length - 1] + ARC_STEP);
      pts.push({ x: cx, y: cy });
    }

    if (spiralL <= 0) return { pts, cum };

    // Spiral section — enter from the actual end direction of the noise-steered path
    let ex = pts[pts.length-1].x, ey = pts[pts.length-1].y;
    let perpX = -Math.sin(ang) * bendDir, perpY = Math.cos(ang) * bendDir;
    let scx = ex + perpX * MIN_R, scy = ey + perpY * MIN_R;
    let entryAngle = Math.atan2(ey - scy, ex - scx);

    let theta = 0, accum = 0, prevX = ex, prevY = ey;
    while (accum < spiralL) {
      let r    = MIN_R + theta * radPerRad;
      // Uniform arc-length step: dTheta = arcStep / r  (key spirals-project difference)
      theta   += ARC_STEP / Math.max(r, 10);
      let rNew = MIN_R + theta * radPerRad;
      let a    = entryAngle + bendDir * theta;
      let px   = scx + rNew * Math.cos(a), py = scy + rNew * Math.sin(a);
      if (px < -100 || px > canvasW + 100 || py < -200 || py > canvasH + 200) break;
      let dx = px - prevX, dy = py - prevY, dd = Math.sqrt(dx*dx + dy*dy);
      accum += dd;
      cum.push(cum[cum.length - 1] + dd);
      pts.push({ x: px, y: py });
      prevX = px; prevY = py;
    }

    return { pts, cum };
  }

  // Collect all tapes — all questions, longest first (z-back), shortest last (z-front).
  // Longer questions extend further before curling; shorter ones curl sooner and sit on top.
  let tapes = [];
  let yiCounts = {};  // track tape index per year for staggered animation

  // Sort all questions longest-first for z-ordering (longest drawn first = behind)
  let sortedQ = [...questionsList].sort((a, b) => b.text.length - a.text.length);

  // Use ~30% of questions, sampled uniformly across the sorted list
  let kept = sortedQ.filter((_, qi) => seededRand(qi * 997 + 7, 42) < 0.30);

  // Build column segment lookup: layoutYears[yi] → edge segment [segStart, segEnd] arc-dist
  // botPts[0] = left margin, botPts[1..n] = column starts, botPts[n+1] = right margin
  let edgeCum = [0];
  for (let i = 0; i < botPts.length - 1; i++) {
    let dx = botPts[i+1].x - botPts[i].x, dy = botPts[i+1].y - botPts[i].y;
    edgeCum.push(edgeCum[i] + Math.sqrt(dx*dx + dy*dy));
  }
  // colSegs[yi] = { start, end } arc-distances for the yi-th column's bottom segment
  let colSegs = layoutYears.map((_, yi) => ({
    start: edgeCum[yi + 1],
    end:   edgeCum[yi + 2] || edgeCum[edgeCum.length - 1],
  }));
  let totalEdgeLen = edgeCum[edgeCum.length - 1];

  // Point + outward normal at arc-distance d along the bottom edge
  function edgeAt(d) {
    d = Math.max(0, Math.min(totalEdgeLen, d));
    let seg = 0;
    while (seg < botPts.length - 2 && edgeCum[seg + 1] < d) seg++;
    let t = (edgeCum[seg+1] > edgeCum[seg]) ? (d - edgeCum[seg]) / (edgeCum[seg+1] - edgeCum[seg]) : 0;
    let sx = botPts[seg].x + t * (botPts[seg+1].x - botPts[seg].x);
    let sy = botPts[seg].y + t * (botPts[seg+1].y - botPts[seg].y);
    let rdx = botPts[seg+1].x - botPts[seg].x, rdy = botPts[seg+1].y - botPts[seg].y;
    let rlen = Math.sqrt(rdx*rdx + rdy*rdy) || 1;
    let nx = -rdy / rlen, ny = rdx / rlen;
    if (ny < 0) { nx = -nx; ny = -ny; }
    return { sx, sy, nx, ny };
  }

  for (let ki = 0; ki < kept.length; ki++) {
    let q    = kept[ki];
    let seed = ki * 997 + 13;

    // lenFrac: 0 = longest question, 1 = shortest
    let lenFrac = ki / Math.max(1, kept.length - 1);

    // Originate from the question's source year column
    let yi = layoutYears.indexOf(q.year);
    let d;
    if (yi >= 0) {
      let { start, end } = colSegs[yi];
      // Spread within column using seeded random; 5% margin either side
      d = start + (0.05 + seededRand(seed, 3) * 0.90) * (end - start);
    } else {
      // Year not in layout: distribute by index as fallback
      d = ((ki + 0.5) / kept.length) * totalEdgeLen;
    }
    let { sx, sy, nx, ny } = edgeAt(d);

    let textW    = ctx.measureText(q.text).width;
    let totalLen = textW + 16;
    let bendDir  = seededRand(seed, 9) < 0.5 ? 1 : -1;

    // 10x the curl range: longest extend up to 2800px before curling, shortest ~200px
    let straightL = 200 + (1 - lenFrac) * 2600;
    straightL = Math.min(straightL, totalLen * 0.92);
    let curlFrac = Math.max(0, 1 - straightL / totalLen);

    let { pts, cum } = buildPath(sx, sy, nx, ny, totalLen, bendDir, curlFrac);
    if (pts.length < 2) continue;

    let tapeYiIdx = yi >= 0 ? ((yiCounts[yi] = (yiCounts[yi] || 0) + 1) - 1) : -1;
    tapes.push({ pts, cum, text: q.text, textW, yi, yiIdx: tapeYiIdx });
  }

  // Render each tape atomically (background then text) in z-order.
  // tapes[] is already longest-first; iterating in reverse puts shortest (smallest) on top.
  ctx.lineWidth = tapeH;
  ctx.lineCap   = 'round';
  ctx.lineJoin  = 'round';
  ctx.lineCap   = 'butt';
  ctx.textAlign = 'center';

  for (let ti = tapes.length - 1; ti >= 0; ti--) {
    let tape = tapes[ti];
    if (filterYi >= 0 && tape.yi !== filterYi) continue;
    if (tape.yiIdx >= maxYiTapeIdx) continue;
    let { pts, cum, text, textW } = tape;

    // Tape background
    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.10)';
    ctx.shadowBlur    = 3;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;
    ctx.strokeStyle   = tapeBg;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.restore();

    // Text along the tape path — characters follow the raw tangent angle with no
    // normalization or flipping. The tape behaves like a physical ribbon: orientation
    // changes smoothly with the curve and is always consistent within a stream.
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = textColor;
    let totalPathLen = cum[cum.length - 1];
    let startD = Math.max(4, (totalPathLen - textW) / 2);
    let charW  = textW / text.length;
    for (let ci = 0; ci < text.length; ci++) {
      let d = startD + (ci + 0.5) * charW;
      if (d >= totalPathLen - 2) break;
      let { x, y, angle } = pathAt(pts, cum, d);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillText(text[ci], 0, 0);
      ctx.restore();
    }
  }
}

function draw() {
  if (!loaded) {
    background(activeColorway.bg);
    fill(150);
    noStroke();
    textAlign(CENTER, CENTER);
    textFont('monospace');
    textSize(14);
    text('Loading corpus data...', width / 2, height / 2);
    return;
  }

  background(activeColorway.bg);
  scale(zoomLevel);

  translate(0, CANVAS_TOP_MARGIN);

  // --- Title, subtitle, summary text, key — translated coords; negative y = above content ---
  // Top margin equals left margin (PAD_RIGHT) for visual balance.
  let dark = bgIsDark(activeColorway.bg);
  let titleCtx = drawingContext;
  titleCtx.textAlign = 'right';
  titleCtx.textBaseline = 'alphabetic';

  const TITLE_LINE1 = 'The Burden of Proof';
  const TITLE_REST  = 'Must Be Met Every Three Years with New Evidence';
  const SUMMARY_TEXT = 'Every three years, scores of nonprofit organizations, law school clinics, trade associations, academics, companies, and individuals file petitions and comments to the U.S. Copyright Office. Their filings are concerned with one law: 17 U.S.C. \u00a7 1201(a)(1), a law which aims to prevent the unauthorized copying of digital works. For months, they request\u2014and oppose\u2014limited exemptions to the law. The requests seek permission to break digital locks in order to do things already allowed by copyright law, like repair a tractor, or show short clips of a film in a media studies class, or access data captured by medical devices implanted in their bodies. The opposition insists that granting such permission would undermine entire industries.\n\nSince this ritual began in 2000, the participants in this Triennial Review have spent countless hours generating more than 55,000 pages of petitions, comments, opposition comments, and reply comments. This corpus represents a debate over the contours of the 1201 statute\u2014a statute almost never used by those whose rights it is nominally designed to protect. Ultimately, the resources devoted to the bureaucratic process of exemption-granting almost certainly dwarf those devoted to enforcing the law itself.\n\nThis project captures the effort of this process, mapping the documents written and filed by all of the parties involved. This visualization doesn\u2019t attempt to simplify this strange bureaucratic process; instead it reveals the full depth of the labor and the exhausting repetition of the system.';

  // Key layout constants
  const KEY_ROW_H = 35;
  const KEY_GAP = 16;

  let activeClassCount = CLASS_ORDER.filter(sc => activeColorway.classes[sc]).length;
  // Title + key fills the full header height: key bottom sits at y=0, title above it.
  const keyBottomTarget = -(activeClassCount * KEY_ROW_H + KEY_GAP);

  // Solve for titleFontSize: titleBlockBottom = keyBottomTarget.
  // titleBlockBottom ≈ PAD_RIGHT - CANVAS_TOP_MARGIN + fs*(0.72 + N*0.95)
  // N (line count) is scale-invariant — iterate to convergence.
  let titleFontSize = 144;
  for (let iter = 0; iter < 5; iter++) {
    titleCtx.font = `${titleFontSize}px "Bebas Neue", Georgia, serif`;
    let w = titleCtx.measureText(TITLE_LINE1).width;
    let nLines = 1 + wrapTextLines(titleCtx, TITLE_REST, w).length;
    let availH = keyBottomTarget - (PAD_RIGHT - CANVAS_TOP_MARGIN);
    let fs = Math.round(availH / (0.72 + nLines * 0.95));
    if (Math.abs(fs - titleFontSize) < 1) break;
    titleFontSize = fs;
  }

  let titleCapH = Math.round(titleFontSize * 0.72);
  let titleBaseY = (PAD_RIGHT + titleCapH) - CANVAS_TOP_MARGIN;
  let titleColor = activeColorway.classes[CLASS_ORDER[0]] || (dark ? '#ffffff' : '#000000');
  titleCtx.fillStyle = titleColor;
  titleCtx.font = `${titleFontSize}px "Bebas Neue", Georgia, serif`;
  let titleColW  = titleCtx.measureText(TITLE_LINE1).width;
  let titleLineH = Math.round(titleFontSize * 0.95);
  let titleLines = [TITLE_LINE1, ...wrapTextLines(titleCtx, TITLE_REST, titleColW)];
  let titleRightX = PAD_RIGHT + titleColW;
  for (let i = 0; i < titleLines.length; i++) {
    titleCtx.fillText(titleLines[i], titleRightX, titleBaseY + i * titleLineH);
  }
  let titleBlockBottom = titleBaseY + titleLines.length * titleLineH;

  // Right column: desc text + reference spirals, both left-aligned at rightColX
  let rightColX = PAD_RIGHT + titleColW + 40;

  // Pre-compute spiral sizes so we know where the tallest spiral top sits.
  let refTexts = [
    { label: '17 U.S.C. \u00A7 1201', detail: '~6,800 words', words: 6800, colorClass: 'All Works' },
    { label: 'Copyright Law: Cases & Materials', detail: '~280,000 words', words: 280000 },
    { label: 'Little Dorrit', detail: '~340,000 words', words: 340000, colorClass: 'Literary Works' },
  ];
  let refInfos = [];
  for (let ref of refTexts) {
    let refPx = wcToPixels(ref.words);
    let straightLen = 20;
    let spiralPx = Math.max(0, refPx - straightLen);
    let disc = SPIRAL_R0 * SPIRAL_R0 + 2 * SPIRAL_GROWTH * spiralPx;
    let T = (-SPIRAL_R0 + Math.sqrt(disc)) / SPIRAL_GROWTH;
    let estRadius = SPIRAL_R0 + SPIRAL_GROWTH * T;
    refInfos.push({ ref, refPx, straightLen, spiralPx, estRadius });
  }
  let maxSpiralRadius = Math.max(...refInfos.map(r => r.estRadius));
  let refBaseY = 0;   // spiral bottoms sit at the content line
  let spiralTopY = refBaseY - 2 * maxSpiralRadius;  // top of tallest spiral

  // Wrap paragraphs independently — single line break between them, no blank lines.
  function wrapParas(ctx, text, maxWidth) {
    let out = [];
    for (let para of text.split('\n')) {
      if (out.length > 0) out.push('');
      let paraLines = wrapTextLines(ctx, para.trim(), maxWidth);
      for (let l of paraLines) out.push(l);
    }
    return out;
  }

  // Align desc text cap-top with title cap-top, offset down to first baseline.
  // Binary-search font size so the text fills exactly down to just above the tallest spiral.
  let subtitleW = Math.min(700, canvasW - rightColX - PAD_RIGHT);
  let summaryFontSize = 16;
  let summaryLineH = Math.round(summaryFontSize * 1.5);
  let summaryCapH = Math.round(summaryFontSize * 0.72);
  let summaryStartY = (titleBaseY - titleCapH) + summaryCapH;
  let availTextH = Math.max(summaryLineH, spiralTopY - summaryStartY - 16);
  let summaryLines;
  let fsLo = 8, fsHi = 72;
  for (let iter = 0; iter < 16; iter++) {
    let fsMid = (fsLo + fsHi) / 2;
    let lh = Math.round(fsMid * 1.5);
    titleCtx.font = fsMid + 'px Georgia, "Times New Roman", serif';
    let lines = wrapParas(titleCtx, SUMMARY_TEXT, subtitleW);
    if (lines.length * lh < availTextH) {
      fsLo = fsMid;  // text too short — increase font
    } else {
      fsHi = fsMid;  // text too tall — decrease font
    }
  }
  summaryFontSize = fsLo;
  summaryLineH = Math.round(summaryFontSize * 1.5);
  summaryCapH = Math.round(summaryFontSize * 0.72);
  summaryStartY = (titleBaseY - titleCapH) + summaryCapH;

  // Draw summary text — right column, left-aligned
  titleCtx.textAlign = 'left';
  titleCtx.textBaseline = 'alphabetic';
  titleCtx.font = summaryFontSize + 'px Georgia, "Times New Roman", serif';
  titleCtx.fillStyle = dark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)';
  summaryLines = wrapParas(titleCtx, SUMMARY_TEXT, subtitleW);
  for (let i = 0; i < summaryLines.length; i++) {
    titleCtx.fillText(summaryLines[i], rightColX, summaryStartY + i * summaryLineH);
  }

  // Brown tint behind everything in the bottom half — full canvas width, from centerY to bottom
  let tintCtx = drawingContext;
  tintCtx.fillStyle = activeColorway.tint;
  tintCtx.fillRect(0, centerY, canvasW, canvasH - centerY);

  // White polygon behind plot — top edge follows proponent tops, bottom follows opponent bottoms
  let bgCtx = drawingContext;
  let proMidY = centerY - CENTER_GAP / 2;
  let oppMidY = centerY + CENTER_GAP / 2;

  // Per-column top (proponent) and bottom (opponent) y extents
  let colTops = layoutYears.map(yr => {
    let bands = proClassBands[yr] || {};
    let top = proMidY;
    for (let sc of Object.keys(bands)) if (bands[sc].yStart < top) top = bands[sc].yStart;
    return top;
  });
  let colBots = layoutYears.map(yr => {
    let bands = oppClassBands[yr] || {};
    let bot = oppMidY;
    for (let sc of Object.keys(bands)) if (bands[sc].yEnd > bot) bot = bands[sc].yEnd;
    return bot;
  });

  // One vertex per column at the file-branch start (fx1 = PAD_LEFT + i*colW + YEAR_LABEL_W + CLASS_W + SUB_W),
  // anchored at the canvas left/right edges.
  let n = layoutYears.length;
  let fxOff = YEAR_LABEL_W + CLASS_W + SUB_W;
  let topPts = [{ x: PAD_LEFT, y: colTops[0] }];
  for (let i = 0; i < n; i++) topPts.push({ x: PAD_LEFT + i * colW + fxOff, y: colTops[i] });
  topPts.push({ x: canvasW, y: colTops[n - 1] });

  let botPts = [{ x: PAD_LEFT, y: colBots[0] }];
  for (let i = 0; i < n; i++) botPts.push({ x: PAD_LEFT + i * colW + fxOff, y: colBots[i] });
  botPts.push({ x: canvasW, y: colBots[n - 1] });

  // Text streams behind the polygon — drawn before so polygon occludes the top of each stream
  drawTextStreams(colBots);

  bgCtx.fillStyle = activeColorway.polygon;
  bgCtx.beginPath();
  bgCtx.moveTo(topPts[0].x, topPts[0].y);
  for (let i = 1; i < topPts.length; i++) bgCtx.lineTo(topPts[i].x, topPts[i].y);
  for (let i = botPts.length - 1; i >= 0; i--) bgCtx.lineTo(botPts[i].x, botPts[i].y);
  bgCtx.closePath();
  bgCtx.fill();

  // --- Blueprint-style annotations above each year's peak ---
  {
    function fmtW(w) {
      if (w >= 1e6) return (w / 1e6).toFixed(1) + 'M';
      if (w >= 1e3) return Math.round(w / 1e3) + 'K';
      return String(w);
    }
    let isDk = bgIsDark(activeColorway.bg);
    let annColor = isDk ? 'rgba(160,185,220,0.72)' : 'rgba(40,70,130,0.60)';
    let bpCtx = drawingContext;
    bpCtx.font = '11px monospace';
    bpCtx.textBaseline = 'bottom';
    bpCtx.lineWidth = 0.5;
    bpCtx.strokeStyle = annColor;
    bpCtx.fillStyle   = annColor;

    const LEADER_H  = 24;   // vertical leader line height above peak
    const LINE_H    = 13;   // line spacing for annotation text
    const TICK_W    = 5;    // horizontal tick length at leader top

    for (let yi = 0; yi < layoutYears.length; yi++) {
      let yr  = layoutYears[yi];
      let st  = yearStats[yr];
      if (!st) continue;

      let ax  = PAD_LEFT + yi * colW + fxOff;   // file-axis x for this column
      let ay  = colTops[yi];                     // topmost y of proponent section

      let lines = [
        fmtW(st.words) + ' WORDS',
        st.orgs + ' ORGANIZATIONS',
        st.files + ' FILES',
      ];

      // 2008 annotation is pushed up 320px extra to clear the tall 2012 column to its right
      let extraLift = (String(yr) === '2008') ? 320 : 0;

      // Leader: vertical line up from peak, then horizontal tick right
      bpCtx.beginPath();
      bpCtx.moveTo(ax, ay);
      bpCtx.lineTo(ax, ay - LEADER_H - extraLift);
      bpCtx.lineTo(ax + TICK_W, ay - LEADER_H - extraLift);
      bpCtx.stroke();

      // Small circle at the peak contact point
      bpCtx.beginPath();
      bpCtx.arc(ax, ay, 1.5, 0, Math.PI * 2);
      bpCtx.fill();

      // Text block left-aligned from tick end, bottom of last line at leader top
      bpCtx.textAlign = 'left';
      let textX = ax + TICK_W + 3;
      let textY = ay - LEADER_H - extraLift;
      for (let li = 0; li < lines.length; li++) {
        bpCtx.fillText(lines[li], textX, textY - (lines.length - 1 - li) * LINE_H);
      }
    }
  }

  // Draw proponent / opponent dividing lines (top and bottom of the gap)
  let ctx0 = drawingContext;
  let isDarkBg = bgIsDark(activeColorway.bg);
  let divColor = isDarkBg ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.22)';
  ctx0.strokeStyle = divColor;
  ctx0.lineWidth = 1;
  ctx0.beginPath();
  ctx0.moveTo(0, proMidY);
  ctx0.lineTo(canvasW, proMidY);
  ctx0.stroke();
  ctx0.beginPath();
  ctx0.moveTo(0, oppMidY);
  ctx0.lineTo(canvasW, oppMidY);
  ctx0.stroke();

  let labelColor = isDarkBg ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)';
  ctx0.fillStyle = labelColor;
  ctx0.font = '64px "Bebas Neue", Georgia, serif';
  ctx0.textAlign = 'left';
  ctx0.textBaseline = 'bottom';
  ctx0.fillText('↑', 12, proMidY - 4 - 64);
  ctx0.fillText('Proponents', 12, proMidY - 4);
  ctx0.textBaseline = 'top';
  ctx0.fillText('Opponents', 12, oppMidY + 4);
  ctx0.fillText('↓', 12, oppMidY + 4 + 64);
  let arrowBottom = oppMidY + 4 + 64 + 64;  // bottom of ↓ glyph (textBaseline='top', 64px font)
  let canvasBottom = canvasH - CANVAS_TOP_MARGIN;
  let questionsCenterY = (arrowBottom + canvasBottom) / 2;
  ctx0.save();
  ctx0.translate(32, questionsCenterY);
  ctx0.rotate(Math.PI / 2);
  ctx0.textAlign = 'center';
  ctx0.textBaseline = 'middle';
  ctx0.fillText('QUESTIONS', 0, 0);
  ctx0.restore();

  // Draw faded guide lines (connection from year to year)
  let ctx2 = drawingContext;
  for (let node of treeNodes) {
    if (!node.branch) continue;
    let c = activeColorway.classes[node.sc] || activeColorway.defaultDot;
    ctx2.strokeStyle = hexToRGBA(c, 0.25);
    ctx2.lineWidth = 0.75;
    ctx2.beginPath();
    let start = node.branch.points[0];
    ctx2.moveTo(start.x, start.y);
    if (node.year === layoutYears[layoutYears.length - 1]) {
      // Last year: guide extends horizontally to the end of the white block
      ctx2.lineTo(canvasW, start.y);
    } else if (node.guide) {
      ctx2.lineTo(node.guide.x, node.guide.y);
    } else {
      continue;
    }
    ctx2.stroke();
  }

  // Draw tree structure — use canvas API consistently to avoid p5.js stroke cache issues
  for (let node of treeNodes) {
    if (node.type === 'year') {
      fill(30);
      noStroke();
      textAlign(CENTER, CENTER);
      textSize(36);
      textFont('monospace');
      text(node.label, node.x, node.y);

    } else if (node.type === 'class') {
      ctx2.strokeStyle = 'rgb(190,190,190)';
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.moveTo(node.x, node.yStart);
      ctx2.lineTo(node.x, node.yEnd);
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.moveTo(node.x - 10, node.y);
      ctx2.lineTo(node.x, node.y);
      ctx2.stroke();

    } else if (node.type === 'subclass') {
      ctx2.strokeStyle = 'rgb(210,210,210)';
      ctx2.lineWidth = 0.5;
      ctx2.beginPath();
      ctx2.moveTo(node.x, node.yStart);
      ctx2.lineTo(node.x, node.yEnd);
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.moveTo(node.x - 10, node.y);
      ctx2.lineTo(node.x, node.y);
      ctx2.stroke();

    } else if (node.branch) {
      let b = node.branch;
      let bKey = node.year + '-' + node.rnd + '-' + node.filename;
      let isActive = !activeResult || activeResult.branchKeys.has(bKey);
      let alpha = isActive ? 0.80 : 0.05;
      ctx2.strokeStyle = hexToRGBA(activeColorway.classes[node.sc] || activeColorway.defaultDot, alpha);
      ctx2.lineWidth = 1.8;
      ctx2.beginPath();
      ctx2.moveTo(b.points[0].x, b.points[0].y);
      for (let i = 1; i < b.points.length; i++) {
        ctx2.lineTo(b.points[i].x, b.points[i].y);
      }
      ctx2.stroke();
    }
  }

  // Subclass dividers — thin colored horizontal rules at each subclass boundary,
  // spanning from the class-label column edge to the file axis, creating visible
  // "shelf" separators within each class band at every year column.
  let sdCtx = drawingContext;
  sdCtx.lineWidth = 0.75;
  for (let yi = 0; yi < layoutYears.length; yi++) {
    let yr = layoutYears[yi];
    let xBase = PAD_LEFT + yi * colW;
    let x0 = xBase + YEAR_LABEL_W + CLASS_W;          // class-label column right edge
    let x1 = xBase + YEAR_LABEL_W + CLASS_W + SUB_W;  // file axis x
    let ssBands = subclassBands[yr];
    if (!ssBands) continue;

    for (let sc of CLASS_ORDER) {
      let scBands = ssBands[sc];
      if (!scBands) continue;
      let color = activeColorway.classes[sc] || activeColorway.defaultDot;
      let sortedBands = Object.values(scBands).sort((a, b) => a.yStart - b.yStart);

      for (let i = 0; i < sortedBands.length - 1; i++) {
        // Centre of the gap between this subclass and the next
        let divY = (sortedBands[i].yEnd + sortedBands[i + 1].yStart) / 2;
        sdCtx.strokeStyle = hexToRGBA(color, 0.35);
        sdCtx.beginPath();
        sdCtx.moveTo(x0, divY);
        sdCtx.lineTo(x1, divY);
        sdCtx.stroke();
      }
    }
  }

  // --- Color key + reference scale spirals, side by side ---
  // Key labels on the left; spirals packed horizontally to their right.
  const KEY_FONT = '16px monospace';
  titleCtx.font = KEY_FONT;
  let keyLabelW = 0;
  for (let sc of CLASS_ORDER) {
    if (!activeColorway.classes[sc]) continue;
    let w = titleCtx.measureText(sc).width;
    if (w > keyLabelW) keyLabelW = w;
  }

  // Key sits in the left column, below the title, right-justified at the title's right edge.
  let keyTop = titleBlockBottom + KEY_GAP - 75;

  // Draw key labels — right-justified at titleRightX
  noStroke();
  textAlign(RIGHT, TOP);
  textSize(26);
  textFont('monospace');
  let ly = keyTop;
  for (let sc of CLASS_ORDER) {
    let c = activeColorway.classes[sc];
    if (!c) continue;
    fill(c);
    text(sc, titleRightX, ly);
    ly += KEY_ROW_H;
  }

  // Spirals: all bottom edges at refBaseY, tails entering from that line.
  // Center each spiral above refBaseY by its radius; label centered below.
  // refTexts, refInfos, and refBaseY are all computed above (before the summary text).
  let refColors = CLASS_ORDER.map(sc => activeColorway.classes[sc]).filter(Boolean);
  let rx = rightColX;        // spirals left-aligned with desc text in the right column
  let refGap = 50;

  for (let i = 0; i < refInfos.length; i++) {
    let { ref, straightLen, spiralPx, estRadius } = refInfos[i];

    // Spiral center is estRadius above the base line so the coil bottom sits on refBaseY
    let scy = refBaseY - estRadius;
    let cx = rx + straightLen + estRadius;
    // Tail runs horizontally at the base line into the spiral entry (bottom of first coil)
    let tailY = refBaseY;

    let refColor = ref.colorClass
      ? (activeColorway.classes[ref.colorClass] || refColors[i % refColors.length])
      : refColors[i % refColors.length];
    ctx2.strokeStyle = hexToRGBA(refColor, 0.70);
    ctx2.lineWidth = 1.8;
    ctx2.beginPath();
    ctx2.moveTo(rx, tailY);
    ctx2.lineTo(cx, tailY);

    // Spiral from the bottom entry point (theta = π → bottom of circle)
    let theta = Math.PI;
    let spiralAccum = 0;
    let prevX2 = cx, prevY2 = tailY;
    while (spiralAccum < spiralPx) {
      theta += SPIRAL_DTHETA;
      let r = SPIRAL_R0 + SPIRAL_GROWTH * (theta - Math.PI);
      let px = cx + r * Math.cos(theta - Math.PI / 2);
      let py = scy + r * Math.sin(theta - Math.PI / 2);
      if (px < 2 || px > canvasW - 2 || py < -(CANVAS_TOP_MARGIN - 10) || py > canvasH - CANVAS_TOP_MARGIN - 10) break;
      let ddx = px - prevX2, ddy = py - prevY2;
      spiralAccum += Math.sqrt(ddx * ddx + ddy * ddy);
      ctx2.lineTo(px, py);
      prevX2 = px; prevY2 = py;
    }
    ctx2.stroke();

    // Label centered under the spiral
    noStroke();
    fill(100);
    textSize(11);
    textAlign(CENTER, TOP);
    text(ref.label, cx, refBaseY + 6);
    fill(150);
    textSize(10);
    text(ref.detail, cx, refBaseY + 20);

    rx = cx + estRadius + refGap;
  }

  // --- Info panel (canvas-drawn, included in PNG) ---
  if (activeResult) {
    let ink    = activeColorway.classes[CLASS_ORDER[0]] || '#000000';
    let valFs  = Math.round(titleFontSize * 0.60 * 1.30);
    let lblFs  = Math.round(valFs * 0.42);
    let valCapH = Math.round(valFs * 0.72);
    let pairGap = Math.round(valFs * 0.25);
    let panelY  = ly + 32;

    let classLabel = null;
    if (selectedCIs) {
      let sel = document.getElementById('class-select');
      let opt = sel ? sel.options[sel.selectedIndex] : null;
      if (opt) classLabel = opt.textContent.replace(/^\s*[\u25b8\u25ba]\s*/, '').replace(/\s*\u2014.*$/, '').trim();
    }

    let wTotal = activeResult.totalWords;
    let wordsStr = wTotal >= 1e6 ? (wTotal / 1e6).toFixed(1) + 'M' :
                   wTotal >= 1e3 ? Math.round(wTotal / 1e3) + 'K' : String(wTotal);

    let pairs = [];
    if (classLabel)      pairs.push({ label: 'Class',  val: classLabel });
    if (selectedRole)    pairs.push({ label: 'Role',   val: selectedRole });
    if (selectedAuthor)  pairs.push({ label: 'Author', val: selectedAuthor });
    if (selectedPerson)  pairs.push({ label: 'Person', val: selectedPerson });
    if (selectedOrg)     pairs.push({ label: 'Org',    val: selectedOrg });
    pairs.push({ label: 'Files', val: activeResult.fileCount.toLocaleString() });
    pairs.push({ label: 'Words', val: wordsStr });

    titleCtx.textAlign    = 'right';
    titleCtx.textBaseline = 'top';

    for (let { label, val } of pairs) {
      // Key name: Bebas Neue small, light
      titleCtx.font      = `${lblFs}px "Bebas Neue", Georgia, serif`;
      titleCtx.fillStyle = hexToRGBA(ink, 0.30);
      titleCtx.fillText(label.toUpperCase(), titleRightX, panelY);
      panelY += Math.round(lblFs * 0.88);

      // Value: Bebas Neue large, dark
      titleCtx.font      = `${valFs}px "Bebas Neue", Georgia, serif`;
      titleCtx.fillStyle = hexToRGBA(ink, 0.85);
      titleCtx.fillText(val, titleRightX, panelY);
      panelY += valCapH + pairGap;
    }
  }

  // Draw dots
  if (!activeResult) {
    document.getElementById('stats').textContent = '';
    return;
  }

  let ctx = drawingContext;
  let count = 0;
  let entityFilterActive = selectedPerson || selectedOrg;

  for (let rec of occurrences) {
    let fileList = roundFileOrder[rec.y + '-' + rec.r];
    if (!fileList || fileList.length === 0) continue;

    let posInFiles = rec.pr * fileList.length;
    let fileIdx = Math.min(Math.floor(posInFiles), fileList.length - 1);
    let posInFile = posInFiles - fileIdx;
    let branchKey = rec.y + '-' + rec.r + '-' + fileList[fileIdx];

    if (!activeResult.branchKeys.has(branchKey)) continue;

    if (entityFilterActive) {
      if (selectedPerson && !(rec.t === 'person' && rec.e === selectedPerson)) continue;
      if (selectedOrg    && !(rec.t === 'org'    && rec.e === selectedOrg))    continue;
    }

    let branch = fileBranchMap[branchKey];
    if (!branch) continue;

    let [dotX, dotY] = getPointOnBranch(branch, posInFile);
    let color = ciToColor[rec.ci] || activeColorway.defaultDot;

    count++;
    ctx.fillStyle = hexToRGBA(color, 0.85);
    ctx.beginPath();
    ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  document.getElementById('stats').textContent = count.toLocaleString() + ' occurrences';
}



function saveHiRes() {
  let savedZoom = zoomLevel;
  zoomLevel = 18000 / canvasW;
  resizeCanvas(18000, 9000);
  redraw();

  let canvas = document.querySelector('canvas');
  let now = new Date();
  let ts = now.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '');
  let link = document.createElement('a');
  link.download = '1201-corpus-hires-' + ts + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();

  zoomLevel = savedZoom;
  resizeCanvas(Math.round(canvasW * savedZoom), Math.round(canvasH * savedZoom));
  redraw();
}
window.saveHiRes = saveHiRes;

function savePlot() {
  let savedZoom = zoomLevel;
  zoomLevel = 1;
  resizeCanvas(canvasW, canvasH);
  redraw();

  let canvas = document.querySelector('canvas');
  let now = new Date();
  let ts = now.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '');
  let link = document.createElement('a');
  link.download = '1201-corpus-' + ts + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();

  zoomLevel = savedZoom;
  resizeCanvas(Math.round(canvasW * savedZoom), Math.round(canvasH * savedZoom));
  redraw();
}
