/**
 * sub0504 (Certification)
 * Pagination: 12 items per page
 */
$(function () {
    var ITEMS_PER_PAGE = 12;
    var $section = $('.cont1');
    var $list = $section.find('.certification');
    var $pagination = $section.find('.pagination');
    var $prev = $pagination.find('.prev');
    var $next = $pagination.find('.next');
    var $pages = $pagination.find('.pages');

    if (!$list.length) return;

    var baseItems = $list.children('.item').toArray().map(function (el) {
        return $(el).clone(true, true);
    });
    var state = { page: 1 };

    render();
    bind();

    function bind() {
        $prev.on('click', function () {
            if (state.page <= 1) return;
            state.page -= 1;
            render();
        });

        $next.on('click', function () {
            var totalPages = getTotalPages();
            if (state.page >= totalPages) return;
            state.page += 1;
            render();
        });

        $pages.on('click', '.page', function () {
            var target = Number($(this).data('page')) || 0;
            if (!target || target === state.page) return;
            state.page = target;
            render();
        });
    }

    function render() {
        var totalPages = getTotalPages();
        state.page = Math.min(Math.max(state.page, 1), totalPages);

        var start = (state.page - 1) * ITEMS_PER_PAGE;
        var end = start + ITEMS_PER_PAGE;
        var pageItems = baseItems.slice(start, end);

        $list.empty();
        pageItems.forEach(function ($item) {
            $list.append($item.clone(true, true));
        });

        buildPages(totalPages);
        $prev.prop('disabled', state.page <= 1);
        $next.prop('disabled', state.page >= totalPages);

        if (typeof window.scrollInstance?.update === 'function') {
            requestAnimationFrame(function () { window.scrollInstance.update(); });
        } else if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger.refresh) {
            ScrollTrigger.refresh();
        }
    }

    function buildPages(total) {
        if (!$pages.length) return;
        $pages.empty();
        for (var i = 1; i <= total; i++) {
            $('<span/>', {
                'class': 'page' + (i === state.page ? ' active' : ''),
                text: i,
                'data-page': i
            }).appendTo($pages);
        }
    }

    function getTotalPages() {
        return Math.max(1, Math.ceil(baseItems.length / ITEMS_PER_PAGE));
    }
});
