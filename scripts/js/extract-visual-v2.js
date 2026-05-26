// extract-visual-v2.js — Visual extraction with semantic + visual signal fusion
// Returns: { sidebar, buttonCandidates, tables, images, svgIcons, progressBars, statusIndicators, typography, cssCustomProperties, pseudoElements, fonts }
//
// Improvements over extract-visual.js:
//   1. Drops width>80 button filter — uses cursor/role/tag/visual signals
//   2. Captures div-implemented buttons via cursor:pointer + clickable styling
//   3. Preserves SVG outerHTML by default (no 2000-char truncation)
//   4. Captures ::before / ::after pseudo-elements
//   5. Captures @font-face declarations for font-file references
//   6. Larger size budget (200KB) and graceful degradation rather than data loss
//
// NOTE: No IIFE wrapper.

function __classes(el) {
  var c = el.className;
  if (typeof c === 'string') return c.split(/\s+/).filter(Boolean).slice(0, 10);
  if (c && c.baseVal) return c.baseVal.split(/\s+/).filter(Boolean).slice(0, 10);
  return [];
}
function __rectOk(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
function __rect(el) { var r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }
function __pickStyles(cs, keys) { var o = {}; for (var i = 0; i < keys.length; i++) o[keys[i]] = cs[keys[i]]; return o; }

// --- 1. Sidebar ---
var sidebarEl = document.querySelector('aside, nav, [class*="sidebar"], [class*="Sidebar"]');
var sidebar = { items: [], containerRect: null, containerStyles: null };
if (sidebarEl) {
  sidebar.containerRect = __rect(sidebarEl);
  var scs = getComputedStyle(sidebarEl);
  sidebar.containerStyles = __pickStyles(scs, ['width','minWidth','maxWidth','backgroundColor','borderRight','borderLeft','padding','margin','position','top','height','overflow','overflowY','display','flexDirection','gap','zIndex','boxShadow']);
  sidebarEl.querySelectorAll('a, button, [role="button"], [class*="item" i], li').forEach(function (el) {
    if (!__rectOk(el)) return;
    var cs = getComputedStyle(el);
    var svg = el.querySelector('svg');
    sidebar.items.push({
      tag: el.tagName.toLowerCase(), href: el.href || undefined,
      innerText: (el.innerText || '').trim().split('\n')[0],
      rect: __rect(el),
      styles: __pickStyles(cs, ['color','backgroundColor','fontSize','fontWeight','fontFamily','padding','borderRadius','gap','display','alignItems','cursor']),
      svg: svg ? svg.outerHTML : undefined,
      isActive: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.fontWeight === '600' || cs.fontWeight === '700' || /active|selected|current/i.test(el.className || '')
    });
  });
}

// --- 2. Button Candidates (semantic + visual fusion) ---
var __seenBtn = new Set();
var __btnFromTag = Array.from(document.querySelectorAll('button, a[role="button"], [role="button"], input[type="button"], input[type="submit"]'));
// visual candidates: cursor:pointer + has padding + non-transparent bg or border
var __visualBtnPool = Array.from(document.querySelectorAll('div, span, a, li')).filter(function (el) {
  if (__btnFromTag.indexOf(el) !== -1) return false;
  if (!__rectOk(el)) return false;
  var cs = getComputedStyle(el);
  if (cs.cursor !== 'pointer') return false;
  var hasBg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
  var hasBorder = cs.border && cs.border !== '0px none rgb(0, 0, 0)' && cs.borderWidth !== '0px';
  var hasRadius = cs.borderRadius !== '0px';
  var hasPad = cs.padding !== '0px';
  var len = (el.textContent || '').trim().length;
  // require at least two of: bg, border, radius, padding — and short text
  var score = (hasBg ? 1 : 0) + (hasBorder ? 1 : 0) + (hasRadius ? 1 : 0) + (hasPad ? 1 : 0);
  return score >= 2 && len > 0 && len < 60;
});
var buttonCandidates = __btnFromTag.concat(__visualBtnPool).filter(function (el) {
  if (__seenBtn.has(el)) return false; __seenBtn.add(el);
  return __rectOk(el);
}).map(function (el) {
  var cs = getComputedStyle(el);
  return {
    text: (el.innerText || el.textContent || '').trim().slice(0, 80),
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role') || undefined,
    source: __btnFromTag.indexOf(el) !== -1 ? 'semantic' : 'visual',
    rect: __rect(el),
    href: el.href || undefined,
    type: el.getAttribute('type') || undefined,
    styles: __pickStyles(cs, ['backgroundColor','color','border','borderRadius','fontSize','fontWeight','padding','cursor','boxShadow','transition']),
    selector: el.id ? ('#' + el.id) : undefined
  };
});

// --- 3. Tables ---
var tables = Array.from(document.querySelectorAll('table')).map(function (table) {
  var cs = getComputedStyle(table);
  var headers = Array.from(table.querySelectorAll('th')).map(function (th) { var c = getComputedStyle(th); return { text: th.textContent.trim(), styles: __pickStyles(c, ['backgroundColor','padding','fontSize','fontWeight','position','left','right','zIndex','width','borderBottom']) }; });
  var firstRow = table.querySelector('tbody tr');
  var cells = firstRow ? Array.from(firstRow.querySelectorAll('td')).map(function (td) { var c = getComputedStyle(td); return { styles: __pickStyles(c, ['backgroundColor','padding','fontSize','fontWeight','position','left','right','zIndex','width','borderBottom']) }; }) : [];
  return { display: cs.display, tableLayout: cs.tableLayout, borderCollapse: cs.borderCollapse, headers: headers, sampleCells: cells, rowCount: table.querySelectorAll('tbody tr').length };
});

// --- 4. Images ---
var images = Array.from(document.querySelectorAll('img')).filter(function (el) { var r = el.getBoundingClientRect(); return r.width > 5 && r.height > 5; }).map(function (el) {
  var cs = getComputedStyle(el); var pa = el.parentElement; var pcs = pa ? getComputedStyle(pa) : null;
  return { src: el.src, alt: el.alt, srcset: el.srcset || undefined, loading: el.loading || undefined, rect: __rect(el), borderRadius: cs.borderRadius, objectFit: cs.objectFit !== 'fill' ? cs.objectFit : undefined, parentShape: (pcs && (pcs.overflow === 'hidden' || pcs.borderRadius !== '0px')) ? { borderRadius: pcs.borderRadius, overflow: pcs.overflow, width: pcs.width, height: pcs.height } : null };
});

// background-image candidates (often missed)
var bgImages = [];
var __all = document.querySelectorAll('*');
for (var bi = 0; bi < __all.length && bgImages.length < 80; bi++) {
  var bcs = getComputedStyle(__all[bi]);
  if (bcs.backgroundImage && bcs.backgroundImage !== 'none' && /url\(/.test(bcs.backgroundImage)) {
    if (!__rectOk(__all[bi])) continue;
    bgImages.push({ tag: __all[bi].tagName.toLowerCase(), classes: __classes(__all[bi]).slice(0, 3), rect: __rect(__all[bi]), backgroundImage: bcs.backgroundImage.slice(0, 300), backgroundSize: bcs.backgroundSize, backgroundPosition: bcs.backgroundPosition, backgroundRepeat: bcs.backgroundRepeat });
  }
}

// --- 5. SVG icons ---
var svgMap = {}; var svgOrder = [];
Array.from(document.querySelectorAll('svg')).filter(__rectOk).forEach(function (el, idx) {
  var html = el.outerHTML; var hash = html.length + '|' + html.slice(0, 200);
  if (!svgMap[hash]) { svgMap[hash] = { outerHTML: html, viewBox: el.getAttribute('viewBox'), instances: [] }; svgOrder.push(hash); }
  var pa = el.closest('a, button, [role="button"], li, div');
  svgMap[hash].instances.push({ idx: idx, rect: __rect(el), parentSelector: pa ? (pa.className || pa.tagName) : 'unknown', parentText: pa ? pa.textContent.trim().slice(0, 50) : '' });
});
var svgIcons = svgOrder.map(function (h) { return svgMap[h]; });

// --- 6. Progress bars / Status indicators (kept from v1) ---
var progressBars = Array.from(document.querySelectorAll('progress, meter, [role="progressbar"], [class*="progress" i], [class*="bar-fill" i]')).filter(__rectOk).map(function (el) {
  var cs = getComputedStyle(el); var pa = el.parentElement; var pcs = pa ? getComputedStyle(pa) : null;
  return { tag: el.tagName.toLowerCase(), classes: __classes(el).slice(0, 5), rect: __rect(el), value: el.getAttribute('value') || el.getAttribute('aria-valuenow'), max: el.getAttribute('max') || el.getAttribute('aria-valuemax'), styles: __pickStyles(cs, ['backgroundColor','borderRadius','height','width']), parentStyles: pcs ? __pickStyles(pcs, ['backgroundColor','borderRadius','height','width','overflow']) : null };
});
var statusIndicators = Array.from(document.querySelectorAll('[class*="status" i], [class*="badge" i], [class*="chip" i], [class*="tag" i]')).filter(function (el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.width < 240; }).map(function (el) {
  var cs = getComputedStyle(el); var bf = getComputedStyle(el, '::before');
  return { tag: el.tagName.toLowerCase(), text: el.textContent.trim().slice(0, 50), rect: __rect(el), styles: __pickStyles(cs, ['backgroundColor','color','borderRadius','border','fontSize','fontWeight','padding','display','gap']), pseudoBefore: bf.content !== 'none' && bf.content !== 'normal' ? { content: bf.content, backgroundColor: bf.backgroundColor, width: bf.width, height: bf.height, borderRadius: bf.borderRadius } : undefined };
});

// --- 7. Pseudo-elements (::before / ::after with content) ---
var pseudoElements = [];
for (var pi = 0; pi < __all.length && pseudoElements.length < 60; pi++) {
  var pe = __all[pi];
  if (!__rectOk(pe)) continue;
  ['::before', '::after'].forEach(function (which) {
    var ps = getComputedStyle(pe, which);
    if (ps.content && ps.content !== 'none' && ps.content !== 'normal' && ps.content !== '""') {
      pseudoElements.push({ tag: pe.tagName.toLowerCase(), id: pe.id || undefined, classes: __classes(pe).slice(0, 3), pseudo: which, content: ps.content, color: ps.color, backgroundColor: ps.backgroundColor !== 'rgba(0, 0, 0, 0)' ? ps.backgroundColor : undefined, fontSize: ps.fontSize, fontWeight: ps.fontWeight, position: ps.position !== 'static' ? ps.position : undefined, top: ps.top, left: ps.left, transform: ps.transform !== 'none' ? ps.transform : undefined, width: ps.width, height: ps.height, borderRadius: ps.borderRadius !== '0px' ? ps.borderRadius : undefined });
    }
  });
}

// --- 8. CSS Custom Properties + @font-face ---
var cssCustomProperties = {};
var fontFaces = [];
try {
  for (var s = 0; s < document.styleSheets.length; s++) {
    try {
      var rules = document.styleSheets[s].cssRules || document.styleSheets[s].rules;
      if (!rules) continue;
      for (var r = 0; r < rules.length; r++) {
        var rule = rules[r];
        if (rule.type === 1 && (rule.selectorText === ':root' || rule.selectorText === ':root, :host')) {
          for (var p = 0; p < rule.style.length; p++) { var prop = rule.style[p]; if (prop.startsWith('--')) cssCustomProperties[prop] = rule.style.getPropertyValue(prop).trim(); }
        }
        if (rule.type === 5 /* CSSRule.FONT_FACE_RULE */) {
          fontFaces.push({ family: rule.style.getPropertyValue('font-family'), src: rule.style.getPropertyValue('src'), weight: rule.style.getPropertyValue('font-weight'), style: rule.style.getPropertyValue('font-style'), display: rule.style.getPropertyValue('font-display') });
        }
      }
    } catch (e) { /* cross-origin sheet */ }
  }
} catch (e) { /* skip */ }

// Computed root vars
var rs = getComputedStyle(document.documentElement);
['--color-primary','--color-secondary','--color-accent','--color-background','--color-surface','--color-text','--color-border','--font-family','--font-size','--spacing','--radius','--shadow'].forEach(function (pre) { for (var i = 0; i <= 9; i++) { var n = i === 0 ? pre : pre + '-' + i; var v = rs.getPropertyValue(n).trim(); if (v && !cssCustomProperties[n]) cssCustomProperties[n] = v; } });

// --- 9. Typography + color palette ---
var fontsSet = new Set(); var typeScale = []; var seen = new Set();
document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,span,li,td,th,label,button,input,div').forEach(function (el) {
  if (!__rectOk(el)) return;
  var cs = getComputedStyle(el); fontsSet.add(cs.fontFamily);
  var key = cs.fontSize + '|' + cs.fontWeight + '|' + cs.lineHeight + '|' + cs.fontFamily;
  if (!seen.has(key) && el.textContent.trim().length > 0) {
    seen.add(key);
    typeScale.push({ tag: el.tagName.toLowerCase(), sample: el.textContent.trim().slice(0, 40), fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing, fontFamily: cs.fontFamily, color: cs.color });
  }
});
var colors = new Map();
__all.forEach(function (el) { var cs = getComputedStyle(el); [cs.color, cs.backgroundColor, cs.borderColor].forEach(function (c) { if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') colors.set(c, (colors.get(c) || 0) + 1); }); });

return {
  sidebar: sidebar,
  buttonCandidates: buttonCandidates,
  tables: tables,
  images: images,
  bgImages: bgImages,
  svgIcons: svgIcons,
  progressBars: progressBars,
  statusIndicators: statusIndicators,
  pseudoElements: pseudoElements,
  cssCustomProperties: cssCustomProperties,
  fontFaces: fontFaces,
  typography: { fontFamilies: Array.from(fontsSet), typeScale: typeScale.sort(function (a, b) { return parseFloat(b.fontSize) - parseFloat(a.fontSize); }).slice(0, 30), colorPalette: Array.from(colors.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 40).map(function (e) { return { color: e[0], count: e[1] }; }) }
};
