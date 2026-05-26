// validate-extraction.js — Sanity-check an extraction payload
// Run inside the browser AFTER all extract-*-v2.js scripts have produced their data.
// Replace EXTRACTION_PLACEHOLDER with the merged extraction object (passed in by extractor.py).
// Returns: { errors, warnings, stats }
// NOTE: No IIFE wrapper.

var DATA = EXTRACTION_PLACEHOLDER;
var errors = [];
var warnings = [];
var stats = {};

function pushE(msg) { errors.push(msg); }
function pushW(msg) { warnings.push(msg); }

// --- Structure checks ---
var structure = DATA && DATA.structure ? DATA.structure : null;
if (!structure) pushE('Missing structure'); else {
  if (structure.tag !== 'body' && structure.tag !== 'html') pushE('Root structure tag is not body/html: ' + structure.tag);
  if (!structure.children || structure.children.length === 0) pushE('Structure has no children');
  if (DATA._stats && DATA._stats.truncatedAtDepth > 0) pushW('Structure had ' + DATA._stats.truncatedAtDepth + ' branches truncated by maxDepth — consider raising maxDepth');
  stats.structureNodes = DATA._stats ? DATA._stats.kept : null;
  stats.maxDepthReached = DATA._stats ? DATA._stats.maxDepthReached : null;
}

// --- Coordinate sanity ---
function walk(node, fn) { if (!node) return; fn(node); if (node.children) node.children.forEach(function (c) { walk(c, fn); }); }
var negCoord = 0, zeroSize = 0, totalCoord = 0;
walk(structure, function (n) {
  if (!n.coords || !n.coords.viewport) return;
  totalCoord++;
  var v = n.coords.viewport;
  if (v.x < -200 || v.y < -200) negCoord++;
  if (v.w === 0 || v.h === 0) zeroSize++;
});
if (negCoord > 0) pushW('Found ' + negCoord + ' elements with strongly-negative viewport coordinates (likely off-screen/transformed)');
if (zeroSize > 0 && totalCoord > 0 && zeroSize / totalCoord > 0.2) pushW('More than 20% of nodes have zero size — extraction may have run before layout settled');
stats.negCoord = negCoord; stats.zeroSize = zeroSize; stats.totalCoord = totalCoord;

// --- Text nodes ---
if (DATA.textNodes) {
  stats.textNodes = DATA.textNodes.length;
  if (DATA.textNodes.length === 0) pushW('No text nodes extracted — page may be canvas/image-only or extraction failed');
  if (DATA._truncated) pushW('Text nodes were truncated to ' + DATA.textNodes.length);
}

// --- Visual data ---
if (DATA.svgIcons) {
  stats.svgIcons = DATA.svgIcons.length;
  var overflowed = DATA.svgIcons.filter(function (s) { return s && s._overflow; }).length;
  if (overflowed > 0) pushW(overflowed + ' SVG icons were overflow-stripped (data lost). Re-run with raised SVG budget.');
}
if (DATA.buttonCandidates) {
  stats.buttonCandidates = DATA.buttonCandidates.length;
  var visualBtns = DATA.buttonCandidates.filter(function (b) { return b.source === 'visual'; }).length;
  stats.visualButtonCandidates = visualBtns;
  if (DATA.buttonCandidates.length === 0) pushW('No button candidates found — verify page has interactive UI');
}

// --- Fixed elements ---
if (DATA.fixedElements) {
  stats.fixedElements = DATA.fixedElements.length;
}

// --- Scroll state ---
if (DATA.scrollState) {
  stats.docHeight = DATA.scrollState.docHeight;
  stats.docWidth = DATA.scrollState.docWidth;
  if (DATA.scrollState.docHeight < 200) pushW('Document height < 200px — page may not be fully loaded');
  if (DATA.scrollState.docWidth < DATA.scrollState.viewportW) pushW('Document width less than viewport — possible layout collapse');
}

// --- Lazy load ---
if (DATA.lazyLoad) {
  stats.lazyLoadIterations = DATA.lazyLoad.iterations;
  stats.lazyLoadGrowthRatio = DATA.lazyLoad.growthRatio;
  if (DATA.lazyLoad.growthRatio < 1.05 && DATA.lazyLoad.iterations >= 3) {
    // page didn't grow much — that's fine for short pages, only warn if very tall
  }
  if (DATA.lazyLoad.iterations >= 28) pushW('Lazy-load hit max iterations — page may have infinite scroll');
}

// --- CSS custom properties ---
if (DATA.cssCustomProperties) {
  stats.cssVarCount = Object.keys(DATA.cssCustomProperties).length;
}
if (DATA.fontFaces) {
  stats.fontFaces = DATA.fontFaces.length;
}
if (DATA.typography) {
  stats.typeScaleSize = (DATA.typography.typeScale || []).length;
  stats.colorPaletteSize = (DATA.typography.colorPalette || []).length;
}

return { errors: errors, warnings: warnings, stats: stats };
