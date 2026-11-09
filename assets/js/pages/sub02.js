/**
 * Products (sub02) interactions
 */
(function ($) {
    var isBoundWin = false;
    var isBoundLoco = false;
    var $section, $left, $right;
    var startY = 0, maxShift = 0, headerH = 0;
    var lastShift = -1;

    function isDesktop() {
        return window.innerWidth > 1024;
    }

    function isProductsPage() {
        return (document.body.dataset.category || '').toLowerCase() === 'products';
    }

    function getScrollY() {
        if (window.scrollInstance?.__isLoco) {
            return window.scrollInstance?.scroll?.instance?.scroll?.y || 0;
        }
        return window.scrollY || 0;
    }

    function recalc() {
        if (!$section || !$section.length) return;
        headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
        var rightTop = $right.offset().top;
        var rightH = $right.outerHeight();
        var leftH = $left.outerHeight();
        startY = rightTop - headerH - 10;
        maxShift = Math.max(0, rightH - leftH);
    }

    function apply(y) {
        if (!$left) return;
        if (!isDesktop()) {
            $left.css('transform', 'translate3d(0,0,0)');
            lastShift = 0;
            return;
        }
        var delta = y - startY;
        var shift = Math.max(0, Math.min(delta, maxShift));
        if (shift === lastShift) return;
        lastShift = shift;
        $left.css('transform', 'translate3d(0,' + shift + 'px,0)');
    }

    function bindScroll() {
        if (window.scrollInstance?.__isLoco) {
            if (isBoundLoco) return;
            isBoundLoco = true;
            window.scrollInstance.on('scroll', function (e) {
                apply((e && e.scroll && e.scroll.y) || 0);
            });
            apply(getScrollY());
            return;
        }
        if (isBoundWin) return;
        isBoundWin = true;
        $(window).on('scroll.productHeadline', function () {
            apply(getScrollY());
        });
        apply(getScrollY());
    }

    function initProductHeadline() {
        if (!isProductsPage()) return;
        $section = $('.cont1');
        $left = $section.find('.left');
        $right = $section.find('.right .list');
        if (!$left.length || !$right.length) return;

        // reset transform
        $left.css('transform', 'translate3d(0,0,0)');
        lastShift = 0;

        var refreshLayout = function () {
            recalc();
            apply(getScrollY());
        };

        // wait for images to settle to avoid jump
        if ($section.imagesLoaded) {
            $section.imagesLoaded(refreshLayout);
        } else {
            refreshLayout();
        }

        bindScroll();
        applyRevealClasses();
    }

    function applyRevealClasses() {
        if (!isProductsPage()) return;
        var $cont = $('.cont1');
        if (!$cont.length) return;
        // remove reveal classes to avoid scroll jank on fast scroll
        $cont.find('.reveal-up, .reveal-group, .reveal-item')
            .removeClass('reveal-up reveal-group reveal-item');
    }

    function initProductPopup() {
        if (!isProductsPage()) return;

        var $popup = $('.productpopup');
        if (!$popup.length || $popup.data('bound')) return;
        $popup.data('bound', 1);

        var $frame = $popup.find('.frame');
        var $title = $popup.find('.name');
        var $desc = $popup.find('.desc');
        var $pic = $popup.find('.pic');
        var $action = $popup.find('.action');
        var pdfWorkerReady = false;
        var renderKey = 0;
        var activePdf = '';
        var resizeTimer = 0;
        var prevOverflow = { html: '', body: '' };

        function ensurePdfWorker() {
            if (!window.pdfjsLib) return false;
            if (!pdfWorkerReady) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                pdfWorkerReady = true;
            }
            return true;
        }

        function setStatus(text) {
            $frame.html('<p class="status">' + text + '</p>');
        }

        function renderPdf(url) {
            if (!ensurePdfWorker()) {
                setStatus('Viewer is unavailable.');
                return;
            }

            var currentKey = ++renderKey;
            activePdf = url;
            setStatus('Loading document...');

            var container = $frame[0];
            var baseWidth = container?.clientWidth || 1;

            window.pdfjsLib.getDocument(url).promise.then(function (pdf) {
                if (currentKey !== renderKey) return;
                $frame.empty();

                var queue = Promise.resolve();
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
                    queue = queue.then(function () {
                        return pdf.getPage(pageNum).then(function (page) {
                            if (currentKey !== renderKey) return;

                            var viewport = page.getViewport({ scale: 1 });
                            var scale = (baseWidth - 24) / viewport.width;
                            scale = Math.min(1.5, Math.max(0.6, scale));

                            var scaled = page.getViewport({ scale: scale });
                            var pageWrap = document.createElement('div');
                            pageWrap.className = 'page';
                            pageWrap.style.width = scaled.width + 'px';
                            pageWrap.style.height = scaled.height + 'px';

                            var canvas = document.createElement('canvas');
                            var context = canvas.getContext('2d', { alpha: false });
                            var outputScale = window.devicePixelRatio || 1;
                            canvas.width = Math.floor(scaled.width * outputScale);
                            canvas.height = Math.floor(scaled.height * outputScale);
                            canvas.style.width = scaled.width + 'px';
                            canvas.style.height = scaled.height + 'px';
                            if (outputScale !== 1) {
                                context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
                            }

                            var textLayer = document.createElement('div');
                            textLayer.className = 'textLayer';

                            pageWrap.appendChild(canvas);
                            pageWrap.appendChild(textLayer);
                            if (currentKey !== renderKey) return;
                            container.appendChild(pageWrap);

                            return page.render({ canvasContext: context, viewport: scaled }).promise
                                .then(function () {
                                    return page.getTextContent();
                                })
                                .then(function (textContent) {
                                    if (currentKey !== renderKey) return;
                                    window.pdfjsLib.renderTextLayer({
                                        textContent: textContent,
                                        container: textLayer,
                                        viewport: scaled,
                                        textDivs: []
                                    });
                                });
                        });
                    });
                }
                return queue;
            }).catch(function (err) {
                if (currentKey !== renderKey) return;
                setStatus('Failed to load file.');
                console.warn(err);
            });
        }

        function lockPage() {
            if (window.scrollInstance?.stop) {
                window.scrollInstance.stop();
            }
            prevOverflow.html = document.documentElement.style.overflow || '';
            prevOverflow.body = document.body.style.overflow || '';
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
        }

        function unlockPage() {
            if (window.scrollInstance?.start) {
                window.scrollInstance.start();
            }
            document.documentElement.style.overflow = prevOverflow.html;
            document.body.style.overflow = prevOverflow.body;
        }

        function openPopup(data) {
            if (!data || !data.pdf) return;
            if ($popup.attr('aria-hidden') === 'false') return;

            $title.text(data.name || '');
            if (data.desc) {
                $desc.text(data.desc).show();
            } else {
                $desc.text('').hide();
            }
            if (data.img) {
                $pic.attr('src', data.img).attr('alt', data.name || '');
            } else {
                $pic.removeAttr('src').attr('alt', '');
            }
            $action.attr('href', data.pdf);
            $action.attr('target', '_blank');
            $action.attr('rel', 'noopener');
            $action.removeAttr('download');

            $popup.attr('aria-hidden', 'false');
            lockPage();
            requestAnimationFrame(function () {
                renderPdf(data.pdf);
            });
            var $close = $popup.find('.close');
            if ($close.length) $close.trigger('focus');
        }

        function closePopup() {
            if ($popup.attr('aria-hidden') === 'true') return;
            $popup.attr('aria-hidden', 'true');
            renderKey += 1;
            activePdf = '';
            $frame.empty();
            unlockPage();
        }

        $popup.on('click.productpopup', '.back, .close', function (e) {
            e.preventDefault();
            closePopup();
        });

        $(document).off('keydown.productpopup').on('keydown.productpopup', function (e) {
            if (e.key === 'Escape') closePopup();
        });

        $(document).off('click.productpopup').on('click.productpopup', '.cont1 .card .btn', function (e) {
            var $btn = $(this);
            if ($btn.hasClass('is-disabled') || $btn.attr('aria-disabled') === 'true') return;

            var href = $btn.attr('href') || '';
            if (!/\.pdf(\?|#|$)/i.test(href)) return;
            e.preventDefault();

            var $card = $btn.closest('.card');
            var name = $.trim($card.find('.name').first().text());
            var desc = $.trim($card.find('.desc').first().text());
            var img = $card.find('.thumb img').first().attr('src') || '';

            openPopup({ pdf: href, name: name, desc: desc, img: img });
        });

        $(window).on('resize.productpopup', function () {
            if ($popup.attr('aria-hidden') === 'true' || !activePdf) return;
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                if ($popup.attr('aria-hidden') === 'true' || !activePdf) return;
                renderPdf(activePdf);
            }, 220);
        });
    }

    $(document).on('components:ready', function () {
        initProductHeadline();
        applyRevealClasses();
        initProductPopup();
    });

    $(document).on('scrollengine:ready', function () {
        recalc();
        apply(getScrollY());
        bindScroll();
        applyRevealClasses();
    });

    $(window).on('resize', function () {
        recalc();
        apply(getScrollY());
        applyRevealClasses();
    });

    // run once on load in case components:ready already fired
    $(function () {
        initProductHeadline();
        applyRevealClasses();
        initProductPopup();
    });
})(jQuery);
