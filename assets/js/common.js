/**
 * @description common.js —  Header/ Footer / Subtop / ScrollTop / Policy / ScrollEngine / Loader / Boot
 */

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
window.addEventListener('pageshow', (e) => {
    if (e.persisted) requestAnimationFrame(() => window.scrollTo(0, 0));
});

var scrollInstance = window.scrollInstance || null;
window.__headerBoot = true;
window.__snapOff = true;
var headerHideEnabled = !(document.body && document.body.dataset.page === 'main');
var headerStickyZones = null;
var headerStyleObserver = null;

function getSiteRoot() {
    const path = (window.location.pathname || '/').replace(/\\/g, '/');
    const segments = path.split('/').filter(Boolean);

    const pagesIndex = segments.lastIndexOf('pages');
    const segmentsToRoot = pagesIndex >= 0
        ? segments.slice(0, pagesIndex)
        : (segments.length && /\.[a-z0-9]+$/i.test(segments[segments.length - 1] || '') ? segments.slice(0, -1) : segments);

    return '/' + (segmentsToRoot.length ? segmentsToRoot.join('/') + '/' : '');
}

function normalizeRelativeUrl(value, siteRoot) {
    if (!value || /^(?:[a-z]+:|\/\/|#|data:|mailto:|tel:)/i.test(value) || value.startsWith('javascript:')) {
        return value;
    }

    const cleaned = value
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .replace(/^(?:\.\.\/)+/, '')
        .replace(/^\/+/, '');

    return new URL(cleaned, window.location.origin + siteRoot).href;
}

function normalizeComponentPaths() {
    const siteRoot = getSiteRoot();
    const scope = document.querySelectorAll('#header-container, #footer-container, #subtop-container, #cta-container');

    scope.forEach((container) => {
        container.querySelectorAll('[src], [href]').forEach((element) => {
            ['src', 'href'].forEach((attr) => {
                const value = element.getAttribute(attr);
                if (!value) return;
                if (/^(?:[a-z]+:|\/\/|#|data:|mailto:|tel:)/i.test(value) || value.startsWith('javascript:')) return;
                element.setAttribute(attr, normalizeRelativeUrl(value, siteRoot));
            });
        });
    });
}

/* ===== Components loader ===== */
async function loadComponents() {
    try {
        const siteRoot = getSiteRoot();
        const componentBase = new URL('components/', window.location.origin + siteRoot).href;

        const hasSubtop = !!$('#subtop-container').length;
        const hasCta = !!$('#cta-container').length;

        const [headerRes, footerRes, subtopRes, ctaRes] = await Promise.all([
            fetch(new URL('header.html', componentBase).href),
            fetch(new URL('footer.html', componentBase).href),
            hasSubtop ? fetch(new URL('sub-top.html', componentBase).href) : Promise.resolve({ text: async () => '' }),
            hasCta ? fetch(new URL('cta.html', componentBase).href) : Promise.resolve({ text: async () => '' })
        ]);

        $('#header-container').html(await headerRes.text());
        $('#footer-container').html(await footerRes.text());

        if (hasSubtop) $('#subtop-container').html(await subtopRes.text());
        if (hasCta) $('#cta-container').html(await ctaRes.text());

        normalizeComponentPaths();
        setHeaderActive();

        // fire ready event for async-bound modules
        $(document).trigger('components:ready');
        if (hasSubtop) window.Subtop?.init();
    } catch (err) {
        console.error(err);
    }
}

/* ====== Scroll engine (GSAP + Locomotive) ===== */
function initScroll(callback) {
    const $container = $("[data-scroll-container]");
    const isMobile = window.innerWidth <= 767;
    if (!$container.length) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ autoRefreshEvents: "DOMContentLoaded,load" });

    // connect proxy once
    const connectProxy = () => {
        const isLoco = !!(window.scrollInstance && window.scrollInstance.__isLoco);
        ScrollTrigger.scrollerProxy("[data-scroll-container]", {
            scrollTop(value) {
                if (arguments.length) {
                    scrollInstance.scrollTo(value, { duration: 0, disableLerp: true });
                } else {
                    return scrollInstance?.scroll?.instance?.scroll?.y ?? window.scrollY ?? 0;
                }
            },
            getBoundingClientRect() {
                return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
            },
            pinType: isLoco ? "transform" : "fixed"
        });
    };

    // Mobile: native scroll only
    if (isMobile || reduceMotion) {
        ScrollTrigger.defaults({ scroller: window });
        ScrollTrigger.refresh();
        callback?.();

        // light shim
        window.scrollInstance = {
            __isShim: true,
            on() { }, update() { }, stop() { }, start() { }, destroy() { },
            scrollTo(y, opts = {}) {
                const top = typeof y === "number" ? y : 0;
                window.scrollTo({ top, behavior: (opts.duration === 0 ? "auto" : "smooth") });
            },
            scroll: { instance: { scroll: { y: window.scrollY || 0 } } }
        };
        scrollInstance = window.scrollInstance;

        $(document).trigger('scrollengine:ready', { engine: 'shim' });

        // live upgrade when crossing breakpoint
        const mq = window.matchMedia("(min-width: 768px)");
        mq.addEventListener("change", (e) => {
            if (!e.matches || reduceMotion || window.scrollInstance?.__isLoco) return;

            window.scrollInstance = new LocomotiveScroll({
                el: $container[0],
                smooth: true,
                multiplier: 0.9,
                smartphone: { smooth: true },
                tablet: { smooth: true }
            });
            window.scrollInstance.__isLoco = true;
            scrollInstance = window.scrollInstance;

            scrollInstance.on("scroll", ScrollTrigger.update);
            connectProxy();
            ScrollTrigger.defaults({ scroller: $container[0] });

            requestAnimationFrame(() => {
                scrollInstance.update();
                ScrollTrigger.refresh();
            });

            $(document).trigger('scrollengine:ready', { engine: 'loco' });
        });
        return;
    }

    // Desktop: LocomotiveScroll
    window.scrollInstance = new LocomotiveScroll({
        el: $container[0],
        smooth: true,
        multiplier: 0.9,
        smartphone: { smooth: true },
        tablet: { smooth: true }
    });
    window.scrollInstance.__isLoco = true;
    scrollInstance = window.scrollInstance;

    scrollInstance.on("scroll", ScrollTrigger.update);
    connectProxy();
    ScrollTrigger.defaults({ scroller: $container[0] });

    $(document).trigger('scrollengine:ready', { engine: 'loco' });

    // keep sync minimal
    ScrollTrigger.addEventListener("refresh", () => scrollInstance?.update());

    callback?.();

    // settle after load
    window.addEventListener("load", () => {
        setTimeout(() => {
            requestAnimationFrame(() => {
                scrollInstance.update();
                ScrollTrigger.refresh();
            });
        }, 250);
    });

    // debounce resize
    let resizeTimeout;
    window.addEventListener("resize", () => {
        window.scrollInstance?.stop?.();
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            window.scrollInstance?.update?.();
            ScrollTrigger.refresh();
            requestAnimationFrame(() => {
                window.scrollInstance?.start?.();
            });
        }, 180);
    }, { passive: true });
}

