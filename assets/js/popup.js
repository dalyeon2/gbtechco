/**
 * @description Popup (EN + KR)
 */

// check language
var IS_EN = !!window.IS_EN;

// text map
var POPUP_I18N = {
    en: {
        deny: (h) => `Don't show again for ${h} hour${h === 1 ? '' : 's'}`,
        close: 'Close',
        loadFail: 'Failed to load popup.'
    },
    kr: {
        deny: (h) => `${h}시간 동안 다시 보지 않기`,
        close: '닫기',
        loadFail: '팝업을 불러오지 못했습니다.'
    }
};

// selected text
var QT = IS_EN ? POPUP_I18N.en : POPUP_I18N.kr;

/* Popup logic */
(function () {
    const w = window;
    const API_URL = '/api/popup.php';

    // change text
    function applyPopupI18N(ctx = document) {
        $(ctx).find('.pops_footer [data-i18n]').each(function () {
            const $el = $(this);
            const key = $el.data('i18n');

            if (key === 'deny') {
                const clsHrs = parseInt(($el.attr('class') || '').split(' ')[2] || '0', 10);
                const hrsAttr = parseInt($el.data('hours'), 10);
                const hrs = Number.isFinite(hrsAttr) && hrsAttr > 0 ? hrsAttr
                    : (Number.isFinite(clsHrs) && clsHrs > 0 ? clsHrs : 24);
                $el.text(QT.deny(hrs));
            } else if (key === 'close') {
                $el.text(QT.close);
            }
        });
    }

    // check loco scroll
    function isLoco() {
        return !!(w.scrollInstance && w.scrollInstance.__isLoco && w.innerWidth > 767);
    }

    // open popup
    function openLayer() {
        $('body').addClass('popup-open');
        $('.popup-dim').removeAttr('hidden').addClass('show');
        if (isLoco()) w.scrollInstance.stop();
    }

    // close popup
    function closeLayer() {
        $('body').removeClass('popup-open');
        $('.popup-dim').addClass('hide');
        setTimeout(() => {
            $('.popup-dim').removeClass('show hide').attr('hidden', '');
        }, 200);
        if (isLoco()) w.scrollInstance.start();
    }

    // set cookie
    function setCookie(name, value, hours, domain) {
        const d = new Date();
        d.setTime(d.getTime() + hours * 3600000);
        let c = `${name}=${encodeURIComponent(value)}; path=/; expires=${d.toUTCString()};`;
        if (domain) c += ` domain=${domain};`;
        document.cookie = c;
    }

    // bind ui
    function bindEvents() {
        const domain = $('#popup-root').data('cookie-domain') || '';

        // click "don't show"
        $(document).on('click', '.pops_reject', function () {
            const cls = $(this).attr('class').split(' ');
            const key = cls[1];
            const hrs = parseInt(cls[2] || '24', 10);
            $('#' + key).hide();
            setCookie(key, 1, hrs, domain);
            if (!$('.pops:visible').length) closeLayer();
        });

        // click "close"
        $(document).on('click', '.pops_close', function () {
            const key = $(this).attr('class').split(' ')[1];
            $('#' + key).hide();
            if (!$('.pops:visible').length) closeLayer();
        });

        // click dim
        $(document).on('click', '.popup-dim', function () {
            $('.pops').hide();
            closeLayer();
        });

        // press ESC
        $(document).on('keydown', function (e) {
            if (e.key === 'Escape') {
                $('.pops').hide();
                closeLayer();
            }
        });

        // show layer if exists
        if ($('.pops:visible').length) openLayer();
    }

    // load popup html
    async function loadPopup() {
        try {
            const lang = IS_EN ? 'en' : 'ko';
            const res = await fetch(`${API_URL}?lang=${lang}`, { credentials: 'same-origin' });
            const html = (await res.text()).trim();
            if (!html) return;

            const host = document.createElement('div');
            host.id = 'popup-container';
            document.body.appendChild(host);
            host.innerHTML = html;

            applyPopupI18N(host);
            bindEvents();
        } catch (e) {
            console.warn(QT.loadFail, e);
        }
    }

    // init popup
    $(function () {
        loadPopup();
        applyPopupI18N(document);
    });

})();
