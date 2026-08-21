/* Карта старых имён: в styles.css сайта те же токены названы иначе.
   Без неё сравнение с боевым кодом показывало бы «нет такого токена» там,
   где значение есть — просто под прежним именем.
   Это данные SDM: движок такой карты не знает и знать не должен. */
window.BRAND_LEGACY = {
    '--text-heading':    '--black',
    '--text-primary':    '--text',
    '--text-secondary':  '--text-2',
    '--text-muted':      '--muted',
    '--text-on-dark':    '--white-pure',
    '--text-brand':      '--blue',
    '--text-success':    '--green',
    '--border-hairline': '--m-header-border',
    '--track-blue':      '--card-blue',
    '--card-peach':      '--card-beige',
    '--r-card':          '--r-md',
    '--r-icon':          '--r-sm',
    '--r-badge':         '--r-20',
    '--r-input':         '--r-8',
    '--r-dot':           '--r-4',
    '--r-btn':           '--r-48'
  };
