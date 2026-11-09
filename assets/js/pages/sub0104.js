/**
 * sub0104 (Road & Sites Map)
 * Section 1/2: pin + internal scroll snap
 */
(function ($, w, d) {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    var BREAKPOINT = 1024;
    var HEIGHT_BREAKPOINT = 768;
    var triggers = [];
    var snappedSections = [];
    var snappedColumns = [];
    var engineReady = false;
    var snapCleanup = null;

    w.__snapOff = w.__snapOff || false;
    w.__snapSetOff = w.__snapSetOff || function (v) { w.__snapOff = !!v; };

    function scrollerEl() {
        var lc = loco();
        return lc ? ($('[data-scroll-container]').get(0) || w) : w;
    }

    function loco() {
        return (w.scrollInstance && w.scrollInstance.__isLoco) ? w.scrollInstance : null;
    }

    function curY(lc) {
        return lc?.scroll?.instance?.scroll?.y || 0;
    }

    function absTop(lc, el) {
        return curY(lc) + (el?.getBoundingClientRect?.().top || 0);
    }

    function visibleRatio(lc, el) {
        if (!el) return 0;
        var vh = w.innerHeight || 1;
        var y = curY(lc);
        var r = el.getBoundingClientRect();
        var h = r.height || 1;
        var top = absTop(lc, el);
        var bottom = top + h;
        var vTop = y;
        var vBottom = y + vh;
        var overlap = Math.max(0, Math.min(bottom, vBottom) - Math.max(top, vTop));
        return overlap / h;
    }

    function maxVisibleIndex(lc, panels) {
        var best = 0, bestR = -1;
        for (var i = 0; i < panels.length; i++) {
            var r = visibleRatio(lc, panels[i]);
            if (r > bestR) { bestR = r; best = i; }
        }
        return best;
    }

    function inRange(lc, panels) {
        if (!panels.length) return false;
        var first = panels[0], last = panels[panels.length - 1];
        var top = absTop(lc, first);
        var bot = absTop(lc, last) + (last.getBoundingClientRect().height || 0) - (w.innerHeight || 0);
        var y = curY(lc);
        return y >= top - 12 && y <= bot + 12;
    }

    function getTriggerFor(el) {
        return triggers.find(function (t) { return t && t.trigger === el; });
    }

    function cleanup() {
        triggers.forEach(function (t) { if (t && t.kill) t.kill(); });
        triggers = [];

        snappedSections.forEach(function (s) { $(s).removeClass('is-snap'); });
        snappedSections = [];

        snappedColumns.forEach(function (c) { $(c).removeClass('history-scroll-area'); });
        snappedColumns = [];

        $('.history .timeline').each(function (_, el) {
            gsap.set(el, { clearProps: 'transform' });
        });
    }

    function buildSnap() {
        if (w.innerWidth <= BREAKPOINT || w.innerHeight <= HEIGHT_BREAKPOINT) return null;
        var lc = loco();
        if (!lc) return null;

        var panels = $('.cont1.history, .cont2.history').toArray();
        if (!panels.length) return null;

        var DOWN_THRESH = 0.20;
        var UP_THRESH = 0.12;
        var MIN_DY = 2;
        var COOLDOWN_MS = 480;
        var snapping = false;
        var cooldown = 0;
        var lastY = curY(lc);
        var wasInRange = false;

        function goTo(i, opts) {
            if (i < 0 || i >= panels.length) return;
            snapping = true;
            cooldown = Date.now() + COOLDOWN_MS;
            w.__snapSetOff(true);
            var dur = (opts && opts.instant) ? 0 : 600;
            lc.scrollTo(panels[i], {
                duration: dur,
                disableLerp: false,
                callback: function () {
                    lc.start();
                    snapping = false;
                    lastY = curY(lc);
                    setTimeout(function () { w.__snapSetOff(false); }, 5);
                }
            });
        }

        function onScroll() {
            if (w.__snapOff) { lastY = curY(lc); return; }
            if (snapping) { lastY = curY(lc); return; }
            var now = Date.now();
            if (now < cooldown) { lastY = curY(lc); return; }

            var y = curY(lc);
            var dy = y - lastY;
            if (Math.abs(dy) < MIN_DY) return;
            lastY = y;

            var rangeOk = inRange(lc, panels);
            if (!rangeOk) {
                wasInRange = false;
                return;
            }

            if (!wasInRange) {
                var entryIdx = maxVisibleIndex(lc, panels);
                goTo(entryIdx, { instant: true });
                wasInRange = true;
                return;
            }

            var curIdx = maxVisibleIndex(lc, panels);
            var pinTrig = getTriggerFor(panels[curIdx]);
            if (pinTrig) {
                var p = pinTrig.progress || 0;
                if (dy > 0 && p < 0.97) return;
                if (dy < 0 && p > 0.03) return;
            }

            if (dy > 0 && curIdx < panels.length - 1) {
                if (visibleRatio(lc, panels[curIdx + 1]) >= DOWN_THRESH) { goTo(curIdx + 1); return; }
            }
            if (dy < 0 && curIdx > 0) {
                if (visibleRatio(lc, panels[curIdx - 1]) >= UP_THRESH) { goTo(curIdx - 1); return; }
            }
        }

        lc.on('scroll', onScroll);

        function alignNearest() {
            if (snapping || w.__snapOff) return;
            var idx = maxVisibleIndex(lc, panels);
            lc.scrollTo(panels[idx], { duration: 0, disableLerp: true });
            lastY = curY(lc);
            wasInRange = true;
        }
        setTimeout(alignNearest, 0);

        function onResize() {
            if (w.innerWidth < BREAKPOINT || w.innerHeight <= HEIGHT_BREAKPOINT) {
                cleanupSnap();
            } else {
                setTimeout(alignNearest, 120);
            }
        }
        w.addEventListener('resize', onResize, { passive: true });

        function cleanupSnap() {
            try { lc.off('scroll', onScroll); } catch (e) { }
            w.removeEventListener('resize', onResize);
        }

        return cleanupSnap;
    }

    function buildSection(sectionSelector, scrollSelector) {
        var $section = $(sectionSelector);
        if (!$section.length) return;

        var $scrollWrap = $section.find(scrollSelector);
        if (!$scrollWrap.length) return;

        var $track = $scrollWrap.find('.timeline');
        if (!$track.length) $track = $scrollWrap;

        $section.addClass('is-snap');
        $scrollWrap.addClass('history-scroll-area');

        function overflow() {
            gsap.set($track.get(0), { clearProps: 'transform' });
            var diff = $track.get(0).scrollHeight - $scrollWrap.get(0).clientHeight;
            return diff > 0 ? diff : 0;
        }

        var distance = overflow();
        if (distance <= 0) {
            $section.removeClass('is-snap');
            $scrollWrap.removeClass('history-scroll-area');
            return;
        }

        snappedSections.push($section.get(0));
        snappedColumns.push($scrollWrap.get(0));

        var tl = gsap.timeline({ defaults: { ease: 'none' } });
        tl.fromTo($track.get(0), { y: 0 }, {
            y: function () { return -overflow(); },
            duration: 1,
            ease: 'none'
        });

        var trigger = ScrollTrigger.create({
            trigger: $section.get(0),
            scroller: scrollerEl(),
            start: 'top top',
            end: function () { return '+=' + (overflow() + 120); },
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
            scrub: true,
            invalidateOnRefresh: true,
            animation: tl
        });

        triggers.push(trigger);
    }

    var rebuild = (function () {
        var timer = null;
        return function () {
            clearTimeout(timer);
            timer = setTimeout(function () {
                if (!engineReady) return;
                cleanup();
                if (snapCleanup) { snapCleanup(); snapCleanup = null; }
                if (w.innerWidth <= BREAKPOINT || w.innerHeight <= HEIGHT_BREAKPOINT) return;
                var lc = loco();
                if (!lc) return; 

                buildSection('.cont1.history', '.right');
                buildSection('.cont2.history', '.right');

                ScrollTrigger.refresh();
                w.scrollInstance?.update?.();

                snapCleanup = buildSnap();
            }, 60);
        };
    })();

    $(d).on('scrollengine:ready', function () {
        engineReady = true;
        rebuild();
    });

    $(w).on('resize', rebuild);

    if (w.imagesLoaded) {
        w.imagesLoaded($('.history img'), function () { rebuild(); });
    }
})(jQuery, window, document);