/* ====== Header ===== */
function syncHeaderLogo(style, isAtTop) {
    const $logo = $('.header-left .logo img');
    if (!$logo.length) return;

    const defaultSrc = $logo.data('logo-default') || $logo.data('original') || $logo.attr('src');
    const transparentSrc = $logo.data('logo-transparent') || defaultSrc;
    const shouldUseLightLogo = style === 'transparent' || style === 'transparent-dark' || (document.body.dataset.page !== 'main' && isAtTop);
    const nextSrc = shouldUseLightLogo ? transparentSrc : defaultSrc;

    if ($logo.attr('src') !== nextSrc) {
        $logo.attr('src', nextSrc);
    }
}

function initSectionHeaderStyles() {
    if (headerStyleObserver) {
        headerStyleObserver.disconnect();
        headerStyleObserver = null;
    }

    if (!('IntersectionObserver' in window)) return;

    const header = document.querySelector('.main-header');
    if (!header) return;

    const getStyle = (section) => {
        if (section.classList.contains('header-white')) return 'white';
        if (section.classList.contains('header-transparent-dark')) return 'transparent-dark';
        if (section.classList.contains('header-transparent')) return 'transparent';
        if (section.dataset.headerStyle) return section.dataset.headerStyle;
        return null;
    };

    const sections = Array.from(document.querySelectorAll('[data-scroll-section] section'));
    const trackedSections = sections.filter(sec => !!getStyle(sec));
    if (!trackedSections.length) return;

    let currentStyle = null;

    const applyStyle = (style) => {
        if (currentStyle === style) return;
        currentStyle = style;

        header.classList.remove('is-transparent', 'is-white', 'is-transparent-dark');
        if (style === 'transparent') {
            header.classList.add('is-transparent');
        } else if (style === 'white') {
            header.classList.add('is-white');
        } else if (style === 'transparent-dark') {
            header.classList.add('is-white', 'is-transparent-dark');
        } else if (!style) {
            currentStyle = null;
        }

        syncHeaderLogo(style, false);
    };

    const observer = new IntersectionObserver((entries) => {
        const visible = entries
            .filter(entry => entry.isIntersecting)
            .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0));
        if (!visible.length) return;
        const style = getStyle(visible[0].target);
        if (style) applyStyle(style);
    }, { threshold: [0.35, 0.65, 0.9] });

    trackedSections.forEach(section => observer.observe(section));
    headerStyleObserver = observer;
}

