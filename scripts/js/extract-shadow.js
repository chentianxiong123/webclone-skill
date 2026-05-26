// extract-shadow.js — Pierce open shadow roots and report internals
// Returns: { hosts: [{ tag, classes, rect, shadowRoot: { rules, structure, textNodes } }], totalHosts }
// Closed shadow roots are inaccessible from JS — use CDP DOM.getNodeForLocation
// or DOM.describeNode on backendNodeIds for those.
// NOTE: No IIFE wrapper.

function __classes(el) {
  var c = el.className;
  if (typeof c === 'string') return c.split(/\s+/).filter(Boolean).slice(0, 5);
  if (c && c.baseVal) return c.baseVal.split(/\s+/).filter(Boolean).slice(0, 5);
  return [];
}
function __rect(el) { var r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }

function findHosts(root, acc, depth) {
  if (depth > 8) return;
  var all = root.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    if (el.shadowRoot) {
      acc.push(el);
      findHosts(el.shadowRoot, acc, depth + 1);
    }
  }
}

function describeShadow(sh, host) {
  // structure (3 levels deep, mirroring extract-structure-v2 lite)
  function describe(n, d) {
    if (d > 4) return null;
    if (n.nodeType !== 1) return null;
    var r = n.getBoundingClientRect ? n.getBoundingClientRect() : null;
    var cs = r ? getComputedStyle(n) : null;
    return {
      tag: n.tagName.toLowerCase(),
      id: n.id || undefined,
      classes: __classes(n),
      rect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
      backgroundColor: cs && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : undefined,
      color: cs ? cs.color : undefined,
      childCount: n.children.length,
      children: Array.from(n.children).map(function (c) { return describe(c, d + 1); }).filter(Boolean)
    };
  }
  // text nodes
  var textNodes = [];
  var walker = document.createTreeWalker(sh, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } });
  while (walker.nextNode() && textNodes.length < 200) {
    var tn = walker.currentNode;
    var pa = tn.parentElement;
    var cs = pa ? getComputedStyle(pa) : null;
    textNodes.push({ text: tn.textContent.trim().slice(0, 200), parentTag: pa ? pa.tagName.toLowerCase() : null, fontSize: cs ? cs.fontSize : null, color: cs ? cs.color : null });
  }
  // adopted stylesheets / inline <style>
  var styles = [];
  if (sh.adoptedStyleSheets && sh.adoptedStyleSheets.length) {
    sh.adoptedStyleSheets.forEach(function (st, i) {
      try { styles.push({ kind: 'adopted', index: i, ruleCount: st.cssRules.length, cssText: Array.from(st.cssRules).map(function (r) { return r.cssText; }).join('\n').slice(0, 8000) }); } catch (e) {}
    });
  }
  Array.from(sh.querySelectorAll('style')).forEach(function (st, i) { styles.push({ kind: 'inline', index: i, cssText: st.textContent.slice(0, 8000) }); });

  return { structure: describe(sh.host || sh, 0), styles: styles, textNodes: textNodes };
}

var hosts = [];
findHosts(document, hosts, 0);

var out = hosts.slice(0, 50).map(function (h) {
  var sh = h.shadowRoot;
  return {
    tag: h.tagName.toLowerCase(),
    id: h.id || undefined,
    classes: __classes(h),
    rect: __rect(h),
    mode: sh.mode,
    shadow: describeShadow(sh, h)
  };
});

return { hosts: out, totalHosts: hosts.length };
