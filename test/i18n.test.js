const test = require('node:test');
const assert = require('node:assert');
const { createTranslator, resolveLanguage, applyTranslations } = require('../src/i18n/core');

const locales = {
  de: { hello: 'Hallo', count: '{n} Punkte', only_de: 'Nur Deutsch' },
  fr: { hello: 'Bonjour', count: '{n} points' },
  en: { hello: 'Hello', count: '{n} points' }
};

test('translates a key in the active language', () => {
  assert.strictEqual(createTranslator(locales, 'fr').t('hello'), 'Bonjour');
});

test('substitutes {params}', () => {
  assert.strictEqual(createTranslator(locales, 'en').t('count', { n: 64 }), '64 points');
});

test('falls back to German, then to the key itself', () => {
  const tr = createTranslator(locales, 'fr');
  assert.strictEqual(tr.t('only_de'), 'Nur Deutsch');
  assert.strictEqual(tr.t('unknown'), 'unknown');
});

test('setLang switches the language and rejects unsupported ones', () => {
  const tr = createTranslator(locales, 'de');
  tr.setLang('en');
  assert.strictEqual(tr.t('hello'), 'Hello');
  tr.setLang('xx');
  assert.strictEqual(tr.lang, 'en');
});

test('resolveLanguage: saved choice wins, then system locale, then English', () => {
  const supported = ['de', 'fr', 'en'];
  assert.strictEqual(resolveLanguage('fr', 'de-DE', supported), 'fr');
  assert.strictEqual(resolveLanguage(null, 'fr-CA', supported), 'fr');
  assert.strictEqual(resolveLanguage('xx', 'de-AT', supported), 'de');
  assert.strictEqual(resolveLanguage(null, 'ja-JP', supported), 'en');
});

function fakeElement(attrs) {
  const el = { attrs: { ...attrs }, textContent: '' };
  el.getAttribute = (n) => (n in el.attrs ? el.attrs[n] : null);
  el.setAttribute = (n, v) => { el.attrs[n] = v; };
  return el;
}

test('applyTranslations fills text, title, placeholder and alt', () => {
  const a = fakeElement({ 'data-i18n': 'hello' });
  const b = fakeElement({ 'data-i18n-title': 'hello' });
  const c = fakeElement({ 'data-i18n-placeholder': 'hello' });
  const d = fakeElement({ 'data-i18n-alt': 'hello' });
  const all = [a, b, c, d];
  const root = {
    querySelectorAll: (sel) => all.filter((el) => `data-${sel.slice(6, -1)}` in el.attrs)
  };
  applyTranslations(root, createTranslator(locales, 'fr').t);
  assert.strictEqual(a.textContent, 'Bonjour');
  assert.strictEqual(b.attrs.title, 'Bonjour');
  assert.strictEqual(c.attrs.placeholder, 'Bonjour');
  assert.strictEqual(d.attrs.alt, 'Bonjour');
});
