/* Манифест бренда. Движок не знает про SDM ничего сверх этого файла.
   Все пути — относительно папки бренда, движок сам приводит их к абсолютным. */
window.BRAND_MANIFEST = {
  id: 'sdm',
  title: 'SDM Design System',
  version: '0.2.0',
  engine:  1,          // мажор контракта движка, который понимает этот бренд
  locale: 'ru',

  css: {
    tokens:     'tokens.css',
    components: 'sdm.css'
  },

  specs:       'sections.js',
  tokenMap:    'token-map.js',      // данные токен-секций, рисует их движок
  legacyNames: 'legacy.js',         // как те же токены зовутся в боевом коде
  assetsBase:  'assets/',

  font: {
    family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    href:   'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
  },

  breakpoints: { mobile: 900, desktopMin: 901 },
  preview:     { mobileWidth: 390, desktopWidth: 1440, container: 1170 },

  /* Сравнение с чужим CSS опционально и в ядро бренда не входит:
     файл приносит разработчик через шапку. */
  compare: { legacy: null }
};
