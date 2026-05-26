// extract-structure-v2.js — Multi-coordinate, deep-traversal structure extraction
// Returns: { structure, contentInventory, textNodes, fixedElements, scrollState, _stats }
//
// Improvements over extract-structure.js:
//   1. Multi coord system: viewport / document / relative-to-parent
//   2. Records position, top/right/bottom/left, zIndex, transform, containingBlock
//   3. Configurable maxDepth (default 10, was 3)
//   4. No textNodes truncation (caller decides via OPTIONS_PLACEHOLDER.maxTextNodes)
//   5. Captures stacking-context creators and fixed/sticky elements separately
//   6. Records full element bounding rects via getClientRects() to handle transform
//
// Usage: replace OPTIONS_PLACEHOLDER with a JSON options object.
// Default if literal "OPTIONS_PLACEHOLDER" is left in: maxDepth 10, all options on.
// NOTE: No IIFE wrapper — Playwright wraps in () => { ... } automatically.

var __raw = OPTIONS_PLACEHOLDER;
var OPTS = (__raw && typeof __raw === 'object') ? __raw : {};
var MAX_DEPTH = OPTS.maxDepth != null ? OPTS.maxDepth : 10;
var MAX_TEXT_NODES = OPTS.maxTextNodes != null ? OPTS.maxTextNodes : 0; // 0 = unlimited
var INCLUDE_HIDDEN = !!OPTS.includeHidden;
var COLLECT_FIXED = OPTS.collectFixed !== false;

var __stats = { totalEls: 0, kept: 0, skippedHidden: 0, truncatedAtDepth: 0, maxDepthReached: 0 };

function __classes(el) {
  var c = el.className;
  if (typeof c === 'string') return c.split(/\s+/).filter(Boolean).slice(0, 10);
  if (c && c.baseVal) return c.baseVal.split(/\s+/).filter(Boolean).slice(0, 10);
  return [];
}

function __createsStackingContext(cs) {
  return (
    (cs.position !== 'static' && cs.zIndex !== 'auto') ||
    cs.position === 'fixed' || cs.position === 'sticky' ||
    parseFloat(cs.opacity) < 1 ||
    cs.transform !== 'none' ||
    cs.filter !== 'none' ||
    cs.willChange === 'transform' || cs.willChange === 'opacity' ||
    cs.isolation === 'isolate' ||
    cs.mixBlendMode !== 'normal' ||
    (cs.contain && /paint|layout|strict|content/.test(cs.contain))
  );
}

function __containingBlock(el) {
  var p = el.parentElement;
  while (p) {
    var cs = getComputedStyle(p);
    if (cs.position !== 'static' || cs.transform !== 'none' ||
        cs.willChange === 'transform' || cs.filter !== 'none') {
      return {
        tag: p.tagName.toLowerCase(),
        id: p.id || undefined,
        classes: __classes(p).slice(0, 3),
        position: cs.position
      };
    }
    p = p.parentElement;
  }
  return null;
}

function __coords(el, rect, cs) {
  var pr = el.parentElement ? el.parentElement.getBoundingClientRect() : null;
  // visual bounds — accounts for transform / multi-line inlines
  var visualBounds = null;
  if (cs.transform !== 'none') {
    var crs = el.getClientRects();
    if (crs.length > 0) {
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (var i = 0; i < crs.length; i++) {
        var r = crs[i];
        if (r.left < minX) minX = r.left;
        if (r.top < minY) minY = r.top;
        if (r.right > maxX) maxX = r.right;
        if (r.bottom > maxY) maxY = r.bottom;
      }
      visualBounds = { x: Math.round(minX), y: Math.round(minY), w: Math.round(maxX - minX), h: Math.round(maxY - minY) };
    }
  }
  return {
    viewport: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
    document: { x: Math.round(rect.x + window.scrollX), y: Math.round(rect.y + window.scrollY), w: Math.round(rect.width), h: Math.round(rect.height) },
    relative: pr ? { x: Math.round(rect.x - pr.x), y: Math.round(rect.y - pr.y), w: Math.round(rect.width), h: Math.round(rect.height) } : null,
    visual: visualBounds
  };
}