/* ===== Subtabs dropdown (subtop) ===== */
function initSubtabsDropdown() {
    const $dropdown = document.querySelector('[data-subtabs].subtabs-dropdown');
    if (!$dropdown) return;

    const $toggle = $dropdown.querySelector('.subtabs-toggle');
    const $list = $dropdown.querySelector('.subtabs-list');
    const $label = $dropdown.querySelector('.subtabs-label');

    if (!$toggle || !$list || !$label) return;

    function close() {
        $dropdown.classList.remove('is-open');
        $toggle.setAttribute('aria-expanded', 'false');
    }

    function open() {
        $dropdown.classList.add('is-open');
        $toggle.setAttribute('aria-expanded', 'true');
    }

    function toggle() {
        const isOpen = $dropdown.classList.contains('is-open');
        isOpen ? close() : open();
    }

    $toggle.addEventListener('click', function (e) {
        e.preventDefault();
        toggle();
    });

    $list.addEventListener('click', function (e) {
        const link = e.target.closest('a');
        if (!link) return;
        e.preventDefault();
        const text = link.textContent.trim();
        $label.textContent = text;
        $list.querySelectorAll('[aria-selected="true"]').forEach(el => el.setAttribute('aria-selected', 'false'));
        link.setAttribute('aria-selected', 'true');
        close();
        const href = link.getAttribute('href');
        if (href && href !== '#') {
            window.location.href = href;
        }
    });

    document.addEventListener('click', function (e) {
        if (!$dropdown.contains(e.target)) close();
    });
}
$(function () {
    var lastY = 0
    var ticking = false;
    var FORCE_COMPACT = (document.body.dataset.header === 'compact');

    function $hdr() { return $('.main-header'); }

    // top show all, scroll menu only
    function setState(y) {
        var atTop = y <= 5;
        var IS_MAIN = (document.body.dataset.page === 'main');
        var $h = $hdr(); if (!$h.length) return;

        if (FORCE_COMPACT) {
            var $img = $('.header-left .logo img');
            var isDesktop = window.matchMedia('(min-width:1025px)').matches;
            if ($img.length && !$img.attr('data-default')) {
                $img.attr('data-default', $img.attr('src'));
            }

            if (atTop) {
                $h.addClass('is-compact').removeClass('is-scroll');
                if ($img.length && isDesktop) {
                    $img.attr('src', $img.attr('data-header') || $img.attr('data-default'));
                }
            } else {
                $h.removeClass('is-compact').addClass('is-scroll');
                if ($img.length && isDesktop) {
                    $img.attr('src', $img.attr('data-default'));
                }
            }
            return;
        }

        if (atTop) $h.removeClass('is-scroll');
        else $h.addClass('is-scroll');

        // subpages: keep header transparent at top, white after scroll
        if (!IS_MAIN) {
            const nextStyle = atTop ? 'transparent' : 'white';
            if (!$h.hasClass('is-transparent') && nextStyle === 'transparent') {
                $h.addClass('is-transparent').removeClass('is-white');
            }
            if (!$h.hasClass('is-white') && nextStyle === 'white') {
                $h.removeClass('is-transparent').addClass('is-white');
            }
            if (($h.hasClass('is-transparent') && nextStyle === 'white') || ($h.hasClass('is-white') && nextStyle === 'transparent')) {
                $h.toggleClass('is-transparent', nextStyle === 'transparent');
                $h.toggleClass('is-white', nextStyle === 'white');
            }

            syncHeaderLogo(nextStyle, atTop);
        }
    }

    // scroll down hide, scroll up show
    function setHide(y) {
        var $h = $hdr(); if (!$h.length) return;

        // keep header visible on main sections 3/4/5 (desktop only)
        function inStickyZone() {
            if ((document.body?.dataset?.page || '') !== 'main') return false;
            if (window.matchMedia('(max-width: 767px)').matches) return false;
            if (!headerStickyZones) {
                headerStickyZones = $('.cont3, .cont4, .cont5').toArray();
            }
            if (!headerStickyZones.length) return false;
            return headerStickyZones.some(function (el) {
                var r = $(el)[0].getBoundingClientRect();
                return r.bottom > 0 && r.top < window.innerHeight;
            });
        }

        // block during boot
        if (window.__headerBoot) {
            $h.removeClass('hide-header');
            lastY = y;
            return;
        }
        if (!headerHideEnabled || inStickyZone()) {
            $h.removeClass('hide-header');
            lastY = y;
            return;
        }

        if (y > lastY + 10) $h.addClass('hide-header');
        else if (y < lastY - 10) $h.removeClass('hide-header');
        lastY = y;
    }

    // apply with rAF
    function onY(y) {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
            setState(y);
            setHide(y);
            ticking = false;
        });
    }

    // native scroll
    function bindNative() {
        $(window).on('scroll.header', function () {
            onY(window.scrollY || 0);
        });
        onY(window.scrollY || 0);
    }

    // locomotive scroll
    function bindLoco() {
        var loco = window.scrollInstance;
        if (!loco || !loco.__isLoco) return false;
        loco.on('scroll', function (e) {
            onY((e && e.scroll && e.scroll.y) || 0);
        });
        onY(loco.scroll?.instance?.scroll?.y || 0);
        return true;
    }

    if (!bindLoco()) bindNative();
    $(document).on('scrollengine:ready', function (_, d) {
        if (d?.engine === 'loco') {
            $(window).off('scroll.header');
            bindLoco();
        }
    });

    // refresh
    $(document).on('components:ready', function () {
        var y = (window.scrollInstance?.__isLoco)
            ? (window.scrollInstance?.scroll?.instance?.scroll?.y || 0)
            : (window.scrollY || 0);

        onY(y);
        bindMobileOverlay();

        // allow hide after first settle
        setTimeout(function () {
            window.__headerBoot = false;
        }, 80);

        setLangActive();
        // Update header style
        initSectionHeaderStyles();
    });

    // highlight current language
    function setLangActive() {
        var $links = $('.lang-link[data-lang]');
        if (!$links.length) return;

        var target = window.IS_EN ? 'en' : 'ko';

        $links.removeClass('is-active').removeAttr('aria-current');
        $links.filter('[data-lang="' + target + '"]').first()
            .addClass('is-active')
            .attr('aria-current', 'page');
    }

    function buildLangPath(forceEN) {
        var path = location.pathname;
        var isCurrentlyEn = window.IS_EN;

        if (forceEN && !isCurrentlyEn) {
            path = '/en' + (path.startsWith('/') ? path : '/' + path);
        } else if (!forceEN && isCurrentlyEn) {
            path = path.replace(/^\/en(\/|$)/, '/');
        }

        if (!path.startsWith('/')) path = '/' + path;
        return path + location.search + location.hash;
    }

    setLangActive();

    // click language toggle
    $(document).off('click.langswap').on('click.langswap', '.lang-link[data-lang]', function (e) {
        e.preventDefault();
        var wantEn = $(this).data('lang') === 'en';

        if (wantEn === window.IS_EN) return; // already on requested language
        location.href = buildLangPath(wantEn);
    });

    function openMobileNav() {
        $('body').addClass('nav-open');
        $('.nav-toggle').attr('aria-expanded', 'true');
        // lock background scroll while overlay is open
        if (window.scrollInstance?.stop) {
            window.scrollInstance.stop();
        }
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
    }

    function closeMobileNav() {
        $('body').removeClass('nav-open');
        $('.nav-toggle').attr('aria-expanded', 'false');
        if (window.scrollInstance?.start) {
            window.scrollInstance.start();
        }
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
    }

    function bindMobileOverlay() {
        var $overlay = $('.overlay .menu-list');
        if (!$overlay.length || $overlay.data('built')) return;
        $overlay.empty();
        $('.main-nav .menu-item').each(function () {
            var $item = $(this);
            var $link = $item.children('a').first();
            var label = ($link.text() || '').trim();
            var href = $link.attr('href') || '#';
            var $submenu = $item.find('.submenu li a');
            var $entry = $('<div class="drawer-item"></div>');
            var $toggle = $('<button type="button" class="drawer-toggle"></button>')
                .attr('data-href', href)
                .text(label);
            $entry.append($toggle);
            if ($submenu.length) {
                var $panel = $('<div class="drawer-panel"></div>');
                $submenu.each(function () {
                    var $sub = $('<a class="drawer-link"></a>')
                        .attr('href', $(this).attr('href'))
                        .text($(this).text().trim());
                    $panel.append($sub);
                });
                $entry.append($panel);
            }
            $overlay.append($entry);
        });
        $overlay.data('built', true);
    }

    // click nav toggle
    $(document).on('click', '.nav-toggle', function (e) {
        e.stopPropagation();
        if ($('body').hasClass('nav-open')) {
            closeMobileNav();
        } else {
            openMobileNav();
        }
    });

    $(document).on('click', '.overlay .inner', function (e) {
        e.stopPropagation();
    });

    $(document).on('click', '.overlay .close-btn', function (e) {
        e.stopPropagation();
        closeMobileNav();
    });

    $(document).on('click', '.overlay .drawer-toggle', function (e) {
        var $toggle = $(this);
        var $item = $toggle.closest('.drawer-item');
        var $panel = $item.find('.drawer-panel');
        var href = $toggle.data('href');

        // Overlay drawer titles should only toggle; navigation happens via drawer-link.
        if ($panel.length) {
            e.preventDefault();
            $item.toggleClass('is-open');
        } else if (href && href !== '#') {
            closeMobileNav();
            window.location.href = href;
        }
    });

    $(document).on('click', '.overlay .drawer-link, .overlay .contact-button', function () {
        closeMobileNav();
    });

    // click inside menu
    $(document).on('click', '.main-nav', function (e) {
        e.stopPropagation();
    });

    // close when menu link clicked
    $(document).on('click', '.main-nav .menu-item > a', function () {
        closeMobileNav();
    });

    // disable auto-close on scroll or outer clicks to prevent accidental closing while overlay is open
});

