/**
 * Main Page
 */
(function ($, w, d) {
    if ((d.body?.dataset?.page || '') !== 'main') return;

    w.gbtStagePinActive = w.gbtStagePinActive || false;

    /* Section 1: hero slider */
    function initHero() {
        var $heroSlide = $('.cont1 .hero-slide');
        if (!$heroSlide.length) return;

        var slides = [];
        try {
            slides = JSON.parse($heroSlide.attr('data-hero-slides') || '[]').filter(Boolean);
        } catch (e) {
            slides = [];
        }
        if (!slides.length) return;

        var $prev = $heroSlide.find('.hero-prev');
        var $next = $heroSlide.find('.hero-next');
        var $indicators = $heroSlide.find('.indicators .indicator');
        var current = 0;
        var AUTOPLAY = 6000;
        var timer;

        function setSlide(idx) {
            if (idx < 0) idx = slides.length - 1;
            if (idx >= slides.length) idx = 0;
            current = idx;
            $heroSlide.css('background-image', 'url(' + slides[idx] + ')');
            $indicators.removeClass('is-active').eq(idx).addClass('is-active');
        }

        function restartLoop() {
            clearInterval(timer);
            timer = setInterval(function () { setSlide(current + 1); }, AUTOPLAY);
        }

        $prev.on('click', function () {
            setSlide(current - 1);
            restartLoop();
        });

        $next.on('click', function () {
            setSlide(current + 1);
            restartLoop();
        });

        $indicators.on('click', function () {
            var idx = $(this).index();
            setSlide(idx);
            restartLoop();
        });

        setSlide(0);
        restartLoop();
    }

    /* Section 2: tabs scroll */
    function initStage() {
        var $tabs = $('.cont2 .tabs .tab');
        w.gbtStagePinActive = false;
        w.gbtStageControl = null;
        w.gbtStageTrigger = null;
        if (!$tabs.length) return;

        function releaseSnap(delay) {
            if (typeof w.__snapSetOff !== 'function') return;
            setTimeout(function () { w.__snapSetOff(false); }, typeof delay === 'number' ? delay : 80);
        }

        function scrollToTarget(targetEl) {
            if (!targetEl) return;
            if (typeof w.__snapSetOff === 'function') {
                w.__snapSetOff(true);
            }

            if (w.scrollInstance && w.scrollInstance.__isLoco && typeof w.scrollInstance.scrollTo === 'function') {
                w.scrollInstance.scrollTo(targetEl, {
                    duration: 800,
                    disableLerp: false,
                    offset: 0,
                    callback: function () { releaseSnap(80); }
                });
            } else {
                var top = targetEl.getBoundingClientRect().top + (w.scrollY || w.pageYOffset || 0);
                w.scrollTo({ top: top, behavior: 'smooth' });
                releaseSnap(400);
            }
        }

        $tabs.off('click.cont2').on('click.cont2', function (e) {
            var href = $(this).attr('href') || '';
            if (!href || href.charAt(0) !== '#') return;
            var target = d.querySelector(href);
            if (!target) return;
            e.preventDefault();
            scrollToTarget(target);
        });
    }

    /* Section 3: products slider */
    function initProducts() {
        var SWIPER_RETRY_MAX = 15;
        var SWIPER_RETRY_DELAY = 120;
        var started = false;

        function start() {
            if (started) return;
            if (typeof Swiper === 'undefined') return;

            var $products = $('.cont3 .products.swiper');
            if (!$products.length) return;

            started = true;

            var $prevBtn = $('.cont3 .nav .prev-btn');
            var $nextBtn = $('.cont3 .nav .next-btn');
            var $wrapper = $products.find('.swiper-wrapper');
            var SLIDE_SPEED = 820;

            var options = {
                slidesPerView: 'auto',
                spaceBetween: 12,
                speed: SLIDE_SPEED,
                watchOverflow: false,
                loop: false,
                rewind: true,
                centeredSlides: false,
                grabCursor: true,
                simulateTouch: true,
                resistanceRatio: 0.65,
                touchStartPreventDefault: true,
                touchStartForcePreventDefault: false,
                longSwipesRatio: 0.25,
                longSwipesMs: 120,
                allowTouchMove: true,
                slidesPerGroup: 1,
                slidesPerGroupAuto: false,
                observer: true,
                observeParents: true,
                breakpoints: {
                    0: {
                        slidesPerView: 1.05,
                        centeredSlides: false,
                        spaceBetween: 10
                    },
                    481: {
                        slidesPerView: 2,
                        centeredSlides: false,
                        spaceBetween: 12
                    },
                    769: {
                        slidesPerView: 'auto',
                        centeredSlides: false,
                        spaceBetween: 12
                    }
                }
            };

            var swiper = new Swiper($products.get(0), options);
            w.gbtProductSwiper = swiper;

            function cloneSlides() {
                if (!$wrapper.length) return;
                var $base = $wrapper.children('.swiper-slide').not('.is-clone');
                $wrapper.children('.is-clone').remove();
                var shouldClone = w.matchMedia('(min-width: 1025px)').matches;
                if (!shouldClone) {
                    swiper.updateSlides();
                    swiper.update();
                    return;
                }
                var copies = 3;
                for (var i = 0; i < copies; i++) {
                    $base.clone(true, true).addClass('is-clone').attr('aria-hidden', 'true').appendTo($wrapper);
                }
                swiper.updateSlides();
                swiper.update();
            }
            cloneSlides();

            swiper.on('resize', function () {
                cloneSlides();
                swiper.update();
                swiper.updateSlides();
                swiper.updateSlidesClasses();
                swiper.updateProgress();
                productAuto.refresh(true);
            });

            var productAuto = (function () {
                var slides = [];
                var tl = null;
                var AUTO_DELAY = 4.5; // seconds
                var restartTimer = null;
                var baseCount = 0;
                var currentBase = 0;

                function refreshSlides() {
                    slides = swiper
                        ? Array.from(swiper.slides || [])
                        : $products.find('.swiper-slide').toArray();
                    baseCount = $wrapper.children('.swiper-slide').not('.is-clone').length || slides.length;
                }

                function clearHover() {
                    $products.find('.card').removeClass('is-hover');
                }

                function setHover(baseIdx) {
                    clearHover();
                    if (!baseCount) return;
                    $wrapper.children('.swiper-slide').each(function (i, el) {
                        if ((i % baseCount) === baseIdx) {
                            $(el).find('.card').addClass('is-hover');
                        }
                    });
                }

                function slideToBase(baseIdx, opts) {
                    refreshSlides();
                    if (!baseCount) return;
                    var total = slides.length;
                    var targetIdx = baseIdx + baseCount;
                    if (targetIdx >= total) targetIdx = baseIdx % baseCount;
                    var speed = opts && opts.instant ? 0 : SLIDE_SPEED;
                    swiper.slideTo(targetIdx, speed);
                    setHover(baseIdx % baseCount);
                    currentBase = baseIdx % baseCount;
                }

                function buildTimeline() {
                    if (typeof gsap === 'undefined') return;
                    refreshSlides();
                    if (!baseCount) return;
                    if (tl) tl.kill();
                    tl = gsap.timeline({
                        repeat: -1,
                        defaults: { ease: 'none' },
                        onRepeat: function () {
                            slideToBase(0, { instant: true });
                        }
                    });
                    for (var i = 0; i < baseCount; i++) {
                        (function (idx) {
                            tl.call(function () { slideToBase(idx, { instant: false }); });
                            tl.to({}, { duration: AUTO_DELAY });
                        })(i);
                    }
                }

                function pause() {
                    if (tl) tl.pause();
                    clearTimeout(restartTimer);
                }

                function resume(delayed) {
                    clearTimeout(restartTimer);
                    if (!tl) buildTimeline();
                    if (tl) {
                        if (delayed) {
                            restartTimer = setTimeout(function () { tl.play(); }, 800);
                        } else {
                            tl.play();
                        }
                    }
                }

                function refresh(restart) {
                    cloneSlides();
                    buildTimeline();
                    if (restart) resume(false);
                }

                function step(delta) {
                    refreshSlides();
                    if (!baseCount) return;
                    var next = (currentBase + delta + baseCount) % baseCount;
                    slideToBase(next, { instant: false });
                    resume(true);
                }

                function syncToActive() {
                    refreshSlides();
                    var idx = swiper.realIndex || swiper.activeIndex || 0;
                    var baseIdx = baseCount ? (idx % baseCount) : 0;
                    slideToBase(baseIdx, { instant: true });
                }

                return {
                    pause: pause,
                    resume: resume,
                    refresh: refresh,
                    step: step,
                    sync: syncToActive,
                    slideToBase: slideToBase
                };
            })();

            productAuto.refresh(true);
            productAuto.slideToBase(0, { instant: true });

            swiper.on('slideChange', function () {
                var idx = swiper.realIndex || swiper.activeIndex || 0;
                productAuto.slideToBase(idx % ($wrapper.children('.swiper-slide').not('.is-clone').length || 1), { instant: true });
                productAuto.resume(true);
            });
            swiper.on('slidesLengthChange loopFix', function () {
                productAuto.refresh(false);
            });
            swiper.on('touchStart', function () {
                productAuto.pause();
                $products.addClass('is-dragging');
                $products.removeClass('is-hovering is-hovering-other');
                $products.find('.card').removeClass('is-hover');
            });
            swiper.on('sliderMove', function () {
                $products.addClass('is-dragging');
                $products.removeClass('is-hovering is-hovering-other');
                $products.find('.card').removeClass('is-hover');
            });
            swiper.on('touchEnd', function () {
                $products.removeClass('is-dragging');
                productAuto.resume(true);
            });
            swiper.on('transitionStart', function () {
                productAuto.pause();
                $products.addClass('is-dragging');
            });
            swiper.on('transitionEnd', function () {
                $products.removeClass('is-dragging');
                productAuto.resume(true);
            });

            $products.on('mouseenter', '.card', function () {
                if ($products.hasClass('is-dragging')) return;
                productAuto.pause();
                var $slide = $(this).closest('.swiper-slide');
                var isActiveSlide = $slide.hasClass('swiper-slide-active');
                $products.addClass('is-hovering');
                $products.toggleClass('is-hovering-other', !isActiveSlide);
                $products.find('.card').removeClass('is-hover');
                $(this).addClass('is-hover');
            });
            $products.on('mouseleave', '.card', function () {
                if ($products.hasClass('is-dragging')) return;
                $products.find('.card').removeClass('is-hover');
                $products.removeClass('is-hovering');
                $products.removeClass('is-hovering-other');
                productAuto.sync();
                productAuto.resume(true);
            });

            $prevBtn.on('click', function () { productAuto.step(-1); });
            $nextBtn.on('click', function () { productAuto.step(1); });
        }

        function waitForSwiper(tries) {
            if (typeof Swiper !== 'undefined') {
                start();
                return;
            }
            if (tries <= 0) return;
            setTimeout(function () { waitForSwiper(tries - 1); }, SWIPER_RETRY_DELAY);
        }

        $(d).on('components:ready', start);
        $(w).on('load', start);
        waitForSwiper(SWIPER_RETRY_MAX);
    }

    /* Main scroll-driven animations */
    function mainAnimations() {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

        var reduceMotion = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var scrollerEl = (w.scrollInstance && w.scrollInstance.__isLoco && d.querySelector('[data-scroll-container]'))
            ? d.querySelector('[data-scroll-container]')
            : w;

        function makeTimeline(triggerConfig) {
            var cfg = triggerConfig || {};
            var st = Object.assign({ scroller: scrollerEl, toggleActions: 'play none none reverse' }, cfg);
            return gsap.timeline({
                defaults: { ease: 'power3.out' },
                scrollTrigger: st
            });
        }

        if (!reduceMotion && d.querySelector('.cont2')) {
            gsap.utils.toArray('.cont2').forEach(function (section) {
                var $section = $(section);
                var isMission = $section.find('.box2').length > 0;
                var $title = $section.find('.title-md');
                var $leftImg = $section.find('.left img');
                var $right = $section.find('.right');
                var $tabs = $section.find('.tabs .tab');
                var $cards = $section.find('.cards .card');
                var $diagram = $section.find('.diagram');

                var tl = makeTimeline({ trigger: section, start: 'top 70%' });

                if ($title.length) {
                    tl.from($title, {
                        duration: 0.65,
                        y: 28,
                        autoAlpha: 0
                    });
                }

                if ($leftImg.length) {
                    tl.from($leftImg, {
                        duration: 0.75,
                        x: isMission ? 70 : -60,
                        autoAlpha: 0
                    }, '-=0.35');
                }

                if ($right.length) {
                    tl.from($right, {
                        duration: 0.72,
                        y: 32,
                        autoAlpha: 0
                    }, '-=0.75');
                }

                if ($tabs.length) {
                    tl.from($tabs, {
                        duration: 0.5,
                        y: 12,
                        autoAlpha: 0,
                        stagger: 0.08,
                        ease: 'power2.out'
                    }, '-=0.55');
                }

                if ($cards.length) {
                    tl.from($cards, {
                        duration: 0.6,
                        y: 18,
                        autoAlpha: 0,
                        stagger: 0.07,
                        ease: 'power2.out'
                    }, '-=0.45');
                }

                if ($diagram.length) {
                    tl.from($diagram, {
                        duration: 0.7,
                        y: 18,
                        autoAlpha: 0
                    }, '-=0.45');
                }
            });
        }

        if (!reduceMotion && d.querySelector('.cont3')) {
            makeTimeline({ trigger: '.cont3', start: 'top 76%' })
                .from('.cont3 .section-header', {
                    duration: 0.7,
                    y: 30,
                    autoAlpha: 0
                })
                .from('.cont3 .products .card', {
                    duration: 0.75,
                    y: 30,
                    autoAlpha: 0,
                    stagger: 0.12,
                    ease: 'power2.out'
                }, '-=0.35');
        }

        if (!reduceMotion && d.querySelector('.cont4')) {
            makeTimeline({
                trigger: '.cont4',
                start: 'top 82%',
                toggleActions: 'play none none none'
            })
                .from('.cont4 .head', {
                    duration: 0.85,
                    y: 28,
                    autoAlpha: 0
                })
                .from('.cont4 .logos .logo', {
                    duration: 0.75,
                    y: 22,
                    autoAlpha: 0,
                    stagger: 0.08
                }, '-=0.35');

            makeTimeline({ trigger: '.cont4 .mapArea', start: 'top 78%' })
                .from('.cont4 .mapHead', {
                    duration: 0.75,
                    y: 24,
                    autoAlpha: 0
                })
                .from('.cont4 .mapLayers img:nth-child(1)', {
                    duration: 0.9,
                    autoAlpha: 0,
                    y: 120,
                    scale: 0.9
                }, '-=0.2')
                .from('.cont4 .mapLayers img:nth-child(2)', {
                    duration: 1,
                    autoAlpha: 0,
                    y: 140,
                    scale: 0.92,
                    rotation: 1.2
                }, '-=0.5')
                .from('.cont4 .mapLayers img:nth-child(3)', {
                    duration: 1.05,
                    autoAlpha: 0,
                    y: 80,
                    scale: 0.98,
                    rotation: -0.6
                }, '-=0.45');
        }

        if (!reduceMotion && d.querySelector('.cont5')) {
            makeTimeline({ trigger: '.cont5', start: 'top 80%' })
                .from('.cont5 .section-header', {
                    duration: 0.8,
                    y: 30,
                    autoAlpha: 0
                })
                .from('.cont5 .desc', {
                    duration: 0.7,
                    y: 20,
                    autoAlpha: 0
                }, '-=0.4')
                .from('.cont5 .card', {
                    duration: 0.9,
                    y: 32,
                    autoAlpha: 0,
                    stagger: 0.08,
                    ease: 'power2.out'
                }, '-=0.45')
                .from('.cont5 .card .badge', {
                    duration: 0.7,
                    y: 10,
                    autoAlpha: 0,
                    stagger: 0.05
                }, '-=0.55');
        }

        if (!reduceMotion && d.querySelector('.cont6')) {
            makeTimeline({ trigger: '.cont6', start: 'top 82%' })
                .from('.cont6 .title-md', {
                    duration: 0.95,
                    y: 30,
                    autoAlpha: 0
                })
                .from('.cont6 .item', {
                    duration: 1,
                    y: 36,
                    autoAlpha: 0,
                    stagger: 0.16,
                    ease: 'power2.out'
                }, '-=0.4');
        }

        (function bindResizeRefresh() {
            var timer = null;
            w.addEventListener('resize', function () {
                clearTimeout(timer);
                timer = setTimeout(function () {
                    ScrollTrigger.refresh();
                    w.scrollInstance?.update?.();
                }, 180);
            }, { passive: true });
        })();

        ScrollTrigger.refresh();
    }

    w.mainAnimations = mainAnimations;

    $(function () {
        initHero();
        initStage();
        initProducts();
    });
})(jQuery, window, document);