function __positioning(el, cs) {
  return {
    position: cs.position,
    top: cs.top !== 'auto' ? cs.top : undefined,
    right: cs.right !== 'auto' ? cs.right : undefined,
    bottom: cs.bottom !== 'auto' ? cs.bottom : undefined,
    left: cs.left !== 'auto' ? cs.left : undefined,
    zIndex: cs.zIndex !== 'auto' ? cs.zIndex : undefined,
    transform: cs.transform !== 'none' ? cs.transform : undefined,
    transformOrigin: cs.transform !== 'none' ? cs.transformOrigin : undefined,
    stackingContext: __createsStackingContext(cs) || undefined,
    containingBlock: __containingBlock(el)
  };
}

function __extract(el, depth) {
  __stats.totalEls++;
  if (depth > MAX_DEPTH) {
    __stats.truncatedAtDepth++;
    return { tag: el.tagName.toLowerCase(), _truncated: true, childCount: el.children.length };
  }
  if (depth > __stats.maxDepthReached) __stats.maxDepthReached = depth;
  var rect = el.getBoundingClientRect();
  var cs = getComputedStyle(el);
  var visible = !(rect.width === 0 && rect.height === 0) && cs.display !== 'none' && cs.visibility !== 'hidden';
  if (!visible && !INCLUDE_HIDDEN) { __stats.skippedHidden++; return null; }
  __stats.kept++;
  var children = [];
  for (var i = 0; i < el.children.length; i++) {
    var c = __extract(el.children[i], depth + 1);
    if (c) children.push(c);
  }
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || undefined,
    classes: __classes(el),
    coords: __coords(el, rect, cs),
    positioning: __positioning(el, cs),
    styles: {
      display: cs.display,
      flexDirection: cs.flexDirection !== 'row' ? cs.flexDirection : undefined,
      justifyContent: cs.justifyContent !== 'normal' ? cs.justifyContent : undefined,
      alignItems: cs.alignItems !== 'normal' ? cs.alignItems : undefined,
      gap: cs.gap !== 'normal' ? cs.gap : undefined,
      margin: cs.margin !== '0px' ? cs.margin : undefined,
      padding: cs.padding !== '0px' ? cs.padding : undefined,
      backgroundColor: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : undefined,
      color: cs.color,
      border: (cs.border && cs.border !== '0px none rgb(0, 0, 0)') ? cs.border : undefined,
      borderRadius: cs.borderRadius !== '0px' ? cs.borderRadius : undefined,
      boxShadow: cs.boxShadow !== 'none' ? cs.boxShadow : undefined,
      overflow: cs.overflow !== 'visible' ? cs.overflow : undefined,
      cursor: cs.cursor !== 'auto' ? cs.cursor : undefined,
      transition: cs.transition !== 'all 0s ease 0s' ? cs.transition : undefined
    },
    childCount: el.children.length,
    children: children
  };
}

window.scrollTo(0, 0); // normalize coords to top-of-page baseline
var __scrollBefore = { x: window.scrollX, y: window.scrollY };
var structure = __extract(document.body, 0);

