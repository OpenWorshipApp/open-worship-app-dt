// `withTranslations`: the labels a press, a find or a drag is tried with in a
// window shown in another language. A floating panel answers to its stamped
// English name and shows its title as no name a scope reads, so a scope whose
// panel name has a translation of its own matched nothing in that window
// until the English panel name was kept beside the translated control. The
// language is a made-up one in a mocked bundle: no package is read.

import { describe, expect, it, vi } from 'vitest';

vi.mock('./tran.mjs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadTranBundle: () => ({
      languages: [{ code: 'en' }, { code: 'xx' }],
      dictionaries: {
        xx: {
          countdown: 'Kount',
          'reset date and time to now': 'Rezet now',
          'reveal hidden controls': 'Reveal hid',
        },
      },
    }),
  };
});

const { withTranslations } = await import('./owaTools.mjs');

describe('withTranslations', () => {
  it('leaves English alone', () => {
    expect(
      withTranslations(['Countdown > Reset Date and Time to Now'], 'en'),
    ).toEqual(['Countdown > Reset Date and Time to Now']);
  });

  it('keeps the panel name English beside the translated control', () => {
    expect(
      withTranslations(['Countdown > Reset Date and Time to Now'], 'xx'),
    ).toEqual([
      'Countdown > Reset Date and Time to Now',
      'Kount > Rezet now',
      'Countdown > Rezet now',
    ]);
  });

  it('adds nothing twice when the panel name has no translation', () => {
    expect(
      withTranslations(
        ['Presenting Flow Preview > Reveal Hidden Controls'],
        'xx',
      ),
    ).toEqual([
      'Presenting Flow Preview > Reveal Hidden Controls',
      'Presenting Flow Preview > Reveal hid',
    ]);
  });

  it('adds nothing for a control the dictionary lacks or a bare label', () => {
    expect(withTranslations(['Countdown > Unknown'], 'xx')).toEqual([
      'Countdown > Unknown',
      'Kount > Unknown',
    ]);
    expect(withTranslations(['Countdown'], 'xx')).toEqual([
      'Countdown',
      'Kount',
    ]);
  });
});
