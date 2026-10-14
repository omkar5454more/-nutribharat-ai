/**
 * Care contacts: people the user chooses to tell when something needs attention.
 * Messages are opened in the phone's own SMS / WhatsApp app with the text already written, and the user taps Send.
 * (Sending an SMS fully automatically needs a paid SMS service; this app does not do that on its own.)
 * Messages never contain health details unless the person adds them themselves.
 */

/** Returns +<digits> or null. A bare 10-digit Indian mobile number (starts 6-9) gets +91; other numbers must already start with +. */
export function normalizePhone(input: string): string | null {
  const raw = input.trim().replace(/[\s().-]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(raw)) return raw;
  const digits = raw.replace(/^0+/, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

export const maskPhone = (p: string) => (p.length > 6 ? `${p.slice(0, 3)}${'•'.repeat(Math.max(0, p.length - 6))}${p.slice(-3)}` : p);

export const smsUrl = (phone: string, body: string) => `sms:${phone}?body=${encodeURIComponent(body)}`;
/** wa.me wants the number without + */
export const whatsappUrl = (phone: string, body: string) => `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(body)}`;

export type AlertKind = 'welcome' | 'emergency' | 'worse' | 'checkin_missed';
export const RELATIONS = ['family', 'spouse', 'parent', 'friend', 'doctor', 'other'] as const;
export type Relation = (typeof RELATIONS)[number];

/** Message templates with only a name in them. `from` is the sender's first name, `to` the contact's. */
export function alertText(kind: AlertKind, lang: 'en' | 'hi' | 'mr', from: string, to: string): string {
  const f = from.trim() || 'Your contact';
  const T: Record<AlertKind, Record<'en' | 'hi' | 'mr', string>> = {
    welcome: {
      en: `Hi ${to}, this is ${f}. I added you as a care contact in the NutriBharat AI health app. I may message you if I need help or want you to check on me. Please reply to confirm you are okay with this.`,
      hi: `नमस्ते ${to}, मैं ${f} हूँ। मैंने आपको NutriBharat AI सेहत ऐप में अपना केयर कॉन्टैक्ट बनाया है। ज़रूरत पड़ने पर मैं आपको संदेश भेज सकता/सकती हूँ। कृपया जवाब देकर बताएँ कि आपको यह ठीक है।`,
      mr: `नमस्कार ${to}, मी ${f}. मी तुम्हाला NutriBharat AI आरोग्य अ‍ॅपमध्ये माझा केअर कॉन्टॅक्ट म्हणून जोडले आहे. गरज पडल्यास मी तुम्हाला संदेश पाठवू शकतो/शकते. कृपया उत्तर देऊन कळवा की तुम्हाला हे चालेल.`,
    },
    emergency: {
      en: `${to}, this is ${f}. I may need help right now. Please call me as soon as you can.`,
      hi: `${to}, मैं ${f} हूँ। मुझे अभी मदद की ज़रूरत हो सकती है। कृपया जल्द से जल्द मुझे फ़ोन करें।`,
      mr: `${to}, मी ${f}. मला आत्ता मदतीची गरज असू शकते. कृपया शक्य तितक्या लवकर मला फोन करा.`,
    },
    worse: {
      en: `${to}, this is ${f}. I am not feeling well and it is getting worse. Please check on me.`,
      hi: `${to}, मैं ${f} हूँ। मेरी तबीयत ठीक नहीं है और बिगड़ रही है। कृपया मेरा हाल पूछें।`,
      mr: `${to}, मी ${f}. माझी तब्येत ठीक नाही आणि बिघडत आहे. कृपया माझी चौकशी करा.`,
    },
    checkin_missed: {
      en: `${to}, this is ${f}. Could you please check in with me today?`,
      hi: `${to}, मैं ${f} हूँ। क्या आप आज मेरा हाल पूछ सकते हैं?`,
      mr: `${to}, मी ${f}. तुम्ही आज माझी चौकशी करू शकाल का?`,
    },
  };
  return T[kind][lang];
}
