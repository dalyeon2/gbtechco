/**
 * sub0601: clickable locations -> update map iframe
 */
$(function () {
    var $items = $('.cont1 .item');
    var $map = $('#locationMap');
    var $mapWrap = $('.map-wrap');
    var mapAnimTimer;
    if (!$items.length || !$map.length) return;

    function playMapAnimation() {
        $map.removeClass('is-animating');
        void $map[0].offsetWidth;
        $map.addClass('is-animating');
        clearTimeout(mapAnimTimer);
        mapAnimTimer = setTimeout(function () {
            $map.removeClass('is-animating');
        }, 650);
    }

    function setActive($target) {
        var nextSrc = $target.data('map');
        if (!nextSrc || $target.hasClass('is-active')) return;

        $items.removeClass('is-active').attr('aria-pressed', 'false');
        $target.addClass('is-active').attr('aria-pressed', 'true');

        // visual feedback
        $mapWrap.addClass('is-loading');
        $map.off('load.mapSwap').on('load.mapSwap', function () {
            $mapWrap.removeClass('is-loading');
            playMapAnimation();
        });
        $map.attr('src', nextSrc);
    }

    $items.each(function () {
        var $item = $(this);
        if (!$item.attr('aria-pressed')) $item.attr('aria-pressed', $item.hasClass('is-active') ? 'true' : 'false');
    });

    $items.on('click', function () {
        setActive($(this));
    });

    $items.on('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setActive($(this));
        }
    });

    $map.on('load.mapInit', function () {
        $mapWrap.removeClass('is-loading');
        playMapAnimation();
        $map.off('load.mapInit');
    });
});
