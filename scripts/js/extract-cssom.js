// extract-cssom.js — Full CSSOM walk: every rule, every @-rule
// Returns: { stylesheets, mediaRules, keyframes, fontFaces, supports, layers, totals, errors }
// Walks document.styleSheets recursively (handles nested @media, @supports, @layer).
// Cross-origin sheets are reported as { _crossOrigin: true, href: ... } — caller can fetch
// them through the network harvester.
// NOTE: No IIFE wrapper.

var stylesheets = [];
var mediaRules = [];
var keyframes = [];
var fontFaces = [];
var supports = [];
var layers = [];
var importRules = [];
var errors = [];

function pickSelectors(rule) {
  return rule.selectorText || null;
}

function walkRules(rules, sheetIdx, mediaCondition, supportCondition, layerName) {
  if (!rules) return;
  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    try {
      switch (rule.type) {
        case 1: // STYLE_RULE
          stylesheets.push({
            sheetIdx: sheetIdx,
            selector: rule.selectorText,
            cssText: rule.cssText,
            media: mediaCondition || null,
            supports: supportCondition || null,
            layer: layerName || null
          });
          break;
        case 3: // IMPORT_RULE
          importRules.push({ sheetIdx: sheetIdx, href: rule.href, media: rule.media && rule.media.mediaText });
          if (rule.styleSheet) {
            try { walkRules(rule.styleSheet.cssRules, sheetIdx, mediaCondition, supportCondition, layerName); } catch (e) { errors.push('import: ' + e.message); }
          }
          break;
        case 4: // MEDIA_RULE
          var mc = rule.conditionText || (rule.media && rule.media.mediaText);
          mediaRules.push({ sheetIdx: sheetIdx, condition: mc, ruleCount: rule.cssRules.length });
          walkRules(rule.cssRules, sheetIdx, mc, supportCondition, layerName);
          break;
        case 5: // FONT_FACE_RULE
          var fontStyle = rule.style;
          fontFaces.push({
            sheetIdx: sheetIdx,
            family: fontStyle.getPropertyValue('font-family'),
            src: fontStyle.getPropertyValue('src'),
            weight: fontStyle.getPropertyValue('font-weight'),
            style: fontStyle.getPropertyValue('font-style'),
            display: fontStyle.getPropertyValue('font-display'),
            unicodeRange: fontStyle.getPropertyValue('unicode-range'),
            cssText: rule.cssText
          });
          break;
        case 7: // KEYFRAMES_RULE
          var frames = [];
          for (var k = 0; k < rule.cssRules.length; k++) {
            frames.push({ keyText: rule.cssRules[k].keyText, cssText: rule.cssRules[k].cssText });
          }
          keyframes.push({ sheetIdx: sheetIdx, name: rule.name, frames: frames });
          break;
        case 12: // SUPPORTS_RULE
          var sc = rule.conditionText;
          supports.push({ sheetIdx: sheetIdx, condition: sc, ruleCount: rule.cssRules.length });
          walkRules(rule.cssRules, sheetIdx, mediaCondition, sc, layerName);
          break;
        default:
          // CSSLayerBlockRule (modern) — type may be unset; check constructor name
          if (rule.constructor && rule.constructor.name === 'CSSLayerBlockRule') {
            var ln = rule.name || layerName;
            layers.push({ sheetIdx: sheetIdx, name: rule.name, ruleCount: rule.cssRules ? rule.cssRules.length : 0 });
            if (rule.cssRules) walkRules(rule.cssRules, sheetIdx, mediaCondition, supportCondition, ln);
          } else if (rule.cssRules) {
            walkRules(rule.cssRules, sheetIdx, mediaCondition, supportCondition, layerName);
          }
      }
    } catch (e) {
      errors.push('rule[' + i + ']: ' + e.message);
    }
  }
}

for (var s = 0; s < document.styleSheets.length; s++) {
  var sheet = document.styleSheets[s];
  try {
    var rules = sheet.cssRules || sheet.rules;
    if (!rules) {
      errors.push('sheet ' + s + ' (' + (sheet.href || 'inline') + '): no cssRules — likely cross-origin');
      stylesheets.push({ sheetIdx: s, _crossOrigin: true, href: sheet.href, media: sheet.media && sheet.media.mediaText });
      continue;
    }
    walkRules(rules, s, null, null, null);
  } catch (e) {
    errors.push('sheet ' + s + ' (' + (sheet.href || 'inline') + '): ' + e.message);
    stylesheets.push({ sheetIdx: s, _accessError: true, href: sheet.href, error: e.message });
  }
}

return {
  stylesheets: stylesheets,
  mediaRules: mediaRules,
  keyframes: keyframes,
  fontFaces: fontFaces,
  supports: supports,
  layers: layers,
  imports: importRules,
  totals: {
    sheets: document.styleSheets.length,
    rules: stylesheets.length,
    mediaQueries: mediaRules.length,
    keyframes: keyframes.length,
    fontFaces: fontFaces.length,
    crossOrigin: stylesheets.filter(function (r) { return r._crossOrigin; }).length
  },
  errors: errors
};
