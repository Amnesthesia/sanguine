// i18next with the en-AU copy files. Interpolation uses {name} (ICU-style braces) to match copy/*.json.
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import enAU from '../../../../copy/en-AU.json';
import flags from '../../../../copy/flags.en-AU.json';
import legal from '../../../../copy/legal.en-AU.json';
import symptoms from '../../../../copy/symptoms.json';
import { TRANSLATIONS } from './translations';

/** Copy for every language we have: en-AU is complete; a translated file may lack keys and falls back to it. */
export const resources: Record<string, { translation: Record<string, unknown> }> = {
  'en-AU': {
    translation: {
      ...enAU,
      legal,
      flags,
      symptom: Object.fromEntries(symptoms.symptoms.map((s) => [s.code, s.label])),
    },
  },
};

for (const [lang, tree] of Object.entries(TRANSLATIONS)) resources[lang] = { translation: tree };

void i18next.use(initReactI18next).init({
  resources,
  lng: 'en-AU',
  fallbackLng: 'en-AU',
  interpolation: { prefix: '{', suffix: '}', escapeValue: false },
  returnNull: false,
  initAsync: false,
});

export default i18next;
