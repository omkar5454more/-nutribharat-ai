import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Mascot } from '@/components/Mascot';
import { MemberSwitcher } from '@/components/MemberSwitcher';
import { Button, Card, Chips, Field, H1, H2, MultiChips, Muted, Notice, Screen } from '@/components/ui';
import { alertText, maskPhone, normalizePhone, RELATIONS, smsUrl, whatsappUrl, type Relation } from '@/core/contacts';
import { useLang, useT, type Key } from '@/i18n';
import { useActive } from '@/lib/active';
import { addContact, deleteContact, useContacts, type ContactRow } from '@/lib/health';
import { colors } from '@/lib/theme';

/** People the user trusts. Adding one offers a pre-written hello by SMS or WhatsApp; the user taps Send. Nothing is sent by the app itself. */
export default function Contacts() {
  const t = useT();
  const qc = useQueryClient();
  const lang = useLang((s) => s.lang);
  const { uid, memberId, profile } = useActive();
  const contacts = useContacts(uid, memberId);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState<Relation>('family');
  const [told, setTold] = useState(false);
  const [error, setError] = useState('');
  const [fresh, setFresh] = useState<{ name: string; phone: string } | null>(null);
  const l = (lang === 'hi' || lang === 'mr' ? lang : 'en') as 'en' | 'hi' | 'mr';
  const first = (profile?.display_name ?? '').trim().split(/\s+/)[0] ?? '';
  const open = (url: string) => { Linking.openURL(url).catch(() => {}); };
  const hello = (c: { name: string; phone: string }) => alertText('welcome', l, first, c.name);

  async function save() {
    setError('');
    const p = normalizePhone(phone);
    if (!name.trim() || !p) return setError(t('h4.ct.phoneBad'));
    if (!told) return setError(t('h4.ct.told'));
    try {
      await addContact(uid!, memberId, { name, phone: p, relation });
      setFresh({ name: name.trim(), phone: p });
      setName(''); setPhone(''); setTold(false);
      await qc.invalidateQueries({ queryKey: ['contacts'] });
    } catch { setError(t('h4.fail')); }
  }

  const row = (c: ContactRow) => (
    <View key={c.id} style={{ gap: 6, paddingVertical: 6 }}>
      <Text style={{ fontWeight: '800', color: colors.text }}>{c.name} · {t(`h4.ct.rel.${c.relation}` as Key)}</Text>
      <Muted>{maskPhone(c.phone)}</Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button title={t('h4.ct.sms')} variant="secondary" onPress={() => open(smsUrl(c.phone, hello(c)))} />
        <Button title={t('h4.ct.wa')} variant="secondary" onPress={() => open(whatsappUrl(c.phone, hello(c)))} />
        <Button title={t('h4.remove')} variant="link" onPress={async () => { await deleteContact(c.id); await qc.invalidateQueries({ queryKey: ['contacts'] }); }} />
      </View>
    </View>
  );

  return (
    <Screen>
      <H1>{t('h4.ct.title')}</H1>
      <MemberSwitcher />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Mascot mood="care" size={84} />
        <View style={{ flex: 1 }}><Muted>{t('h4.ct.intro')}</Muted></View>
      </View>

      {fresh ? (
        <Card style={{ borderWidth: 1.5, borderColor: colors.primary }}>
          <Text style={{ fontWeight: '800', color: colors.text }}>{t('h4.ct.added', { name: fresh.name })}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button title={t('h4.ct.sms')} onPress={() => open(smsUrl(fresh.phone, hello(fresh)))} />
            <Button title={t('h4.ct.wa')} variant="secondary" onPress={() => open(whatsappUrl(fresh.phone, hello(fresh)))} />
            <Button title={t('h4.cancel')} variant="link" onPress={() => setFresh(null)} />
          </View>
        </Card>
      ) : null}

      <Card>
        <H2>{t('h4.ct.add')}</H2>
        <Field label={t('h4.ct.name')} value={name} onChangeText={setName} maxLength={60} />
        <Field label={t('h4.ct.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
        <Text style={{ fontWeight: '700', color: colors.text }}>{t('h4.ct.relation')}</Text>
        <Chips value={relation} onChange={setRelation} options={RELATIONS.map((r) => ({ value: r, label: t(`h4.ct.rel.${r}` as Key) }))} />
        <MultiChips options={[{ value: 'told', label: t('h4.ct.told') }]} values={told ? ['told'] : []} onToggle={() => setTold((x) => !x)} />
        {error ? <Notice>{error}</Notice> : null}
        <Button title={t('h4.ct.add')} onPress={save} />
      </Card>

      <Card>
        {(contacts.data ?? []).length ? (contacts.data ?? []).map(row) : <Muted>{t('h4.ct.empty')}</Muted>}
        <Muted>{t('h4.ct.privacy')}</Muted>
        <Muted>{t('h4.ct.auto')}</Muted>
      </Card>
    </Screen>
  );
}
