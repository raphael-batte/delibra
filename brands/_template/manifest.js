/* Минимальный бренд. Существует ради одного вопроса: движок правда отделён?
   Если галерея открывается с этим манифестом, значит SDM в движке не осталось.
   Locale не задан — интерфейс поднимется на английском пакете. */
window.BRAND_MANIFEST = {
  id: '_template',
  title: 'Template Design System',
  version: '0.1.0',
  engine: 1,

  css: {
    tokens:     'tokens.css',
    components: 'components.css'
  },

  specs:       'sections.js',
  tokenMap:    'token-map.js',
  legacyNames: null,
  assetsBase:  'assets/',

  font: {
    family: "system-ui, -apple-system, sans-serif",
    href:   null                       // системный шрифт: ничего не грузим
  },

  breakpoints: { mobile: 900, desktopMin: 901 },
  preview:     { mobileWidth: 390, desktopWidth: 1280, container: 1120 },

  compare: { legacy: null }
};
