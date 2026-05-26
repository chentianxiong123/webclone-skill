# Extraction Reference 鈥?Inline JavaScript Reference (v0.2.0 legacy)

This file contains the extraction JavaScript that was previously inline in SKILL.md (v0.2.0).
This file is a reference for the inline JS patterns used by the v2 scripts in scripts/js/. Prefer running `python scripts/extractor.py` directly.

**When to use this file:**
1. Run `Glob` for `**/scripts/extract-structure.js`
2. If Glob returns no results, read THIS file and use the inline JS below
3. Execute each section as a separate Playwright evaluate call

---

## Structure Map (3 levels deep)

```js
(function() {
  function extract(el, depth) {
    if (depth > 3) return null;
    var rect = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    if (rect.width === 0 && rect.height === 0) return null;
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      classes: el.className && typeof el.className === 'string'
        ? el.className.split(/\s+/).filter(Boolean).slice(0, 5)
        : [],
      rect: { x: Math.round(rect.x), y: Math.round(rect.y),
              w: Math.round(rect.width), h: Math.round(rect.height) },
      display: cs.display,
      position: cs.position,
      margin: cs.margin, padding: cs.padding,
      gap: cs.gap, rowGap: cs.rowGap, columnGap: cs.columnGap,
      transition: cs.transition !== 'all 0s ease 0s' ? cs.transition : undefined,
      childCount: el.children.length,
      children: Array.from(el.children).map(function(c) { return extract(c, depth + 1); }).filter(Boolean)
    };
  }
  return extract(document.body, 0);
})()
```

## Content Inventory

```js
(function() {
  var inventory = {
    tabGroups: Array.from(document.querySelectorAll('[role="tablist"], [data-tab-group]')).map(function(g) {
      return {
        tabCount: g.querySelectorAll('[role="tab"], [data-tab]').length,
        labels: Array.from(g.querySelectorAll('[role="tab"], [data-tab]')).map(function(t) { return t.textContent.trim(); })
      };
    }),
    hiddenPanels: document.querySelectorAll('[hidden], [aria-hidden="true"], [style*="display: none"]').length,
    dropdowns: Array.from(document.querySelectorAll('[data-dropdown], [aria-haspopup], select')).map(function(d) {
      return {
        text: d.textContent.trim().slice(0, 30),
        optionCount: d.querySelectorAll('option, [role="option"], li').length
      };
    }),
    forms: document.querySelectorAll('form, [role="form"]').length,
    scrollableRegions: Array.from(document.querySelectorAll('[style*="overflow"], table')).length
  };
  return inventory;
})()
```

## TreeWalker Text Extraction

Adjust BOUNDS per page region:

```js
(function() {
  var BOUNDS = { xMin: 0, xMax: 1920, yMin: 0, yMax: 5000 };
  var items = [];
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: function(node) {
      if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
      var range = document.createRange();
      range.selectNodeContents(node);
      var r = range.getBoundingClientRect();
      if (r.x >= BOUNDS.xMin && r.x <= BOUNDS.xMax &&
          r.y >= BOUNDS.yMin && r.y <= BOUNDS.yMax && r.width > 0) {
        return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_REJECT;
    }
  });

  while (walker.nextNode()) {
    var node = walker.currentNode;
    var range = document.createRange();
    range.selectNodeContents(node);
    var r = range.getBoundingClientRect();
    var parent = node.parentElement;
    var cs = parent ? getComputedStyle(parent) : null;
    items.push({
      text: node.textContent.trim(),
      rect: { x: Math.round(r.x), y: Math.round(r.y),
              w: Math.round(r.width), h: Math.round(r.height) },
      parentTag: parent ? parent.tagName.toLowerCase() : undefined,
      fontSize: cs ? cs.fontSize : undefined,
      fontWeight: cs ? cs.fontWeight : undefined,
      color: cs ? cs.color : undefined,
      lineHeight: cs ? cs.lineHeight : undefined,
      letterSpacing: cs ? cs.letterSpacing : undefined
    });
  }
  return items;
})()
```

## Sidebar / Navigation Items

```js
(function() {
  var sidebar = document.querySelector('aside, nav, [class*="sidebar"], [class*="Sidebar"]');
  if (!sidebar) return { error: 'No sidebar found' };
  var items = [];
  sidebar.querySelectorAll('a, button, [role="button"]').forEach(function(el) {
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    var cs = getComputedStyle(el);
    var svg = el.querySelector('svg');
    items.push({
      tag: el.tagName.toLowerCase(),
      href: el.href || undefined,
      innerText: el.innerText.trim().split('\n')[0],
      rect: { x: Math.round(rect.x), y: Math.round(rect.y),
              w: Math.round(rect.width), h: Math.round(rect.height) },
      styles: {
        color: cs.color, backgroundColor: cs.backgroundColor,
        fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        fontFamily: cs.fontFamily, padding: cs.padding,
        borderRadius: cs.borderRadius, gap: cs.gap,
        display: cs.display, alignItems: cs.alignItems
      },
      svg: svg ? svg.outerHTML.slice(0, 1500) : undefined,
      isActive: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
                cs.fontWeight === '600' || cs.fontWeight === '700'
    });
  });
  return { containerRect: sidebar.getBoundingClientRect(), items: items };
})()
```

## Buttons and CTAs

