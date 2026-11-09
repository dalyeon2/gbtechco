/**
 * sub0302 (Global Country Map)
 * Section 1: layered map reveal + inline SVG hover
 */
$(function () {
    const $mapObj = $('.cont1 .mapLayers .map-name');
    const svgUrl = $mapObj.attr('data') || $mapObj.attr('data-src') || $mapObj.attr('src');

    function initMapReveal() {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        if (!$('.cont1 .mapArea').length) return;
        // avoid duplicate timelines
        if (window._cont1MapTl && window._cont1MapTl.kill) {
            window._cont1MapTl.kill();
        }
        const scrollerEl = (window.scrollInstance && window.scrollInstance.__isLoco && document.querySelector('[data-scroll-container]'))
            ? document.querySelector('[data-scroll-container]')
            : window;

        window._cont1MapTl = gsap.timeline({
            defaults: { ease: 'power2.out' },
            scrollTrigger: {
                trigger: '.cont1 .mapArea',
                start: 'top 78%',
                scroller: scrollerEl
            }
        })
            .from('.cont1 .mapLayers img:nth-child(1)', {
                duration: 0.9,
                autoAlpha: 0,
                y: 120,
                scale: 0.9
            })
            .from('.cont1 .mapLayers img:nth-child(2)', {
                duration: 1,
                autoAlpha: 0,
                y: 140,
                scale: 0.92,
                rotation: 1.2
            }, '-=0.4')
            .from('.cont1 .mapLayers img:nth-child(3)', {
                duration: 1.05,
                autoAlpha: 0,
                y: 80,
                scale: 0.98,
                rotation: -0.6
            }, '-=0.35')
            .from('.cont1 .mapLayers .map-name-svg', {
                duration: 0.9,
                autoAlpha: 0,
                y: 30,
                scale: 0.96
            }, '-=0.35');
    }

    if (!$mapObj.length) {
        initMapReveal();
        return;
    }
    if (!svgUrl) {
        initMapReveal();
        return;
    }

    $.ajax({
        url: svgUrl,
        dataType: 'xml'
    }).done(function (data) {
        const $svg = $(data).find('svg').first();
        if ($svg.length) {
            $svg.addClass('map-name-svg');
            $mapObj.replaceWith($svg);
        }
        initMapReveal();
    }).fail(function () {
        initMapReveal();
    });
});
