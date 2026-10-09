import test from 'node:test';
import assert from 'node:assert/strict';
import { I18N } from './i18n.js';
import { BUILDER_I18N } from './builderStrings.js';
import { AI_I18N } from './builderAiStrings.js';
import { PAGE_I18N } from './builderPageStrings.js';
import { DRAFT_I18N } from './draftStrings.js';
import { plannerText } from './plannerI18n.js';

test('Korean has complete chat and builder copy, including functions and arrays', () => {
  for (const translations of [I18N, BUILDER_I18N, AI_I18N, PAGE_I18N, DRAFT_I18N]) {
    assert.deepEqual(Object.keys(translations.ko).sort(), Object.keys(translations.en).sort());
    for (const [key, english] of Object.entries(translations.en)) {
      const korean = translations.ko[key];
      assert.equal(typeof korean, typeof english, key);
      if (Array.isArray(english)) assert.equal(korean.length, english.length, key);
      if (typeof korean === 'string') assert.match(korean, /[가-힣]/u, key);
      if (typeof korean === 'function') assert.doesNotThrow(() => korean(1, 2, 3), key);
    }
  }
});

test('Planner controls follow the selected language without changing English labels', () => {
  for (const label of ['Plan my trip', 'Build my own trip', 'Customize a package', 'Review trip', 'Send trip request']) {
    assert.match(plannerText('ko', label), /[가-힣]/u);
    assert.equal(plannerText('en', label), label);
  }
});