/* ===== Desktop menu hover stay-open ===== */
(function () {
    var mq = window.matchMedia('(min-width: 1025px)');
    var timers = new WeakMap();

    function addHover($item) {
        $item.addClass('is-hovered');
    }

    function removeHover($item) {
        $item.removeClass('is-hovered');
    }

    function bind() {
        $('.main-nav .menu-item').each(function () {
            var $item = $(this);
            var $submenu = $item.find('.submenu');

            function clearTimer() {
                var t = timers.get($item[0]);
                if (t) {
                    clearTimeout(t);
                    timers.delete($item[0]);
                }
            }

            function delayedRemove() {
                clearTimer();
                timers.set($item[0], setTimeout(function () {
                    removeHover($item);
                }, 120));
            }

            $item.on('mouseenter.desktopmenu focusin.desktopmenu', function () {
                clearTimer();
                addHover($item);
            });
            $item.on('mouseleave.desktopmenu focusout.desktopmenu', delayedRemove);
            $submenu.on('mouseenter.desktopmenu', function () {
                clearTimer();
                addHover($item);
            });
            $submenu.on('mouseleave.desktopmenu', delayedRemove);
        });
    }

    function unbind() {
        $('.main-nav .menu-item').each(function () {
            var $item = $(this);
            var $submenu = $item.find('.submenu');
            $item.removeClass('is-hovered');
            $item.off('.desktopmenu');
            $submenu.off('.desktopmenu');
        });
    }

    function handle() {
        if (mq.matches) {
            unbind();
            bind();
        } else {
            unbind();
        }
    }

    mq.addEventListener('change', handle);
    $(document).on('components:ready', handle);
})();