/**
 * Section 1/2: history timeline reveal
 */
(function ($, w, d) {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    var controllers = [];

    function scrollerEl() {
        var loco = w.scrollInstance && w.scrollInstance.__isLoco;
        if (loco) {
            return $('[data-scroll-container]').get(0) || w;
        }
        return w;
    }

    function cleanup() {
        controllers.forEach(function (t) { t.kill && t.kill(); });
        controllers = [];
    }

    function build() {
        cleanup();
        var $timelines = $('.history .timeline');
        if (!$timelines.length) return;

        $timelines.each(function () {
            var $timeline = $(this);
            var items = $timeline.find('.item').toArray();
            if (!items.length) return;

            items.forEach(function (el, idx) {
                var next = items[idx + 1];
                var curTop = $(el).position().top || 0;
                var nextTop = next ? ($(next).position().top || 0) : curTop;
                var len = next ? Math.max(0, nextTop - curTop - 35) : 0;
                el.style.setProperty('--dot-scale', 0.4);
                el.style.setProperty('--dot-alpha', 0);
                el.style.setProperty('--dot-glow', '0px');
                el.style.setProperty('--line-len', '0px');
                el.style.setProperty('--line-alpha', '0');
                el.dataset.lineLen = len + 'px';
                $(el).find('.year, .content').css({ opacity: 0, y: 16 });
            });

            var tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
            tl.add('startDelay', '+=0.6'); // hold before first dot animates

            items.forEach(function (el, idx) {
                var label = 'step' + idx;
                tl.set(el, { autoAlpha: 0 }, label);
                tl.to(el, { autoAlpha: 1, duration: 0.01 }, label);
                tl.to(el, {
                    '--dot-scale': 1,
                    '--dot-alpha': 1,
                    '--dot-glow': '14px',
                    duration: 0.35,
                    ease: 'power1.out'
                }, label);
                tl.to(el, {
                    '--dot-glow': '0px',
                    duration: 0.45,
                    ease: 'power1.in'
                }, label + '+=0.2');

                var parts = $(el).find('.year, .content').toArray();
                tl.fromTo(parts, {
                    autoAlpha: 0,
                    y: 18
                }, {
                    autoAlpha: 1,
                    y: 0,
                    duration: 0.45,
                    stagger: 0.05,
                    ease: 'power2.out'
                }, label + '+=0.05');

                tl.to(el, {
                    '--line-len': el.dataset.lineLen || '0px',
                    duration: 0.9,
                    ease: 'power1.inOut'
                }, label + '+=0.12');
                tl.to(el, {
                    '--line-alpha': 1,
                    duration: 0.5,
                    ease: 'power1.out'
                }, label + '+=0.12');
            });

            var mobileTimeline = w.innerWidth <= 1024;
            var startPos = $timeline.closest('.cont2').length
                ? (mobileTimeline ? 'top 80%' : 'top 30%')
                : (mobileTimeline ? 'top 62%' : 'top 62%');
            var endPos = mobileTimeline ? '+=80%' : '+=100%';
            var trigger = ScrollTrigger.create({
                trigger: $timeline.get(0),
                scroller: scrollerEl(),
                start: startPos,
                end: endPos,
                animation: tl,
                scrub: true,
                invalidateOnRefresh: true
            });

            controllers.push(trigger);
        });

        ScrollTrigger.refresh();
        w.scrollInstance?.update?.();
    }

    $(d).on('scrollengine:ready', function () { build(); });
    $(w).on('resize', function () { build(); });
    if (w.imagesLoaded) {
        w.imagesLoaded($('.history img'), function () { build(); });
    }
})(jQuery, window, document);

