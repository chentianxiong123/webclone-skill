// extract-links.js — Extract all anchor hrefs with metadata
// No IIFE wrapper — call extractAllLinks() directly.
// Used by linked-pages-recorder.py to build navigation structure.

function extractAllLinks() {
  var anchors = Array.from(document.querySelectorAll('a[href]'));
  var results = [];

  for (var i = 0; i < anchors.length; i++) {
    var el = anchors[i];
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue; // invisible

    var href = el.href || '';
    var text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120);

    // Class list
    var cn = el.className;
    var classes = typeof cn === 'string' ? cn.trim().split(/\s+/).filter(Boolean).slice(0, 5) : [];

    // Outer HTML (up to 200 chars for context)
    var outer = el.outerHTML;
    if (outer.length > 200) outer = outer.slice(0, 200) + '...';

    // Protocol + domain classification
    var protocol = '';
    if (/^https?:\/\//.test(href)) protocol = 'http';
    else if (/^\/\//.test(href)) protocol = 'protocol-relative';
    else if (/^#/.test(href)) protocol = 'hash';
    else if (/^mailto:/.test(href)) protocol = 'mailto';
    else if (/^tel:/.test(href)) protocol = 'tel';
    else if (/^javascript:/.test(href)) protocol = 'javascript';
    else protocol = 'relative';

    // Find the nearest clickable parent (for context)
    var parent = el.parentElement;
    var parentSelector = '';
    while (parent && parent !== document.body) {
      var ptag = parent.tagName.toLowerCase();
      var pid = parent.id ? '#' + parent.id : '';
      var pcn = typeof parent.className === 'string' ? parent.className.trim().split(/\s+/)[0] : '';
      parentSelector = ptag + pid + (pcn ? '.' + pcn : '');
      if (parent.tagName === 'NAV' || parent.tagName === 'HEADER' || parent.tagName === 'MAIN' ||
          parent.hasAttribute('role') || /nav|menu|toolbar|tab/i.test(parent.className || '')) {
        break;
      }
      parent = parent.parentElement;
    }

    // SPA internal link detection: same-origin links (not hash anchors, not external)
    var isSpaInternal = false;
    if (protocol === 'relative') {
      // Relative paths like /page or ./page — SPA routing
      isSpaInternal = true;
    } else if (protocol === 'http') {
      // Same-origin http links are SPA internal navigation
      try {
        var linkUrl = new URL(href);
        isSpaInternal = linkUrl.origin === window.location.origin;
      } catch (e) {
        isSpaInternal = false;
      }
    }

    results.push({
      index: i,
      href: href,
      text: text,
      tag: 'a',
      classes: classes,
      id: el.id || undefined,
      protocol: protocol,
      target: el.target || undefined,
      rel: el.rel ? Array.from(el.rel) : undefined,
      rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
      parentSelector: parentSelector || undefined,
      outerHTML: outer,
      // aria attributes for accessibility classification
      ariaLabel: el.getAttribute('aria-label') || undefined,
      role: el.getAttribute('role') || undefined,
      // Is this link in a nav element?
      inNav: !!el.closest('nav'),
      // Is it in the header?
      inHeader: !!el.closest('header'),
      // Is this an SPA internal navigation link (use <router-link> in Vue)?
      isSpaInternal: isSpaInternal,
    });
  }

  return {
    total: results.length,
    links: results,
    // Summary stats
    summary: {
      http: results.filter(function(l) { return l.protocol === 'http'; }).length,
      hash: results.filter(function(l) { return l.protocol === 'hash'; }).length,
      relative: results.filter(function(l) { return l.protocol === 'relative'; }).length,
      mailto: results.filter(function(l) { return l.protocol === 'mailto'; }).length,
      tel: results.filter(function(l) { return l.protocol === 'tel'; }).length,
      inNav: results.filter(function(l) { return l.inNav; }).length,
      inHeader: results.filter(function(l) { return l.inHeader; }).length,
      spaInternal: results.filter(function(l) { return l.isSpaInternal; }).length
    }
  };
}

// Auto-run if called as script body (no args)
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  return extractAllLinks();
}