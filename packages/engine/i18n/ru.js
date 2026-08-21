/* Русский пак. Не обязан быть полным: недостающие ключи движок берёт из en. */
window.ENGINE_I18N = window.ENGINE_I18N || {};
window.ENGINE_I18N.ru = {
  'topbar.defaultTitle':    'Дизайн-система и компоненты сайта',
  'topbar.attach':          'Приложить CSS',
  'topbar.attach.title':    'Приложить CSS-файл, с которым сравнивать дизайн-систему',
  'topbar.compare':         'Сравнить с кодом',
  'topbar.compare.hint':    'Приложите CSS, чтобы включить сравнение',
  'topbar.compare.title':   'Сравнить дизайн-систему с {file}',
  'topbar.readFailed':      'не удалось прочитать файл',

  'pane.mobile':            'Mobile · {w}px',
  'pane.desktop':           'Desktop · {w}px (контейнер {c})',
  'pane.scale.title':       'Масштаб этого превью',

  'overlay.component':      'Компонент',
  'overlay.tab.html':       'HTML',
  'overlay.tab.css':        'CSS',
  'overlay.copyHtml':       'Копировать HTML',
  'overlay.copyCss':        'Копировать CSS',
  'overlay.copied':         'Скопировано ✓',
  'overlay.tokens':         'Задействованные токены',
  'overlay.close':          'Закрыть',
  'overlay.noRules':        'Для этого элемента не нашлось правил в подключённых стилях.',
  'overlay.fileProtocol':   'Браузер не отдал <code>cssRules</code> — так бывает при открытии по <code>file://</code>. Откройте галерею через <code>http://</code>, и правила появятся.',

  'diff.computing':         'Считаю различия…',
  'diff.clean':             'Совпадает с приложенным CSS',
  'diff.count':             'Отличий от приложенного CSS: {n}',
  'diff.failed':            'Не удалось посчитать — превью не догрузилось',

  'prop.fontSize':          'размер',
  'prop.fontWeight':        'вес',
  'prop.lineHeight':        'интерлиньяж',
  'prop.color':             'цвет текста',
  'prop.backgroundColor':   'фон',
  'prop.borderTopLeftRadius': 'радиус',
  'prop.boxShadow':         'тень/кольцо',
  'prop.paddingTop':        'паддинг сверху',
  'prop.paddingLeft':       'паддинг слева',
  'prop.columnGap':         'зазор по горизонтали',
  'prop.rowGap':            'зазор по вертикали',
  'prop.height':            'высота',
  'prop.minHeight':         'мин. высота',

  'reload.changed':         'Файлы изменились…',
  'reload.reloading':       'Обновляю…',

  'token.missing':          'нет в этом наборе',
  'token.loading':          'Загружаю CSS…',
  'token.brokenTokens':     'Не удалось прочитать файл токенов — он вернулся пустым. Обычно это значит, что его перезаписывали в момент загрузки страницы. Перезагрузите галерею.'
};