/* Section snap (cont1, cont2, cont3, cont4, cont5) */
(function ($, w, d) {
    if ((d.body?.dataset?.page || '') !== 'main') return;

    var SELECTOR = '.cont1, .cont2, .cont3, .cont4, .cont5';
    var DOWN_THRESH = 0.18;
    var UP_THRESH = 0.12;
    var MIN_DY = 2;
    var BREAKPOINT = 768;

    w.__snapOff = w.__snapOff || false;
    function snapDisabled() { return !!w.__snapOff; }
    w.__snapSetOff = function (v) { w.__snapOff = !!v; };

    function loco() { return (w.scrollInstance && w.scrollInstance.__isLoco) ? w.scrollInstance : null; }
    function curY(lc) { return lc.scroll?.instance?.scroll?.y || 0; }
    function absTop(lc, el) { return curY(lc) + el.getBoundingClientRect().top; }
    function headerH() { return parseInt(getComputedStyle(d.documentElement).getPropertyValue('--header-height')) || 0; }

    function visibleRatio(lc, el) {
        var vh = w.innerHeight, y = curY(lc);
        var r = el.getBoundingClientRect(), h = r.height || 1;
        var top = absTop(lc, el), bottom = top + h;
        var vTop = y, vBottom = y + vh;
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

    function build() {
        if (w.innerWidth < BREAKPOINT) return;
        var lc = loco(); if (!lc) return;
        var panels = Array.from(d.querySelectorAll(SELECTOR));
        if (!panels.length) return;

        var snapping = false;
        var lastY = curY(lc);

        function offsetFor(el) {
            return $(el).hasClass('cont1') ? -headerH() : 0;
        }

        function goTo(i) {
            if (i < 0 || i >= panels.length) return;
            snapping = true;
            w.__snapSetOff(true);
            lc.scrollTo(panels[i], {
                duration: 520,
                disableLerp: false,
                offset: offsetFor(panels[i]),
                callback: function () {
                    snapping = false;
                    lastY = curY(lc);
                    setTimeout(function () { w.__snapSetOff(false); }, 5);
                }
            });
        }

        function onScroll() {
            if (snapDisabled()) { lastY = curY(lc); return; }
            if (snapping) { lastY = curY(lc); return; }

            var y = curY(lc);
            var dy = y - lastY;
            if (Math.abs(dy) < MIN_DY) return;
            lastY = y;

            var curIdx = maxVisibleIndex(lc, panels);
            var forward = dy > 0;
            if (forward && curIdx >= panels.length - 1) return;
            if (!forward && curIdx <= 0) return;

            var target = forward ? Math.min(panels.length - 1, curIdx + 1) : Math.max(0, curIdx - 1);
            if (target === curIdx) return;
            var ratio = visibleRatio(lc, panels[target]);
            var thresh = forward ? DOWN_THRESH : UP_THRESH;

            if (curIdx === 0 && forward) thresh = Math.min(thresh, 0.08);
            if (curIdx === 1 && !forward) thresh = Math.min(thresh, 0.10);

            if (ratio >= thresh) { goTo(target); }
        }

        lc.on('scroll', onScroll);

        function alignNearest() {
            if (snapping || snapDisabled()) return;
            var idx = maxVisibleIndex(lc, panels);
            lc.scrollTo(panels[idx], { duration: 0, disableLerp: true, offset: offsetFor(panels[idx]) });
            lastY = curY(lc);
        }
        setTimeout(alignNearest, 0);

        function onResize() {
            if (w.innerWidth < BREAKPOINT) { cleanup(); return; }
            setTimeout(alignNearest, 120);
        }
        w.addEventListener('resize', onResize, { passive: true });

        function cleanup() {
            try { lc.off('scroll', onScroll); } catch (e) { }
            w.removeEventListener('resize', onResize);
        }

        w.__locoSnapDesktopCleanup && w.__locoSnapDesktopCleanup();
        w.__locoSnapDesktopCleanup = cleanup;
    }

    function init() {
        if (w.innerWidth < BREAKPOINT) return;
        if (loco()) { build(); return; }
        $(d).one('scrollengine:ready', function (_, e) {
            if (w.innerWidth >= BREAKPOINT && e?.engine === 'loco') build();
        });
    }

    w.addEventListener('resize', function () {
        if (w.innerWidth < BREAKPOINT) {
            w.__locoSnapDesktopCleanup && w.__locoSnapDesktopCleanup();
        } else {
            if (loco()) build();
        }
    }, { passive: true });

    $(init);
})(jQuery, window, document);