```js
(function() {
  return Array.from(document.querySelectorAll('a[role="button"], button'))
    .filter(function(el) { return el.getBoundingClientRect().width > 80; })
    .map(function(el) {
      var r = el.getBoundingClientRect();
      var cs = getComputedStyle(el);
      return {
        text: el.innerText.trim(),
        rect: { x: Math.round(r.x), y: Math.round(r.y),
                w: Math.round(r.width), h: Math.round(r.height) },
        backgroundColor: cs.backgroundColor, color: cs.color,
        border: cs.border, borderRadius: cs.borderRadius,
        fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        padding: cs.padding, href: el.href || undefined
      };
    });
})()
```

## Tables

```js
(function() {
  return Array.from(document.querySelectorAll('table')).map(function(table) {
    var cs = getComputedStyle(table);
    var headers = Array.from(table.querySelectorAll('th')).map(function(th) {
      var thCs = getComputedStyle(th);
      return {
        text: th.textContent.trim(),
        backgroundColor: thCs.backgroundColor, padding: thCs.padding,
        fontSize: thCs.fontSize, fontWeight: thCs.fontWeight,
        position: thCs.position, left: thCs.left, right: thCs.right,
        zIndex: thCs.zIndex, width: thCs.width, borderBottom: thCs.borderBottom
      };
    });
    var firstRow = table.querySelector('tbody tr');
    var cells = firstRow ? Array.from(firstRow.querySelectorAll('td')).map(function(td) {
      var tdCs = getComputedStyle(td);
      return {
        backgroundColor: tdCs.backgroundColor, padding: tdCs.padding,
        fontSize: tdCs.fontSize, fontWeight: tdCs.fontWeight,
        position: tdCs.position, left: tdCs.left, right: tdCs.right,
        zIndex: tdCs.zIndex, width: tdCs.width, borderBottom: tdCs.borderBottom
      };
    }) : [];
    return {
      display: cs.display, tableLayout: cs.tableLayout,
      borderCollapse: cs.borderCollapse,
      headers: headers, sampleCells: cells
    };
  });
})()
```

## Images

```js
(function() {
  return Array.from(document.querySelectorAll('img')).filter(function(el) {
    var r = el.getBoundingClientRect();
    return r.width > 5 && r.height > 5;
  }).map(function(el) {
    var rect = el.getBoundingClientRect();
    return {
      src: el.src, alt: el.alt,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y),
              w: Math.round(rect.width), h: Math.round(rect.height) },
      borderRadius: getComputedStyle(el).borderRadius
    };
  });
})()
```

## SVG Icons

```js
(function() {
  return Array.from(document.querySelectorAll('svg')).filter(function(el) {
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }).map(function(el) {
    var r = el.getBoundingClientRect();
    var parent = el.closest('a, button, [role="button"], li, div');
    return {
      outerHTML: el.outerHTML.slice(0, 2000),
      rect: { x: Math.round(r.x), y: Math.round(r.y),
              w: Math.round(r.width), h: Math.round(r.height) },
      parentSelector: parent ? (parent.className || parent.tagName) : 'unknown',
      parentText: parent ? parent.textContent.trim().slice(0, 50) : ''
    };
  });
})()
```

## Typography + Color Palette

```js
(function() {
  var fonts = new Set();
  var typeScale = [];
  var seen = new Set();
  document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,span,li,td,th,label,button,input').forEach(function(el) {
    var cs = getComputedStyle(el);
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    fonts.add(cs.fontFamily);
    var key = cs.fontSize + '|' + cs.fontWeight + '|' + cs.lineHeight;
    if (!seen.has(key)) {
      seen.add(key);
      typeScale.push({
        tag: el.tagName.toLowerCase(),
        sample: el.textContent.trim().slice(0, 40),
        fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing,
        fontFamily: cs.fontFamily, color: cs.color
      });
    }
  });

  var colors = new Map();
  document.querySelectorAll('*').forEach(function(el) {
    var cs = getComputedStyle(el);
    [cs.color, cs.backgroundColor, cs.borderColor].forEach(function(c) {
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent')
        colors.set(c, (colors.get(c) || 0) + 1);
    });
  });

  return {
    fontFamilies: Array.from(fonts),
    typeScale: typeScale.sort(function(a, b) { return parseFloat(b.fontSize) - parseFloat(a.fontSize); }).slice(0, 15),
    colorPalette: Array.from(colors.entries()).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 20).map(function(entry) { return { color: entry[0], count: entry[1] }; })
  };
})()
```

## Hover State Extraction

For each interactive element, hover first, then:

```js
(function() {
  var el = document.querySelector('[SELECTOR]');
  var cs = getComputedStyle(el);
  return {
    backgroundColor: cs.backgroundColor, color: cs.color,
    textDecoration: cs.textDecoration, borderColor: cs.borderColor,
    boxShadow: cs.boxShadow, opacity: cs.opacity,
    outline: cs.outline
  };
})()
```

## Interactive Element Inventory

```js
(function() {
  return Array.from(document.querySelectorAll(
    'button, [role="button"], [role="tab"], [role="menuitem"], ' +
    '[data-toggle], [data-dropdown], details, [aria-haspopup], ' +
    '[aria-expanded], select, [role="combobox"], [role="listbox"]'
  )).filter(function(el) { return el.getBoundingClientRect().width > 0; }).map(function(el) {
    return {
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      ariaExpanded: el.getAttribute('aria-expanded'),
      text: el.innerText.trim().slice(0, 50),
      rect: el.getBoundingClientRect(),
      selector: el.id ? '#' + el.id : undefined
    };
  });
})()
```

