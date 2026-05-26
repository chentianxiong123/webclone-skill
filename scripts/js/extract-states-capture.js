// extract-states-capture.js — Read computed styles of a single element by xpath
// Phase B of the state-extraction protocol.
// Replace XPATH_PLACEHOLDER with the target element's xpath (from inventory).
// Run AFTER orchestrator has hover()/focus()/mouseDown()'d the element.
// Returns: { found, styles } — styles match the schema of inventory.baseStyles
// so the orchestrator can diff them to find what changed in the state.
// NOTE: No IIFE wrapper.

var __xp = "XPATH_PLACEHOLDER";
var __res = document.evaluate(__xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
var el = __res.singleNodeValue;
if (!el) return { found: false, xpath: __xp };
var cs = getComputedStyle(el);
return {
  found: true,
  xpath: __xp,
  styles: {
    backgroundColor: cs.backgroundColor, color: cs.color,
    borderColor: cs.borderColor, borderWidth: cs.borderWidth,
    boxShadow: cs.boxShadow, opacity: cs.opacity,
    outline: cs.outline, outlineColor: cs.outlineColor, outlineWidth: cs.outlineWidth,
    transform: cs.transform, filter: cs.filter,
    textDecoration: cs.textDecoration, cursor: cs.cursor,
    fontWeight: cs.fontWeight, fontSize: cs.fontSize
  }
};