/* ===== Header Active ===== */
function setHeaderActive() {
    // page cat
    const rawCat = document.body.dataset.category || '';
    if (!rawCat) return;

    const want = rawCat.trim().toUpperCase();
    const $hdr = $('.main-header');
    if (!$hdr.length) return;

    // all menu items
    const $items = $hdr.find('.main-nav .menu-item');

    // clear old state
    $items.removeClass('is-active')
        .find('a')
        .removeAttr('aria-current');

    // set match item
    $items.each(function () {
        const $li = $(this);
        const $a = $li.find('a').first();
        const label = ($a.text() || '').trim().toUpperCase();

        if (label === want) {
            $li.addClass('is-active');
            $a.attr('aria-current', 'page');
        }
    });
}

/* ===== Subtop ===== */
window.Subtop = (function () {
    function init() {
        const $host = $('#subtop-container');
        if (!$host.length) return;

        const cat = (document.body.dataset.category || '').trim();
        const cur = (document.body.dataset.current || document.body.dataset.title || '').trim();
        const bg = (document.body.dataset.bg || '').trim();

        const $subtop = $host.find('.subtop').first();
        if (!$subtop.length) return;

        const bindHorizontalScroll = ($el) => {
            if (!$el.length) return;
            $el.off('wheel.subtabs').on('wheel.subtabs', function (e) {
                const evt = e.originalEvent;
                if (!evt) return;
                const canScroll = this.scrollWidth > this.clientWidth + 1;
                if (!canScroll) return;
                const dy = evt.deltaY || 0;
                const dx = evt.deltaX || 0;
                if (Math.abs(dy) <= Math.abs(dx)) return;
                this.scrollLeft += dy;
                e.preventDefault();
            });
        };

        // build nav items from header menu
        const $menuItems = $('.main-nav .menu-item');
        let $targetMenu = $();
        $menuItems.each(function () {
            const label = ($(this).children('a').first().text() || '').trim();
            if (label.toLowerCase() === cat.toLowerCase()) {
                $targetMenu = $(this);
            }
        });

        const $submenuLinks = $targetMenu.find('.submenu li a');

        // breadcrumb
        const $crumbCategory = $subtop.find('.subtop-category');
        const $crumbCurrent = $subtop.find('.subtop-current');
        if ($crumbCategory.length) {
            const catText = cat || ($targetMenu.length ? $targetMenu.children('a').first().text().trim() : '');
            if (catText) {
                $crumbCategory.text(catText).attr('href', $targetMenu.children('a').attr('href') || '#');
            } else {
                $crumbCategory.remove();
            }
        }
        if ($crumbCurrent.length) {
            $crumbCurrent.text(cur || document.title || '').attr('href', '#');
        }

        // title
        const $title = $subtop.find('.subtop-title');
        if ($title.length) {
            $title.text(cur || document.title || '');
        }

        // tabs
        const $tabs = $subtop.find('.subtabs');
        const $dropdown = $subtop.find('[data-subtabs].subtabs-dropdown');
        const $list = $dropdown.find('.subtabs-list');
        const $label = $dropdown.find('.subtabs-label');
        $tabs.empty();
        $list.empty();

        if ($submenuLinks.length) {
            let activeLabel = cur;

            $submenuLinks.each(function () {
                const label = ($(this).text() || '').trim();
                const href = $(this).attr('href') || '#';
                const isActive = label.toLowerCase() === cur.toLowerCase();

                // desktop tabs
                const $a = $('<a></a>').attr('href', href).text(label);
                if (isActive) {
                    $a.addClass('is-active').attr('aria-current', 'page');
                    activeLabel = label;
                }
                $tabs.append($a);

                // mobile dropdown list
                const $li = $('<li></li>');
                const $option = $('<a></a>')
                    .attr('href', href)
                    .attr('role', 'option')
                    .attr('aria-selected', isActive ? 'true' : 'false')
                    .text(label);
                $li.append($option);
                $list.append($li);
            });

            // set dropdown label to active or first item
            if ($label.length) {
                const firstLabel = $submenuLinks.first().text().trim();
                $label.text(activeLabel || firstLabel || '');
            }

            $subtop.find('.subtop-nav').show();
            bindHorizontalScroll($tabs);
        } else {
            $subtop.find('.subtop-nav').hide();
        }

        // background
        if (bg) {
            $subtop.css('background-image', 'url(' + bg + ')');
        }

        // reveal once
        const io = new IntersectionObserver(function (entries, ob) {
            entries.forEach(function (e) {
                if (e.isIntersecting) {
                    $subtop.addClass('visible');
                    ob.unobserve(e.target);
                }
            });
        }, { threshold: 0.25 });

        io.observe($subtop[0]);
    }
    return { init: init };
})();

