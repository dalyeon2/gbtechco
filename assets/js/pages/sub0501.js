/**
 * sub0501 (Patents/Projects)
 */
function refreshScrollEngine() {
    if (window.scrollInstance && typeof window.scrollInstance.update === 'function') {
        requestAnimationFrame(function () {
            window.scrollInstance.update();
            if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger.refresh) {
                ScrollTrigger.refresh();
            }
        });
    } else if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger.refresh) {
        ScrollTrigger.refresh();
    }
}

/* Section 1: Patents (tabs/pagination/tooltips) */
$(function () {
    var ITEMS_PER_PAGE = 12;

    var $section = $('.cont1');
    var $tabs = $section.find('.tab');
    var $allLists = $section.find('.list');
    var $renderList = $allLists.first();
    var $sourceLists = $allLists.filter('[data-tab], [id^="tab-"]');
    var $navPrev = $section.find('.prev-btn');
    var $navNext = $section.find('.next-btn');
    var $infoTitle = $section.find('.info .title');
    var $infoCount = $section.find('.info .count');

    if (!$renderList.length) return;

    var baseItems = collectItems($renderList.find('.item'));
    var tabItems = buildTabItems(baseItems);
    var state = { tab: 0, page: 1 };

    var tippyInstances = [];
    var fallbackState = { layer: null, text: null, activeTitle: null };
    var scrollSync = { handler: null, locoBound: false };

    render();
    bindControls();

    /* Tabs & pagination */
    function bindControls() {
        $tabs.on('click', function () {
            var idx = $tabs.index(this);
            if (idx === -1 || idx === state.tab) return;
            state.tab = idx;
            state.page = 1;
            render();
        });

        $navPrev.on('click', function () {
            if (state.page <= 1) return;
            state.page -= 1;
            render();
        });

        $navNext.on('click', function () {
            var items = tabItems[state.tab] || [];
            var totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
            if (state.page >= totalPages) return;
            state.page += 1;
            render();
        });
    }

    function render() {
        teardownTooltips();

        var items = tabItems[state.tab] || [];
        var totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
        state.page = Math.min(Math.max(state.page, 1), totalPages);

        $tabs.removeClass('active').eq(state.tab).addClass('active');

        var start = (state.page - 1) * ITEMS_PER_PAGE;
        var end = start + ITEMS_PER_PAGE;
        var pageItems = items.slice(start, end);

        $renderList.empty();
        pageItems.forEach(function (item) {
            $renderList.append(buildItem(item));
        });

        $navPrev.prop('disabled', state.page <= 1);
        $navNext.prop('disabled', state.page >= totalPages);

        var tabLabel = $tabs.eq(state.tab).text().trim();
        if (tabLabel) $infoTitle.text(tabLabel);
        $infoCount.text(formatCount(items.length));

        initTooltips();
        refreshScrollEngine();
    }

    /* Data helpers */
    function collectItems($domItems) {
        var items = [];
        $domItems.each(function (idx) {
            var $item = $(this);
            items.push({
                num: ($item.find('.num').text() || '').trim() || formatNum(idx),
                title: ($item.find('.title').text() || '').trim(),
                date: ($item.find('.date').text() || '').trim()
            });
        });
        return items;
    }

    function buildTabItems(base) {
        var normalized = [];
        var provided = Array.isArray(window.Sub0501Data) ? window.Sub0501Data : null;
        var hasSourceLists = $sourceLists.length > 0;

        $tabs.each(function (idx) {
            var itemsForTab;

            if (hasSourceLists) {
                var $src = findSourceList(idx);
                itemsForTab = collectItems($src.find('.item'));
            } else if (provided && Array.isArray(provided[idx])) {
                itemsForTab = normalizeItems(provided[idx]);
            } else {
                itemsForTab = base;
            }

            normalized.push(normalizeItems(itemsForTab));
        });

        if (hasSourceLists) {
            $sourceLists.not($renderList).hide();
        }

        return normalized;

        function findSourceList(idx) {
            var $byData = $sourceLists.filter('[data-tab="' + idx + '"]');
            if ($byData.length) return $byData.first();

            var $byId = $sourceLists.filter('#tab-' + (idx + 1));
            if ($byId.length) return $byId.first();

            return $sourceLists.first();
        }
    }

    function normalizeItems(items) {
        return (items || []).map(function (item, idx) {
            return {
                num: (item && (item.num || item.number || item.no)) || formatNum(idx),
                title: (item && item.title) || '',
                date: (item && item.date) || ''
            };
        }).filter(function (item) { return !!item.title; });
    }

    function formatNum(idx) {
        var n = idx + 1;
        return 'No.' + (n < 10 ? '0' + n : n);
    }

    function formatCount(n) {
        return n + ' as of today';
    }

    function buildItem(item) {
        var $li = $('<li/>', { 'class': 'item' });
        $('<div/>', { 'class': 'num', text: item.num || '' }).appendTo($li);
        $('<div/>', { 'class': 'title', text: item.title || '' }).appendTo($li);
        $('<div/>', { 'class': 'date', text: item.date || '' }).appendTo($li);
        return $li;
    }

    /* Tooltips */
    function teardownTooltips() {
        if (tippyInstances.length) {
            tippyInstances.forEach(function (inst) { inst.destroy && inst.destroy(); });
            tippyInstances = [];
        }
        if (fallbackState.layer) {
            fallbackState.layer.remove();
            fallbackState = { layer: null, text: null, activeTitle: null };
        }
        $renderList.off('.patentTooltip');
        setScrollSync(null);
    }

    function initTooltips() {
        var $items = $renderList.find('.item');
        if (!$items.length) return;

        if (typeof tippy === 'function' && typeof window.createPopper === 'function') {
            initTippy($items);
        } else {
            initFallback($items);
        }
    }

    function initTippy($items) {
        $items.each(function () {
            var $item = $(this);
            var $title = $item.find('.title');
            var fullText = ($title.text() || '').trim();
            if (!$title.length || !fullText) return;

            var instance = tippy($title.get(0), {
                content: createTooltipContent(fullText),
                allowHTML: true,
                placement: 'bottom-start',
                theme: 'patent',
                maxWidth: 924,
                offset: [0, 10],
                appendTo: document.body,
                interactive: false,
                touch: ['hold', 250],
                getReferenceClientRect: function () {
                    var node = $title.get(0);
                    return node ? node.getBoundingClientRect() : null;
                }
            });

            tippyInstances.push(instance);
        });

        setScrollSync(function updateTippyPositions() {
            tippyInstances.forEach(function (inst) {
                if (inst && inst.popperInstance) {
                    inst.popperInstance.update();
                }
            });
        });
    }

    function initFallback($items) {
        if (!fallbackState.layer) {
            fallbackState.layer = $('<div/>', {
                'class': 'tooltip-layer',
                'aria-hidden': 'true'
            }).append(
                $('<div/>', { 'class': 'patent-tooltip' }).append(
                    $('<div/>', { 'class': 'tooltip-text' })
                )
            ).appendTo('body').hide();

            fallbackState.text = fallbackState.layer.find('.tooltip-text');
        }

        var $tooltip = fallbackState.layer;
        var $text = fallbackState.text;
        var padding = 20;

        $renderList.off('.patentTooltip');

        function positionTooltip($title) {
            var rect = $title.get(0).getBoundingClientRect();
            var top = rect.bottom + 8;
            var left = rect.left;

            $tooltip.show();

            var bubbleWidth = $tooltip.outerWidth();
            var viewportWidth = $(window).width();

            if (left + bubbleWidth > viewportWidth - padding) {
                left = viewportWidth - bubbleWidth - padding;
            }
            if (left < padding) {
                left = padding;
            }

            $tooltip.css({ top: top, left: left });
        }

        function showTooltip($target) {
            var $title = $target.find('.title');
            var fullText = ($title.text() || '').trim();
            if (!$title.length || !fullText) return;

            fallbackState.activeTitle = $title;
            $text.text(fullText);
            positionTooltip($title);
            $tooltip.attr('aria-hidden', 'false');
        }

        function hideTooltip() {
            fallbackState.activeTitle = null;
            $tooltip.attr('aria-hidden', 'true').hide();
        }

        $renderList.on('mouseenter.patentTooltip focusin.patentTooltip', '.item', function () {
            showTooltip($(this));
        });

        $renderList.on('mouseleave.patentTooltip focusout.patentTooltip', '.item', hideTooltip);
        $renderList.on('touchstart.patentTooltip', '.item', function () {
            showTooltip($(this));
        });

        setScrollSync(function () {
            if (fallbackState.activeTitle && $tooltip.is(':visible')) {
                positionTooltip(fallbackState.activeTitle);
            }
        });
    }

    function setScrollSync(fn) {
        scrollSync.handler = fn;
        $(window).off('.patentScrollSync');
        if (fn) {
            $(window).on('scroll.patentScrollSync resize.patentScrollSync', fn);
        }
        bindLocoScroll();
    }

    function bindLocoScroll() {
        if (scrollSync.locoBound) return;
        if (window.scrollInstance && typeof window.scrollInstance.on === 'function') {
            window.scrollInstance.on('scroll', function () {
                if (typeof scrollSync.handler === 'function') scrollSync.handler();
            });
            scrollSync.locoBound = true;
        }
    }

    $(document).on('scrollengine:ready.patentScrollSync', bindLocoScroll);

    function createTooltipContent(text) {
        var wrapper = document.createElement('div');
        wrapper.className = 'patent-tooltip';

        var content = document.createElement('div');
        content.className = 'tooltip-text';
        content.textContent = text;

        wrapper.appendChild(content);
        return wrapper;
    }
});