// Hierarchy path of the body's first leaf — useful for build phase root selection
var contentInventory = {
  tabGroups: Array.from(document.querySelectorAll('[role="tablist"], [data-tab-group]')).map(function (g) {
    return { tabCount: g.querySelectorAll('[role="tab"], [data-tab]').length, labels: Array.from(g.querySelectorAll('[role="tab"], [data-tab]')).map(function (t) { return t.textContent.trim(); }) };
  }),
  hiddenPanels: document.querySelectorAll('[hidden], [aria-hidden="true"], [style*="display: none"]').length,
  dropdowns: Array.from(document.querySelectorAll('[data-dropdown], [aria-haspopup], select')).map(function (d) { return { text: d.textContent.trim().slice(0, 30), optionCount: d.querySelectorAll('option, [role="option"], li').length }; }),
  forms: document.querySelectorAll('form, [role="form"]').length,
  scrollableRegions: Array.from(document.querySelectorAll('*')).filter(function (el) { var cs = getComputedStyle(el); return cs.overflow === 'auto' || cs.overflow === 'scroll' || cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowY === 'auto' || cs.overflowY === 'scroll'; }).length,
  iframes: document.querySelectorAll('iframe').length,
  videos: document.querySelectorAll('video').length
};

var textNodes = [];
var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: function (node) {
  if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
  var range = document.createRange(); range.selectNodeContents(node);
  var r = range.getBoundingClientRect();
  if (r.width > 0 && r.height > 0) return NodeFilter.FILTER_ACCEPT;
  return NodeFilter.FILTER_REJECT;
} });
while (walker.nextNode()) {
  if (MAX_TEXT_NODES > 0 && textNodes.length >= MAX_TEXT_NODES) break;
  var n = walker.currentNode;
  var rg = document.createRange(); rg.selectNodeContents(n);
  var rb = rg.getBoundingClientRect();
  var pa = n.parentElement; var cs2 = pa ? getComputedStyle(pa) : null;
  textNodes.push({
    text: n.textContent.trim(),
    coords: { viewport: { x: Math.round(rb.x), y: Math.round(rb.y), w: Math.round(rb.width), h: Math.round(rb.height) }, document: { x: Math.round(rb.x + window.scrollX), y: Math.round(rb.y + window.scrollY), w: Math.round(rb.width), h: Math.round(rb.height) } },
    parentTag: pa ? pa.tagName.toLowerCase() : undefined,
    parentId: pa && pa.id ? pa.id : undefined,
    parentClasses: pa ? __classes(pa).slice(0, 3) : [],
    fontSize: cs2 ? cs2.fontSize : undefined,
    fontWeight: cs2 ? cs2.fontWeight : undefined,
    color: cs2 ? cs2.color : undefined,
    lineHeight: cs2 ? cs2.lineHeight : undefined,
    letterSpacing: cs2 ? cs2.letterSpacing : undefined,
    fontFamily: cs2 ? cs2.fontFamily : undefined
  });
}

var fixedElements = [];
if (COLLECT_FIXED) {
  var all = document.querySelectorAll('*');
  for (var k = 0; k < all.length; k++) {
    var fcs = getComputedStyle(all[k]);
    if (fcs.position === 'fixed' || fcs.position === 'sticky') {
      var fr = all[k].getBoundingClientRect();
      if (fr.width === 0 && fr.height === 0) continue;
      fixedElements.push({
        tag: all[k].tagName.toLowerCase(), id: all[k].id || undefined, classes: __classes(all[k]).slice(0, 5),
        position: fcs.position,
        viewport: { x: Math.round(fr.x), y: Math.round(fr.y), w: Math.round(fr.width), h: Math.round(fr.height) },
        css: { top: fcs.top, right: fcs.right, bottom: fcs.bottom, left: fcs.left, zIndex: fcs.zIndex }
      });
    }
  }
}

return {
  structure: structure,
  contentInventory: contentInventory,
  textNodes: textNodes,
  fixedElements: fixedElements,
  scrollState: { docHeight: document.documentElement.scrollHeight, docWidth: document.documentElement.scrollWidth, viewportW: window.innerWidth, viewportH: window.innerHeight, scrollBefore: __scrollBefore },
  _stats: __stats,
  _options: { maxDepth: MAX_DEPTH, maxTextNodes: MAX_TEXT_NODES, includeHidden: INCLUDE_HIDDEN, collectFixed: COLLECT_FIXED }
};