/* ===== Scroll-to-top button ===== */
$(function () {
    const $btn = $("#scrollTopBtn");
    if (!$btn.length) return;

    $btn.on("click", function () {
        // turn snap off
        // stop snap now
        if (typeof window.__snapSetOff === 'function') {
            window.__snapSetOff(true);
        }

        if (window.scrollInstance?.__isLoco) {
            window.scrollInstance.scrollTo(0, {
                duration: 800,
                disableLerp: false,
                callback: function () {
                    // turn snap back on
                    setTimeout(function () {
                        if (typeof window.__snapSetOff === 'function') {
                            window.__snapSetOff(false);
                        }
                    }, 80); // small delay
                }
            });
        } else {
            // native scroll
            window.scrollTo({ top: 0, behavior: "smooth" });

            // re-enable snap after short wait
            setTimeout(function () {
                if (typeof window.__snapSetOff === 'function') {
                    window.__snapSetOff(false);
                }
            }, 400);
        }
    });

    const applyToggle = (y) => {
        const show = y >= 50;
        $btn.toggleClass("show", show);
    };

    const onWindowScroll = () => applyToggle(window.scrollY || 0);
    window.addEventListener("scroll", onWindowScroll, { passive: true });
    onWindowScroll();

    const bindLoco = () => {
        const loco = window.scrollInstance;
        if (!loco || !loco.__isLoco) return;
        loco.on("scroll", ({ scroll }) => applyToggle(scroll?.y || 0));
        applyToggle(loco.scroll?.instance?.scroll?.y || 0);
    };
    bindLoco();

    $(document).on("scrollengine:ready", (_, data) => {
        if (data?.engine === "loco") {
            bindLoco();
        } else if (data?.engine === "shim") {
            onWindowScroll();
        }
    });
});

/* ===== Boot sequence ===== */
$(async function () {
    await loadComponents();

    initSubtabsDropdown();

    initScroll(() => {
        switch (document.body.dataset.page) {
            case 'main':
                $('.main-section').imagesLoaded(() => {
                    if (typeof mainAnimations === 'function') mainAnimations();
                    scrollInstance.update(); ScrollTrigger.refresh();
                    scrollInstance.scrollTo(0, { duration: 0, disableLerp: true });
                });
                break;
        }

        window.Reveal?.init();
        window.AutoVideo?.init();
        ScrollTrigger.refresh();

        // allow snap after boot
        setTimeout(function () {
            window.__snapOff = false;
        }, 400);

    });

    // forced refresh hook
    if (sessionStorage.getItem('forceScrollRefresh') === 'true') {
        sessionStorage.removeItem('forceScrollRefresh');
        $('[data-scroll-container]').imagesLoaded(() => {
            requestAnimationFrame(() => {
                ScrollTrigger.refresh();
                window.scrollInstance?.update();
            });
        });
    }
});

/*  ==== Tabby hook ==== */
$(document).on('tabby', function (e) {
    const panel = e.originalEvent?.detail?.content;
    if (!panel) return;

    const $p = $(panel);
    const sel = '.reveal-up, .reveal-left, .reveal-right, .reveal-group, .reveal-item, .reveal-zoomwide, .reveal-zoomimg, .reveal-fade .hl-ink';

    $p.find(sel).each(function () {
        $(this).removeData('revealBound')
            .css({ opacity: '', transform: '', clipPath: '', '-webkit-clip-path': '' })
            .removeClass('is-zoomed visible');
    });

    $p.find('.reveal-zoomimg').each(function () {
        const img = this.querySelector('img, picture img, .zoom-target');
        if (img) img.style.removeProperty('transform');
    });

    $p.find('.hl-ink .hl-ink-bar').each(function () {
        this.style.removeProperty('transform');
    });

    window.Reveal?.init();
    window.scrollInstance?.update?.();
    window.ScrollTrigger?.refresh?.();
});

