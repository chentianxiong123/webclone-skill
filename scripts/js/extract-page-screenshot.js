// extract-page-screenshot.js — Full-page screenshot at maximum resolution
// Returns: { screenshotPath, viewport, scrollHeight, docWidth, docHeight }
// The screenshot is saved to disk by the Python orchestrator (this script only records metadata).
// NOTE: No IIFE wrapper.

var scrollY = window.scrollY;
var scrollX = window.scrollX;
window.scrollTo(0, 0);

var docH = document.documentElement.scrollHeight;
var docW = document.documentElement.scrollWidth;
var vpW = window.innerWidth;
var vpH = window.innerHeight;
var totalH = Math.max(docH, vpH); // single-page means no scrolling needed for the hero

window.scrollTo(scrollX, scrollY);

return {
  viewport: { width: vpW, height: vpH },
  document: { width: docW, height: docH },
  scrollY: scrollY,
  scrollX: scrollX,
  ready: true
};
