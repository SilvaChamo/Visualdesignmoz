(function () {
  var API_BASE = window.AAMIHE_NEWS_API || 'https://visualdesignmoz.com/api/public/site-news';
  var lang = document.documentElement.lang || 'pt';
  lang = lang.toLowerCase().startsWith('en') ? 'en' : lang.toLowerCase().startsWith('fr') ? 'fr' : 'pt';

  function text(value) {
    return String(value || '').replace(/[<>&"]/g, function (char) {
      return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[char];
    });
  }

  function findNewsGrid() {
    var headings = Array.prototype.slice.call(document.querySelectorAll('h2'));
    var heading = headings.find(function (node) {
      var value = (node.textContent || '').trim().toLowerCase();
      return value === 'notícias' || value === 'noticias' || value === 'news';
    });
    if (!heading) return null;

    var section = heading.closest('.e-con, section, div');
    return section ? section.querySelector('.jet-listing-grid__items') : null;
  }

  function render(items) {
    var grid = findNewsGrid();
    if (!grid || !items.length) return;

    grid.innerHTML = items.map(function (item) {
      var image = item.image_url
        ? 'style="background-image:url(' + text(item.image_url) + ');background-size:cover;background-position:center;"'
        : '';
      var date = item.published_at ? new Date(item.published_at).toLocaleDateString() : '';

      return '' +
        '<div class="jet-listing-grid__item jet-equal-columns aamihe-live-news">' +
          '<div class="elementor elementor-8475">' +
            '<div class="elementor-element e-con-full e-flex e-con e-parent">' +
              '<div class="elementor-element e-con-full e-flex e-con e-child" ' + image + ' style="min-height:220px;' + (item.image_url ? 'background-image:url(' + text(item.image_url) + ');background-size:cover;background-position:center;' : 'background:#f3f4f6;') + '"></div>' +
              '<div class="elementor-element e-con-full e-flex e-con e-child" style="padding:24px;background:#fff;">' +
                '<div class="jet-listing jet-listing-dynamic-link"><a href="#news-' + text(item.slug) + '" class="jet-listing-dynamic-link__link"><span class="jet-listing-dynamic-link__label">' + text(item.title) + '</span></a></div>' +
                '<div class="elementor-widget-text-editor" style="margin-top:12px;"><p>' + text(item.excerpt) + '</p></div>' +
                '<div style="margin-top:14px;font-size:12px;color:#92754c;font-weight:700;">' + text(date) + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  fetch(API_BASE + '?site_slug=aamihe&lang=' + encodeURIComponent(lang) + '&limit=4')
    .then(function (response) { return response.json(); })
    .then(function (data) {
      if (data && data.success && Array.isArray(data.news)) render(data.news);
    })
    .catch(function (error) {
      console.warn('[AAMIHE News] Falha ao carregar notícias dinâmicas:', error);
    });
})();