/* ===== Reveal - Scroll-Up + Slide L/R + Zoom ===== */
(function () {
    const SELECTOR_SINGLE = '.reveal-up';
    const SELECTOR_GROUP = '.reveal-group';
    const CHILD_SELECTOR = '.reveal-item';
    const SELECTOR_LEFT = '.reveal-left';
    const SELECTOR_RIGHT = '.reveal-right';
    const SELECTOR_ZOOMWIDE = '.reveal-zoomwide';
    const SELECTOR_FADE = '.reveal-fade';
    const SELECTOR_ZOOMIMG = '.reveal-zoomimg';
    const SELECTOR_INK = '.hl-ink';

    // reduced motion
    const isReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // bind guard
    function bound(el) { if (!el || $(el).data('revealBound')) return true; $(el).data('revealBound', 1); return false; }

    function scroller() {
        return (window.scrollInstance?.__isLoco
            ? $('[data-scroll-container]').get(0)
            : window) || window;
    }

    // single item
    function makeSingle(el) {
        if (bound(el)) return;
        gsap.set(el, { y: 100, autoAlpha: 0 });
        ScrollTrigger.create({
            trigger: el,
            scroller: scroller(),
            start: 'top 88%',
            onEnter: () => gsap.to(el, {
                y: 0,
                autoAlpha: 1,
                duration: 1.5,
                ease: 'power3.out'
            }),
            once: true
        });
    }

    // group items
    function makeGroup(group) {
        if (bound(group)) return;

        const $group = $(group);
        const $items = $group.find(CHILD_SELECTOR);
        if (!$items.length) return;

        const $splitTargets = $group.find('.split-text');

        $splitTargets.each(function () {
            splitCharsOnce($(this));
        });

        const $descEl = $splitTargets.eq(0);
        const $headEl = $splitTargets.eq(1);

        gsap.set($items, { y: 120, autoAlpha: 0 });

        ScrollTrigger.create({
            trigger: group,
            scroller: scroller(),
            start: 'top 70%',
            onEnter: () => {
                gsap.to($items, {
                    y: 0,
                    autoAlpha: 1,
                    duration: 1.4,
                    ease: 'power3.out',
                    stagger: 0.4
                });

                if ($splitTargets.length === 0) {
                    return;
                }

                if ($splitTargets.length === 1) {
                    playSplitSequence($descEl, $descEl);
                    return;
                }

                playSplitSequence($descEl, $headEl);
            },
            once: true
        });
    }

    // horizontal reveal
    function makeHSingle(el, dir) {
        if (bound(el)) return;
        const dist = Number(el?.dataset?.distance || 160);
        const dur = Number(el?.dataset?.duration || 0.9);

        gsap.set(el, { x: dist * dir, autoAlpha: 0 });
        ScrollTrigger.create({
            trigger: el,
            scroller: scroller(),
            start: 'top 80%',
            onEnter: () => gsap.to(el, {
                x: 0,
                autoAlpha: 1,
                duration: dur,
                ease: 'power2.out',
                clearProps: 'transform,opacity'
            })
        });
    }

    // image expand + zoom 
    function makeZoomWide(el) {
        if (bound(el)) return;

        const fromClip = 'polygon(15% 0%, 85% 0%, 85% 100%, 15% 100%)';
        const toClip = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';

        gsap.set(el, {
            clipPath: fromClip,
            overflow: 'hidden',
            css: { '-webkit-clip-path': fromClip }
        });

        const tl = gsap.timeline({ paused: true });
        tl.to(el, {
            clipPath: toClip,
            ease: 'none',
            duration: 1,
            css: { '-webkit-clip-path': toClip }
        }, 0);

        ScrollTrigger.create({
            trigger: el,
            scroller: scroller(),
            start: 'top 85%',
            end: 'top center',
            scrub: 1.2,
            animation: tl
        });

        ScrollTrigger.create({
            trigger: el,
            scroller: scroller(),
            start: 'top center',
            end: '+=1',
            toggleActions: 'play none none reverse',
            onEnter: () => el.classList.add('is-zoomed'),
            onEnterBack: () => el.classList.add('is-zoomed'),
            onLeaveBack: () => el.classList.remove('is-zoomed')
        });
    }

    // image zoom 
    function makeZoomImg(el) {
        if (bound(el)) return;

        const img = el.querySelector('img, picture img');
        if (!img) return;

        const scaleTo = Number(el?.dataset?.scale || 1.4);
        const startPos = el?.dataset?.start || 'top 75%';
        const endPos = el?.dataset?.end || 'top 35%';

        gsap.set(img, { scale: 1, transformOrigin: 'center center', willChange: 'transform' });

        const tween = gsap.to(img, { scale: scaleTo, ease: 'none', paused: true });

        ScrollTrigger.create({
            trigger: el,
            scroller: scroller(),
            start: startPos,
            end: endPos,
            scrub: 0.8,
            animation: tween
        });
    }

    // fade
    function makeFade(el) {
        if (bound(el)) return;
        gsap.set(el, { autoAlpha: 0 });
        ScrollTrigger.create({
            trigger: el,
            scroller: scroller(),
            start: 'top 80%',
            onEnter: () => gsap.to(el, {
                autoAlpha: 1,
                duration: 0.7,
                ease: 'power3.out',
                clearProps: 'opacity,visibility'
            }),
            once: true
        });
    }

    // underline
    function makeInk(el) {
        let bar = el.querySelector('.hl-ink-bar');
        if (!bar) {
            bar = document.createElement('span');
            bar.className = 'hl-ink-bar';
            const color = el.getAttribute('data-color');
            if (color) bar.style.background = color;
            el.appendChild(bar);
        }

        gsap.set(bar, { scaleX: 0.05, skewX: -10, transformOrigin: '0 50%' });

        ScrollTrigger.create({
            trigger: el,
            scroller: scroller(),
            start: 'top 85%',
            once: true,
            onEnter: () => gsap.to(bar, {
                delay: Number(el.getAttribute('data-delay') || 0.18),
                duration: Number(el.getAttribute('data-duration') || 0.55),
                ease: 'power2.out',
                scaleX: 1, skewX: -2
            })
        });
    }

    // split element text into spans
    function splitCharsOnce($el) {
        if ($el.data('splitDone')) return;
        $el.data('splitDone', 1);

        var raw = $el.text().replace(/\s+/g, ' ').trim();
        var html = '';
        for (var i = 0; i < raw.length; i++) {
            var ch = raw[i] === ' ' ? '&nbsp;' : raw[i];
            html += '<span class="char">' + ch + '</span>';
        }
        $el.html(html);
    }

    // play staggered reveal
    function playSplitSequence($descEl, $headEl) {
        var $descChars = $descEl.find('.char');
        var $headChars = $headEl.find('.char');

        var perChar = 25;
        var gapNext = 120;

        $descChars.each(function (i) {
            var $c = $(this);
            setTimeout(function () {
                $c.addClass('is-in');
            }, i * perChar);
        });

        var baseDelay = ($descChars.length * perChar) + gapNext;
        $headChars.each(function (i) {
            var $c = $(this);
            setTimeout(function () {
                $c.addClass('is-in');
            }, baseDelay + i * perChar);
        });
    }

    function init() {
        const force = !!$('body').data('revealForce');
        if (isReduce && !force) return;

        $(SELECTOR_SINGLE).each((_, el) => makeSingle(el));
        $(SELECTOR_GROUP).each((_, el) => makeGroup(el));
        $(SELECTOR_LEFT).each((_, el) => makeHSingle(el, -1));
        $(SELECTOR_RIGHT).each((_, el) => makeHSingle(el, 1));
        $(SELECTOR_ZOOMWIDE).each((_, el) => makeZoomWide(el));
        $(SELECTOR_FADE).each((_, el) => makeFade(el));
        $(SELECTOR_ZOOMIMG).each((_, el) => makeZoomImg(el));
        $(SELECTOR_INK).each((_, el) => makeInk(el));
    }

    window.Reveal = {
        init, refresh: () => {                // manual refresh
            ScrollTrigger.refresh();
            window.scrollInstance?.update?.();
        }
    };
})();

