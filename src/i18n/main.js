// Translator of the main process; the renderer pushes its language through the 'i18n:set-language' IPC.
const { createTranslator } = require('./core');

const LANGS = ['de', 'fr', 'en'];
const locales = Object.fromEntries(LANGS.map((lang) => [lang, require(`./locales/${lang}.js`)]));
const translator = createTranslator(locales, 'de');

module.exports = { t: translator.t, setLang: translator.setLang };
