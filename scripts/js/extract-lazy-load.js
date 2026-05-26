// extract-lazy-load.js — Aggressive lazy-load trigger combining multiple strategies
// Returns: { iterations, initialHeight, finalHeight, growthRatio, strategies, elementCountBefore, elementCountAfter }
//
// Strategies (run in order, one full cycle):
//   1. Eager-load all <img loading="lazy"> by setting loading="eager"
//   2. Force-fire all queued IntersectionObserver entries by toggling visibility
//   3. Incremental scroll to bottom (viewport-height steps, 1.5s wait per step, max 30 iters)
//   4. Horizontal scroll on overflow-x containers (carousels)
//   5. Dispatch synthetic 'scroll' / 'resize' events at top, mid, bottom positions
//   6. Wait for all running CSS animations / transitions to settle
//   7. Restore scroll to top
//
// NOTE: Returns a Promise — page.evaluate awaits it. No IIFE wrapper.

return new Promise(function (resolve) {
  var strategiesUsed = [];
  var initialHeight = document.body.scrollHeight;
  var elementCountBefore = document.querySelectorAll('*').length;

  // Strategy 1: eager-ify lazy images
  var imgs = document.querySelectorAll('img[loading="lazy"]');
  if (imgs.length > 0) {
    imgs.forEach(function (i) { try { i.loading = 'eager'; } catch (e) {} });
    strategiesUsed.push({ name: 'eagerImages', count: imgs.length });
  }

  // Strategy 2: scroll all overflow-x containers
  var hContainers = Array.from(document.querySelectorAll('*')).filter(function (el) {
    var cs = getComputedStyle(el);
    return (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth;
  });
  hContainers.forEach(function (c) {
    try { c.scrollLeft = c.scrollWidth; setTimeout(function () { c.scrollLeft = 0; }, 200); } catch (e) {}
  });
  if (hContainers.length > 0) strategiesUsed.push({ name: 'horizontalScroll', count: hContainers.length });

  // Strategy 3: incremental scroll
  var maxIterations = 30;
  var waitMs = 1200;
  var iteration = 0;
  var lastHeight = initialHeight;
  var stableCount = 0;

  function scrollStep() {
    window.scrollBy(0, window.innerHeight);
    // dispatch scroll on common listening targets
    try { window.dispatchEvent(new Event('scroll')); document.dispatchEvent(new Event('scroll')); } catch (e) {}
    iteration++;
    setTimeout(function () {
      var newHeight = document.body.scrollHeight;
      if (newHeight === lastHeight) stableCount++; else stableCount = 0;
      // exit when height stable for 2 rounds OR max reached OR scrolled beyond
      if (stableCount >= 2 || iteration >= maxIterations || window.scrollY + window.innerHeight >= newHeight) {
        afterScroll(newHeight);
      } else {
        lastHeight = newHeight;
        scrollStep();
      }
    }, waitMs);
  }

  function afterScroll(finalHeight) {
    strategiesUsed.push({ name: 'verticalScroll', iterations: iteration });
    // Strategy 4: synthetic resize for responsive components that load on resize
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    strategiesUsed.push({ name: 'syntheticResize' });

    // Strategy 5: wait for animations
    var anims = (document.getAnimations ? document.getAnimations() : []) || [];
    if (anims.length > 0) {
      strategiesUsed.push({ name: 'awaitAnimations', count: anims.length });
      Promise.all(anims.map(function (a) { return a.finished.catch(function () { return null; }); })).then(finalize.bind(null, finalHeight));
    } else {
      finalize(finalHeight);
    }
  }

  function finalize(finalHeight) {
    window.scrollTo(0, 0);
    setTimeout(function () {
      var elementCountAfter = document.querySelectorAll('*').length;
      resolve({
        iterations: iteration,
        initialHeight: initialHeight,
        finalHeight: finalHeight,
        growthRatio: initialHeight > 0 ? (finalHeight / initialHeight) : 1,
        elementCountBefore: elementCountBefore,
        elementCountAfter: elementCountAfter,
        elementsAdded: elementCountAfter - elementCountBefore,
        strategies: strategiesUsed
      });
    }, 500);
  }

  scrollStep();
});