/* ===== Tilt+Glare =====  */
(function () {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (reduce || isTouch) return;

    // Global mouse cache 
    var mouse = { x: 0, y: 0 };
    $(window).on('mousemove.tg', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; });

    function hexToRgb(str) {
        if (!str) return [255, 255, 255];
        if (/^rgb/i.test(str)) { var m = (str.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number); return (m.length === 3 ? m : [255, 255, 255]); }
        var c = str.replace('#', '').trim(); if (c.length === 3) c = c.split('').map(function (x) { return x + x; }).join('');
        if (c.length !== 6) return [255, 255, 255]; var n = parseInt(c, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function bind($el) {
        if ($el.data('tgBound')) return; $el.data('tgBound', 1);
        if (!$el.attr('tabindex')) $el.attr('tabindex', '0');

        // Create glare layer once
        var $g = $el.children('.tg-glare');
        if (!$g.length) $g = $('<span class="tg-glare" aria-hidden="true"></span>').appendTo($el);

        // Optional tint
        var tint = $el.data('tint');
        if (tint) {
            var rgb = hexToRgb(tint);
            $g.css('background', 'radial-gradient(90px 90px at center, rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',.35), transparent 60%)');
        }

        // Strength 
        var RX = Number($el.data('rx')) || 6;
        var RY = Number($el.data('ry')) || 8;

        // Lerp state
        var ax = 0, ay = 0, gx = -9999, gy = -9999, raf = 0, active = false;

        function loop() {
            if (!active) return;
            var r = $el[0].getBoundingClientRect();
            var px = mouse.x - r.left, py = mouse.y - r.top;
            var nx = (px / r.width) - 0.5;
            var ny = (py / r.height) - 0.5;

            // Target angles
            var tx = -ny * RX;
            var ty = nx * RY;

            // Lerp for smoothness
            ax += (tx - ax) * 0.22;
            ay += (ty - ay) * 0.22;

            // Apply transforms
            $el[0].style.transform = 'translateZ(0) rotateX(' + ax + 'deg) rotateY(' + ay + 'deg)';

            // Glare position 
            var tgx = px - 80, tgy = py - 80;
            gx += (tgx - gx) * 0.25;
            gy += (tgy - gy) * 0.25;
            $g[0].style.transform = 'translate(' + gx + 'px,' + gy + 'px)';

            raf = requestAnimationFrame(loop);
        }

        $el.on('mouseenter.tg focusin.tg', function () {
            active = true; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
        });
        $el.on('mouseleave.tg focusout.tg', function () {
            active = false; cancelAnimationFrame(raf);
            ax = ay = 0; $el[0].style.transform = 'translateZ(0)';
        });
    }

    function init(root) {
        (root ? $(root) : $(document)).find('.tilt-glare').each(function () { bind($(this)); });
    }

    $(document).on('components:ready', function () { init(); });
    window.TiltGlareInit = init;
})();