/**
 * Section 3: map lines + layers animation
 */
(function ($, w, d) {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    var controller = null;
    var buildTimer = null;
    var anchorCache = new WeakMap();
    var mapHasPlayed = false;

    function clamp01(v) {
        return Math.min(Math.max(v, 0), 1);
    }

    function scrollerEl() {
        var loco = w.scrollInstance && w.scrollInstance.__isLoco;
        if (loco) {
            var $sc = $('[data-scroll-container]').eq(0);
            return $sc.get(0) || w;
        }
        return w;
    }

    function parseRatio(value) {
        if (!value) return null;
        var v = (value || '').toString().trim();
        if (!v) return null;
        if (v.endsWith('%')) {
            return clamp01((parseFloat(v) || 0) * 0.01);
        }
        var num = parseFloat(v);
        return isNaN(num) ? null : clamp01(num);
    }

    function topToPx(value, height) {
        if (!value) return height * 0.5;
        var v = (value || '').trim();
        if (v.endsWith('%')) {
            return (parseFloat(v) || 0) * 0.01 * height;
        }
        return parseFloat(v) || 0;
    }

    function captureAnchorRatio(card, mapRect, ignoreCustom) {
        if (!card || !mapRect || !mapRect.width || !mapRect.height) return null;
        var rect = card.getBoundingClientRect();
        var style = getComputedStyle(card);
        var len = parseFloat(style.getPropertyValue('--line-len')) || 0;
        var topVal = style.getPropertyValue('--line-top') || '50%';
        var topPx = topToPx(topVal, rect.height);
        var isLeft = $(card).closest('.left').length > 0;
        var anchorX = isLeft ? rect.right + len : rect.left - len;
        var anchorY = rect.top + topPx;
        var customX = ignoreCustom ? null : parseRatio(style.getPropertyValue('--anchor-x'));
        var customY = ignoreCustom ? null : parseRatio(style.getPropertyValue('--anchor-y'));
        return {
            x: customX !== null ? customX : clamp01((anchorX - mapRect.left) / mapRect.width),
            y: customY !== null ? customY : clamp01((anchorY - mapRect.top) / mapRect.height)
        };
    }

    var lastIsDesktop = null;

    function applyAnchors(forceCapture) {
        var mapEl = $('.cont3 .map').get(0);
        if (!mapEl) return;

        var cards = $('.cont3 .left .card, .cont3 .right .card').toArray();

        var mapRect = mapEl.getBoundingClientRect();
        if (!mapRect.width || !mapRect.height) return;

        var isDesktop = w.innerWidth > 1024;
        if (lastIsDesktop !== isDesktop) {
            anchorCache = new WeakMap();
            lastIsDesktop = isDesktop;
        }

        if (forceCapture) {
            anchorCache = new WeakMap();
        }

        cards.forEach(function (el, idx) {
            var ratio = anchorCache.get(el);
            if (!ratio || forceCapture) {
                ratio = captureAnchorRatio(el, mapRect, isDesktop);
                if (ratio) {
                    anchorCache.set(el, ratio);
                }
            }
            if (!ratio) return;

            el.classList.remove('line-up', 'line-down', 'line-vert', 'line-ang', 'line-ortho');
            var rect = el.getBoundingClientRect();
            var targetX = mapRect.left + mapRect.width * ratio.x;
            var targetY = mapRect.top + mapRect.height * ratio.y;
            var isLeft = $(el).closest('.left').length > 0;
            var minLen = 36;
            var pad = 12;

            if (w.innerWidth <= 1024) {
                var targetRelX = targetX - rect.left;
                var targetRelY = targetY - rect.top;
                var sideOffset = 16;
                var orderVal = parseInt(getComputedStyle(el).getPropertyValue('order') || '0', 10);
                var isSmall = w.innerWidth <= 768;

                if (!isSmall) {
                    var startXFull = Math.min(Math.max(targetRelX, pad), Math.max(pad, rect.width - pad));
                    var isTopPairFull = $(el).is('.left .card:first-child, .right .card:first-child');
                    var startTopFull = isTopPairFull ? (rect.height - pad) : pad;
                    var dxFull = targetRelX - startXFull;
                    var dyFull = targetRelY - startTopFull;
                    var lenFull = Math.max(minLen, Math.sqrt(dxFull * dxFull + dyFull * dyFull));
                    var angleFull = Math.atan2(dyFull, dxFull) * 180 / Math.PI;

                    el.style.setProperty('--line-start-x', startXFull.toFixed(1) + 'px');
                    el.style.setProperty('--line-start-y', startTopFull.toFixed(1) + 'px');
                    el.style.setProperty('--line-len', lenFull.toFixed(1) + 'px');
                    el.style.setProperty('--line-rot', angleFull.toFixed(2) + 'deg');
                    el.style.setProperty('--pin-x', targetRelX.toFixed(1) + 'px');
                    el.style.setProperty('--pin-y', targetRelY.toFixed(1) + 'px');
                    el.style.setProperty('--line-scale', 1);
                    el.style.setProperty('--pin-opacity', 1);
                    el.classList.add('line-ang');
                    return;
                }

                if (orderVal === 2 || orderVal === 4) {
                    var startXAng = Math.min(Math.max(targetRelX, pad), Math.max(pad, rect.width - pad));
                    var isTopPairAng = $(el).is('.left .card:first-child, .right .card:first-child');
                    var startTopAng = isTopPairAng ? (rect.height - pad) : pad;
                    var dxAng = targetRelX - startXAng;
                    var dyAng = targetRelY - startTopAng;
                    var lenAng = Math.max(minLen, Math.sqrt(dxAng * dxAng + dyAng * dyAng));
                    var angleAng = Math.atan2(dyAng, dxAng) * 180 / Math.PI;

                    el.style.setProperty('--line-start-x', startXAng.toFixed(1) + 'px');
                    el.style.setProperty('--line-start-y', startTopAng.toFixed(1) + 'px');
                    el.style.setProperty('--line-len', lenAng.toFixed(1) + 'px');
                    el.style.setProperty('--line-rot', angleAng.toFixed(2) + 'deg');
                    el.style.setProperty('--pin-x', targetRelX.toFixed(1) + 'px');
                    el.style.setProperty('--pin-y', targetRelY.toFixed(1) + 'px');
                    el.style.setProperty('--line-scale', 1);
                    el.style.setProperty('--pin-opacity', 1);
                    el.classList.add('line-ang');
                    return;
                }

                var startX;
                var startTop;
                if (w.innerWidth <= 768 && orderVal === 1) {
                    startX = Math.max(pad, Math.min(rect.width - pad, rect.width * 0.15));
                    startTop = Math.max(pad, rect.height - pad);
                } else if (w.innerWidth <= 768 && orderVal === 5) {
                    startX = Math.max(pad, Math.min(rect.width - pad, rect.width * 0.85));
                    startTop = pad;
                } else {
                    startX = targetRelX < rect.width / 2 ? -sideOffset : rect.width + sideOffset;
                    var isTopPair = $(el).is('.left .card:first-child, .right .card:first-child');
                    startTop = isTopPair ? (rect.height - pad) : pad;
                }
                var startY = startTop;
                var dx = targetRelX - startX;
                var dy = targetRelY - startY;
                var minBox = w.innerWidth <= 480 ? 8 : 4;
                var boxW = Math.max(minBox, Math.abs(dx));
                var boxH = Math.max(minBox, Math.abs(dy));
                var boxL = Math.min(startX, targetRelX);
                var boxT = Math.min(startY, targetRelY);
                var bw = w.innerWidth <= 480 ? 1 : 1.5;
                var verticalAtLeft = startX <= targetRelX;
                var horizontalAtBottom = startY <= targetRelY;

                el.style.setProperty('--ortho-left', boxL.toFixed(1) + 'px');
                el.style.setProperty('--ortho-top', boxT.toFixed(1) + 'px');
                el.style.setProperty('--ortho-w', boxW.toFixed(1) + 'px');
                el.style.setProperty('--ortho-h', boxH.toFixed(1) + 'px');
                el.style.setProperty('--ortho-bl', verticalAtLeft ? bw + 'px' : '0px');
                el.style.setProperty('--ortho-br', verticalAtLeft ? '0px' : bw + 'px');
                el.style.setProperty('--ortho-bb', horizontalAtBottom ? bw + 'px' : '0px');
                el.style.setProperty('--ortho-bt', horizontalAtBottom ? '0px' : bw + 'px');
                el.style.setProperty('--pin-x', targetRelX.toFixed(1) + 'px');
                el.style.setProperty('--pin-y', targetRelY.toFixed(1) + 'px');
                el.style.setProperty('--line-scale', 1);
                el.style.setProperty('--pin-opacity', 1);
                el.classList.add('line-ortho');
                return;
            }

            el.classList.remove('line-vert');
            var lenH = isLeft ? targetX - rect.right : rect.left - targetX;
            if (!isFinite(lenH)) return;
            var maxLen = Math.max(minLen, mapRect.width * 0.9);
            lenH = Math.min(Math.max(lenH, minLen), maxLen);
            var topPxH = targetY - rect.top;
            var topMin = pad;
            var topMax = rect.height - pad;
            topPxH = Math.min(Math.max(topPxH, topMin), topMax);
            el.style.setProperty('--line-len', lenH.toFixed(1) + 'px');
            el.style.setProperty('--line-top', topPxH.toFixed(1) + 'px');
        });
    }

    var lastState = null;

    function resetState(state) {
        if (!state) return;
        gsap.set(state.mapImgs, { clearProps: 'all' });
        gsap.set(state.cards, { clearProps: 'opacity,transform' });
        state.lineCards.forEach(function (el, i) {
            gsap.set(el, { '--line-len': state.lineLens[i] || '0px', '--line-scale': 1, '--pin-opacity': 1 });
        });
    }

    function cleanup() {
        if (controller && controller.kill) controller.kill();
        controller = null;
        if (!mapHasPlayed) {
            resetState(lastState);
        }
        lastState = null;
    }

    function showFinalState() {
        var $root = $('.cont3 .container');
        if (!$root.length) return;

        applyAnchors(true);

        var mapImgs = $root.find('.map img').toArray();
        var cards = $root.find('.card').toArray();
        var lineCards = $root.find('.left .card, .right .card').toArray();

        gsap.set(mapImgs, { autoAlpha: 1, y: 0, scale: 1, rotation: 0, clearProps: 'transform' });
        gsap.set(cards, { autoAlpha: 1, y: 0, x: 0, scale: 1, rotateX: 0, clearProps: 'opacity,transform' });
        lineCards.forEach(function (el) {
            el.style.setProperty('--line-scale', 1);
            el.style.setProperty('--pin-opacity', 1);
        });
    }

    function build() {
        cleanup();
        applyAnchors(true);
        var reduceMotion = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (mapHasPlayed || reduceMotion) {
            mapHasPlayed = true;
            showFinalState();
            return;
        }

        var $root = $('.cont3 .container');
        if (!$root.length) return;

        var mapImgs = $root.find('.map img').toArray();
        if (!mapImgs.length) return;

        var cards = $root.find('.card').toArray();
        var leftCards = $root.find('.left .card').toArray();
        var rightCards = $root.find('.right .card').toArray();
        var lineCards = $root.find('.left .card, .right .card').toArray();
        var lineLens = lineCards.map(function (el) {
            var len = (getComputedStyle(el).getPropertyValue('--line-len') || '0px').trim() || '0px';
            gsap.set(el, { '--line-len': len, '--line-scale': 0, '--pin-opacity': 0 });
            return len;
        });

        // ensure initial hidden states
        gsap.set(mapImgs, { autoAlpha: 0, yPercent: 0 });
        gsap.set(cards, { autoAlpha: 0, y: 32, x: 0, scale: 0.94, rotateX: -5 });
        gsap.set(leftCards, { x: 26 });
        gsap.set(rightCards, { x: -26 });

        var tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
        tl.add('enter', '+=0.4');
        if (mapImgs[0]) {
            tl.fromTo(mapImgs[0], {
                autoAlpha: 0,
                y: 120,
                scale: 0.88,
                rotation: -1.5
            }, {
                autoAlpha: 1,
                y: 0,
                scale: 1.04,
                rotation: 0,
                duration: 0.9,
                ease: 'power3.out'
            }, 'enter');
        }
        if (mapImgs[1]) {
            tl.fromTo(mapImgs[1], {
                autoAlpha: 0,
                y: 140,
                scale: 0.9,
                rotation: 2.2
            }, {
                autoAlpha: 1,
                y: 0,
                scale: 1.06,
                rotation: 0,
                duration: 0.9,
                ease: 'power3.out'
            }, 'enter+=0.4');
        }

        tl.add('pins');

        tl.to(lineCards, {
            '--pin-opacity': 1,
            duration: 0.35,
            ease: 'power1.out'
        }, 'pins');

        tl.to(lineCards, {
            '--line-scale': 1,
            duration: 0.85,
            ease: 'power1.inOut',
            immediateRender: false
        }, 'pins+=0.08');

        tl.fromTo(leftCards, {
            autoAlpha: 0,
            y: 26,
            x: 20,
            scale: 0.94,
            rotateX: -6
        }, {
            autoAlpha: 1,
            y: 0,
            x: 0,
            scale: 1,
            rotateX: 0,
            duration: 0.82,
            stagger: 0.12,
            ease: 'back.out(1.4)',
            immediateRender: false
        }, 'enter+=0.9'); 

        tl.fromTo(rightCards, {
            autoAlpha: 0,
            y: 26,
            x: -20,
            scale: 0.94,
            rotateX: -6
        }, {
            autoAlpha: 1,
            y: 0,
            x: 0,
            scale: 1,
            rotateX: 0,
            duration: 0.82,
            stagger: 0.12,
            ease: 'back.out(1.4)',
            immediateRender: false
        }, 'enter+=0.95');

        tl.eventCallback('onComplete', function () {
            mapHasPlayed = true;
        });

        controller = ScrollTrigger.create({
            trigger: $root.get(0),
            scroller: scrollerEl(),
            start: 'top 100%',
            animation: tl,
            scrub: false,
            once: true,
            toggleActions: 'play none none none',
            invalidateOnRefresh: true
        });
        lastState = { mapImgs: mapImgs, cards: cards, lineCards: lineCards, lineLens: lineLens };

        ScrollTrigger.refresh();
        w.scrollInstance?.update?.();
    }

    function scheduleBuild() {
        clearTimeout(buildTimer);
        buildTimer = setTimeout(build, 120);
    }

    $(d).on('scrollengine:ready', function () { scheduleBuild(); });
    $(w).on('resize', function () { scheduleBuild(); });

    if (w.imagesLoaded) {
        w.imagesLoaded($('.cont3 img'), function () { scheduleBuild(); });
    }

    $(function () {
        if (w.scrollInstance) scheduleBuild();
    });
})(jQuery, window, document);
