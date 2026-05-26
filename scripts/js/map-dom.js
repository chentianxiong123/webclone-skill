// map-dom.js — Map visual bounding boxes back to DOM selectors
// Input: VCOMPONENTS global variable set by Python orchestrator (no placeholder needed).
// For testing without Python: pass components via WINDOW__VCOMPONENTS__ injected at call time.
// Strategy: intersect each bounding box against element getClientRects(),
// score by intersection area + size fit + DOM depth, pick outermost best-fit element.
// NOTE: No IIFE wrapper. Call as: mapDomComponents(YOUR_ARRAY_HERE)

function mapDomComponents(components) {
  if (!Array.isArray(components)) return { error: 'no components', components: [] };

  function rectsFor(el) {
    var raw = el.getClientRects();
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      out.push({ left: raw[i].left, top: raw[i].top, right: raw[i].right, bottom: raw[i].bottom });
    }
    return out;
  }

  function boxArea(bb) {
    return Math.max(0, (bb.x2 - bb.x1) * (bb.y2 - bb.y1));
  }

  function intersectArea(r, bb) {
    var x1 = Math.max(r.left, bb.x1), x2 = Math.min(r.right, bb.x2);
    var y1 = Math.max(r.top, bb.y1), y2 = Math.min(r.bottom, bb.y2);
    if (x1 >= x2 || y1 >= y2) return 0;
    return (x2 - x1) * (y2 - y1);
  }

  function getPath(el) {
    var parts = [];
    var cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      var tag = cur.tagName.toLowerCase();
      var id = cur.id ? '#' + cur.id : '';
      var cls = '';
      var cn = cur.className;
      if (typeof cn === 'string' && cn.trim()) {
        cls = cn.trim().split(/\s+/).slice(0, 2).map(function(c) { return '.' + c; }).join('');
      }
      parts.unshift(tag + id + cls);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function score(el, bb, intersection) {
    var bbArea = boxArea(bb);
    if (bbArea === 0) return 0;
    var rs = rectsFor(el);
    var elemArea = 0;
    for (var i = 0; i < rs.length; i++) elemArea += Math.max(0, (rs[i].right - rs[i].left) * (rs[i].bottom - rs[i].top));

    // Containment: what fraction of the ELEMENT is inside the bounding box.
    // A perfectly-sized element gets 1.0; a massive wrapper gets a low fraction.
    var containmentRatio = elemArea > 0 ? Math.min(intersection / elemArea, 1.0) : 0;

    // Intersection: what fraction of the TARGET BOX this element covers.
    var intRatio = intersection / bbArea;

    // Penalize elements that are much larger than the bounding box.
    // A header element should NOT be scored the same as the page root.
    var sizePenalty = 1.0;
    if (elemArea > bbArea * 3) sizePenalty = 0.3;
    else if (elemArea > bbArea * 2) sizePenalty = 0.55;
    else if (elemArea > bbArea * 1.1) sizePenalty = 0.80;

    // Position: corners should align
    var r0 = rs[0];
    var posError = Math.abs(r0.left - bb.x1) + Math.abs(r0.top - bb.y1) +
                   Math.abs(r0.right - bb.x2) + Math.abs(r0.bottom - bb.y2);
    var posScore = Math.max(0, 1 - posError / (bbArea * 4 + 1));

    // Containment drives score; sizePenalty filters out massive wrappers
    return containmentRatio * intRatio * sizePenalty * 0.65 +
           containmentRatio * posScore * 0.20 +
           intRatio * (1 - containmentRatio) * 0.15;
  }

  var allEls = document.querySelectorAll('*');
  var total = allEls.length;

  var results = components.map(function(comp) {
    var bb = comp.bounding_box;
    var best = null, bestScore = -1, bestInt = 0;

    for (var i = 0; i < allEls.length; i++) {
      var el = allEls[i];
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      var rs = rectsFor(el);
      if (!rs || rs.length === 0) continue;
      for (var j = 0; j < rs.length; j++) {
        var ia = intersectArea(rs[j], bb);
        if (ia === 0) continue;
        var s = score(el, bb, ia);
        if (s > bestScore) { bestScore = s; best = el; bestInt = ia; }
      }
    }

    if (!best) return { label: comp.label, type_hint: comp.type_hint, notes: comp.notes, bounding_box: bb, dom: null, confidence: 0 };

    // Among top candidates, prefer shallowest DOM tree
    var top = [];
    for (var k = 0; k < allEls.length; k++) {
      var el2 = allEls[k];
      var cs2 = getComputedStyle(el2);
      if (cs2.display === 'none') continue;
      var rs2 = rectsFor(el2);
      if (!rs2) continue;
      for (var m = 0; m < rs2.length; m++) {
        var ia2 = intersectArea(rs2[m], bb);
        if (ia2 === 0) continue;
        var s2 = score(el2, bb, ia2);
        if (s2 >= bestScore * 0.85) top.push({ el: el2, score: s2, intArea: ia2 });
      }
    }
    function specificity(el) {
      var s = 0;
      if (el.id) s += 100;
      var cn = el.className;
      if (typeof cn === 'string') s += cn.trim().split(/\s+/).length * 10;
      return s;
    }

    top.sort(function(a, b) {
      if (Math.abs(b.score - a.score) > 0.05) return b.score - a.score;
      // Tie-break: prefer more specific selectors (more classes/ID)
      return specificity(b.el) - specificity(a.el);
    });

    var chosen = top[0].el;
    var chosenScore = top[0].score;
    var chosenInt = top[0].intArea;
    var r0 = chosen.getBoundingClientRect();
    var ecs = getComputedStyle(chosen);
    var children = Array.from(chosen.children).filter(function(c) {
      var cr = c.getBoundingClientRect(); return cr.width > 2 && cr.height > 2;
    });
    var intRatio = chosenInt / boxArea(bb);
    var path = getPath(chosen);
    // Skip documentElement and body wrappers in reported path
    while (chosen && (chosen.tagName === 'HTML' || chosen.tagName === 'BODY') && chosen.parentElement) {
      chosen = chosen.parentElement;
    }
    var truePath = getPath(chosen);

    return {
      label: comp.label,
      type_hint: comp.type_hint,
      notes: comp.notes,
      bounding_box: bb,
      dom: {
        selector: truePath,
        tag: chosen.tagName.toLowerCase(),
        id: chosen.id || undefined,
        classes: (chosen.className && typeof chosen.className === 'string')
          ? chosen.className.split(/\s+/).filter(Boolean).slice(0, 5) : [],
        is_wrapper: children.length === 1 && intRatio > 0.9,
        child_count: chosen.children.length,
        visible_child_count: children.length,
        rect: { x: Math.round(r0.left), y: Math.round(r0.top), w: Math.round(r0.width), h: Math.round(r0.height) },
        styles: {
          display: ecs.display, position: ecs.position,
          overflow: ecs.overflow !== 'visible' ? ecs.overflow : undefined,
          backgroundColor: (ecs.backgroundColor !== 'rgba(0, 0, 0, 0)' && ecs.backgroundColor !== 'transparent') ? ecs.backgroundColor : undefined,
          padding: ecs.padding !== '0px' ? ecs.padding : undefined,
          margin: ecs.margin !== '0px' ? ecs.margin : undefined,
          borderRadius: ecs.borderRadius !== '0px' ? ecs.borderRadius : undefined,
          boxShadow: ecs.boxShadow !== 'none' ? ecs.boxShadow : undefined,
          border: (ecs.border && ecs.border !== '0px none rgb(0, 0, 0)') ? ecs.border : undefined,
          zIndex: ecs.zIndex !== 'auto' ? ecs.zIndex : undefined
        },
        child_tags: children.map(function(c) { return c.tagName.toLowerCase(); }),
        textContent: (chosen.textContent || '').trim().slice(0, 80)
      },
      confidence: Math.round(chosenScore * 100) / 100,
      intersection_area: Math.round(chosenInt),
      box_area: boxArea(bb)
    };
  });

  return { components: results, total: results.length, elements_scanned: total };
}

// Auto-run if VCOMPONENTS is set directly on window (injected by Python)
// Otherwise exports for explicit call
if (typeof window !== 'undefined' && window.VCOMPONENTS) {
  return mapDomComponents(window.VCOMPONENTS);
}
