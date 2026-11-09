/**
 * sub0503 (R&D New Product Launching)
 * Section 1: image slider
 */
$(function () {
    var $slider = $('.img-slider');
    if (!$slider.length || typeof gsap === 'undefined') return;

    var $wrapper = $slider.find('.track');
    var resizeTimer = null;

    function getBaseSlides() {
        return $wrapper.children('.item').not('.is-clone');
    }

    function getSetWidth($els) {
        var total = 0;
        $els.each(function () { total += $(this).outerWidth(true); });
        return total;
    }

    function buildMarquee() {
        if (!$wrapper.length) return;

        gsap.killTweensOf($wrapper);
        $wrapper.find('.is-clone').remove();

        var $slides = getBaseSlides();
        if (!$slides.length) return;

        $slides.clone(true).addClass('is-clone').appendTo($wrapper);

        var setWidth = getSetWidth($slides);
        if (!setWidth) return;

        gsap.set($wrapper, { x: 0 });
        var duration = Math.max(setWidth / 70, 12);

        gsap.to($wrapper, {
            x: -setWidth,
            duration: duration,
            ease: 'none',
            repeat: -1,
            onRepeat: function () {
                gsap.set($wrapper, { x: 0 });
            }
        });
    }

    function initMarquee() {
        if (typeof $.fn.imagesLoaded === 'function') {
            $slider.imagesLoaded(buildMarquee);
        } else {
            buildMarquee();
        }
    }

    initMarquee();

    $(window).on('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(initMarquee, 200);
    });
});
