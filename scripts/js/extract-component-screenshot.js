// extract-component-screenshot.js — Crop a component from the full-page screenshot
// Input: COMPONENT_SELECTOR (CSS selector), COMPONENT_LABEL (string), OUTPUT_PATH (string)
// The Python orchestrator already has the full-page screenshot at OUTPUT_PATH.
// This script reads the screenshot file and crops to the component's bounding rect.
// NOTE: No IIFE wrapper. Run as: extractComponentScreenshot(selector, label, outputPath)

function extractComponentScreenshot(selector, label, outputPath) {
  var el = document.querySelector(selector);
  if (!el) return { error: 'Element not found', selector: selector };

  var rects = el.getClientRects();
  if (!rects || rects.length === 0) return { error: 'No client rects', selector: selector };

  // Use the bounding rect (union of all client rects)
  var bb = rects[0];
  var minX = bb.left, minY = bb.top, maxX = bb.right, maxY = bb.bottom;
  for (var i = 1; i < rects.length; i++) {
    minX = Math.min(minX, rects[i].left);
    minY = Math.min(minY, rects[i].top);
    maxX = Math.max(maxX, rects[i].right);
    maxY = Math.max(maxY, rects[i].bottom);
  }

  return {
    selector: selector,
    label: label,
    cropRect: {
      x: Math.round(minX),
      y: Math.round(minY),
      width: Math.round(maxX - minX),
      height: Math.round(maxY - minY)
    },
    textContent: (el.textContent || '').trim().slice(0, 80),
    childCount: el.children.length
  };
}

// If called without arguments (as a script body), just return metadata for all mapped components
function extractAllComponents(components) {
  return components.map(function(c) {
    var dom = c.dom || {};
    var sel = dom.selector || dom.tag;
    if (!sel || sel === 'NO_DOM_MATCH') return { label: c.label, type_hint: c.type_hint, error: 'no dom selector' };
    var el = document.querySelector(sel);
    if (!el) return { label: c.label, type_hint: c.type_hint, error: 'element not found' };
    var r = el.getBoundingClientRect();
    if (!r || r.width === 0) return { label: c.label, type_hint: c.type_hint, error: 'zero-size rect' };
    return {
      label: c.label,
      type_hint: c.type_hint,
      selector: sel,
      cropRect: { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
      textContent: (el.textContent || '').trim().slice(0, 80),
      childCount: el.children.length,
      domStyles: dom.styles || {}
    };
  });
}

// Export for explicit calls
this.extractComponentScreenshot = extractComponentScreenshot;
this.extractAllComponents = extractAllComponents;

// Auto-run if called with COMPONENTS_PLACEHOLDER
if (typeof window !== 'undefined' && window.VCOMPONENTS && typeof window.VCOMPONENTS === 'object') {
  return extractAllComponents(window.VCOMPONENTS);
}