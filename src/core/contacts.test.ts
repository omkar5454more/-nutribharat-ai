import { describe, expect, it } from 'vitest';
import { alertText, maskPhone, normalizePhone, smsUrl, whatsappUrl } from './contacts';

describe('normalizePhone', () => {
  it.each([
    ['98765 43210', '+919876543210'], ['09876543210', '+919876543210'], ['+91 98765-43210', '+919876543210'], ['919876543210', '+919876543210'],
    ['+14155552671', '+14155552671'], ['(987) 654-3210', '+919876543210'],
  ])('%s -> %s', (i, o) => expect(normalizePhone(i)).toBe(o));
  it.each(['', '12345', '5876543210', 'abcdefghij', '+0123456789', '98765432', '+91'])('rejects %s', (i) => expect(normalizePhone(i)).toBeNull());
});

describe('links and masking', () => {
  it('builds an sms link with an encoded body', () => {
    expect(smsUrl('+919876543210', 'Hi & bye')).toBe('sms:+919876543210?body=Hi%20%26%20bye');
  });
  it('builds a WhatsApp link without the plus sign', () => {
    expect(whatsappUrl('+919876543210', 'Hi')).toBe('https://wa.me/919876543210?text=Hi');
  });
  it('masks most of the number', () => {
    expect(maskPhone('+919876543210')).toBe('+91•••••••210');
  });
});

describe('alert text', () => {
  it('uses only names, in all three languages, and contains no health words', () => {
    for (const lang of ['en', 'hi', 'mr'] as const) for (const k of ['welcome', 'emergency', 'worse', 'checkin_missed'] as const) {
      const t = alertText(k, lang, 'Asha', 'Ravi');
      expect(t).toContain('Asha');
      expect(t).toContain('Ravi');
      expect(t).not.toMatch(/diabet|migraine|insulin|pcos|pcod|medicine|blood pressure|cancer|hiv/i);
    }
  });
  it('falls back to a neutral sender name', () => {
    expect(alertText('emergency', 'en', '  ', 'Ravi')).toContain('Your contact');
  });
});
