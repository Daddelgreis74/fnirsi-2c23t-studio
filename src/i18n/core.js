// Minimal i18n core, shared by the renderer (browser global) and the main process (require).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.I18nCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const SOURCE_LANG = 'de';
  const FALLBACK_LANG = 'en';

  function format(template, params) {
    return template.replace(/\{(\w+)\}/g, (m, name) => (name in params ? params[name] : m));
  }

  function createTranslator(locales, initialLang) {
    const tr = {
      lang: locales[initialLang] ? initialLang : SOURCE_LANG,
      setLang(lang) {
        if (locales[lang]) tr.lang = lang;
      },
      t(key, params = {}) {
        const template = (locales[tr.lang] || {})[key] ?? (locales[SOURCE_LANG] || {})[key] ?? key;
        return format(template, params);
      }
    };
    return tr;
  }

  function resolveLanguage(saved, systemLocale, supported) {
    if (supported.includes(saved)) return saved;
    const sys = String(systemLocale || '').slice(0, 2).toLowerCase();
    return supported.includes(sys) ? sys : FALLBACK_LANG;
  }

  const ATTRIBUTES = ['title', 'placeholder', 'alt'];

  function applyTranslations(root, t) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    ATTRIBUTES.forEach((attr) => {
      root.querySelectorAll(`[data-i18n-${attr}]`).forEach((el) => {
        el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`)));
      });
    });
  }

  return { createTranslator, resolveLanguage, applyTranslations, format };
});