/* Section 2: table clamp */
$(function () {
    var MAX = 100;
    var $rows = $('.cont2 .project tbody tr');
    if (!$rows.length) return;

    var resizeTimer;

    function ensureClip($first) {
        var $clip = $first.children('.project-cell-clip');
        if (!$clip.length) {
            $clip = $('<div/>', { 'class': 'project-cell-clip' });
            $clip.append($first.contents());
            $first.append($clip);
        }
        return $clip;
    }

    function applyClamp() {
        var isWide = window.innerWidth > 768;

        $rows.each(function () {
            var $row = $(this);
            var $first = $row.children('td:first-child');
            var hasMultiple = $row.children('td').length > 1;
            if (!$first.length || !hasMultiple) return;

            var $clip = ensureClip($first);

            if (isWide) {
                var padTop = parseFloat($first.css('padding-top')) || 0;
                var padBottom = parseFloat($first.css('padding-bottom')) || 0;
                var clipMax = Math.max(0, MAX - Math.round(padTop + padBottom));
                $clip.css({ maxHeight: clipMax + 'px', overflow: 'hidden' });
                $first.css({ height: MAX + 'px' });
            } else {
                $clip.css({ maxHeight: '', overflow: '' });
                $first.css({ height: '' });
            }
        });

        refreshScrollEngine();
    }

    applyClamp();

    $(window).on('resize.cont2Clamp', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(applyClamp, 120);
    });
});
