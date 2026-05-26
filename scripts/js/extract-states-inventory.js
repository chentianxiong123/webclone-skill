// extract-states-inventory.js — List interactive candidates for state capture
// Phase A of the state-extraction protocol.
// Returns a list of { selector, role, tag, baseStyles } for elements that are
// likely to have hover/focus/active state styles.
//
// Phase B (in extractor.py): for each candidate, page.hover() / page.focus() /
// dispatch mousedown, then page.evaluate(extract-states-capture.js) with the
// element's xpath to read post-state computed styles, then diff vs baseStyles.
// NOTE: No IIFE wrapper.

function __classes(el) { var c = el.className; if (typeof c === 'string') return c.split(/\s+/).filter(Boolean).slice(0, 5); if (c && c.baseVal) return c.baseVal.split(/\s+/).filter(Boolean).slice(0, 5); return []; }
function __rectOk(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
function __rect(el) { var r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }

function __xpath(el) {
  if (el.id) return '//*[@id="' + el.id + '"]';
  var parts = [];
  var cur = el;
  while (cur && cur.nodeType === 1 && cur !== document.body && parts.length < 12) {
    var i = 0; var sib = cur.previousElementSibling;
    while (sib) { if (sib.tagName === cur.tagName) i++; sib = sib.previousElementSibling; }
    parts.unshift(cur.tagName.toLowerCase() + '[' + (i + 1) + ']');
    cur = cur.parentElement;
  }
  return '/html/body/' + parts.join('/');
}

function __cssSelector(el) {
  if (el.id) return '#' + CSS.escape(el.id);
  var parts = []; var cur = el; var depth = 0;
  while (cur && cur.nodeType === 1 && cur !== document.body && depth < 6) {
    var p = cur.tagName.toLowerCase();
    var c = __classes(cur).slice(0, 2).map(function (x) { return '.' + CSS.escape(x); }).join('');
    if (c) p += c;
    if (cur.parentElement) {
      var sibs = Array.from(cur.parentElement.children).filter(function (n) { return n.tagName === cur.tagName; });
      if (sibs.length > 1) p += ':nth-of-type(' + (sibs.indexOf(cur) + 1) + ')';
    }
    parts.unshift(p); cur = cur.parentElement; depth++;
  }
  return 'body > ' + parts.join(' > ');
}

function __baseStyles(el) {
  var cs = getComputedStyle(el);
  return {
    backgroundColor: cs.backgroundColor, color: cs.color,
    borderColor: cs.borderColor, borderWidth: cs.borderWidth,
    boxShadow: cs.boxShadow, opacity: cs.opacity,
    outline: cs.outline, outlineColor: cs.outlineColor, outlineWidth: cs.outlineWidth,
    transform: cs.transform, filter: cs.filter,
    textDecoration: cs.textDecoration, cursor: cs.cursor,
    fontWeight: cs.fontWeight, fontSize: cs.fontSize
  };
}

var SELECTORS = [
  'a[href]', 'button', '[role="button"]', '[role="tab"]', '[role="menuitem"]',
  'input', 'textarea', 'select', '[role="combobox"]',
  'summary', '[tabindex]:not([tabindex="-1"])'
];

var seen = new Set();
var candidates = [];
SELECTORS.forEach(function (s) {
  document.querySelectorAll(s).forEach(function (el) {
    if (seen.has(el)) return; seen.add(el);
    if (!__rectOk(el)) return;
    candidates.push({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || undefined,
      type: el.getAttribute('type') || undefined,
      text: (el.innerText || el.textContent || '').trim().slice(0, 60),
      cssSelector: __cssSelector(el),
      xpath: __xpath(el),
      rect: __rect(el),
      baseStyles: __baseStyles(el)
    });
  });
});

// Cap to keep payload manageable; Python orchestrator selects a sample
return { candidates: candidates.slice(0, 200), totalFound: candidates.length };
