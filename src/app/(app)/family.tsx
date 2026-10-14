import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { ProfileForm } from '@/components/ProfileForm';
import { Button, Card, H1, H2, Muted, Notice, Screen } from '@/components/ui';
import { ageFrom, addMember, deleteMember } from '@/lib/data';
import { useActive } from '@/lib/active';
import { useT, type Key } from '@/i18n';
import { useActiveMember } from '@/state/active';

export default function Family() {
  const t = useT();
  const qc = useQueryClient();
  const { uid, members, memberId } = useActive();
  const setMemberId = useActiveMember((s) => s.setMemberId);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function remove(id: string) {
    setError('');
    try {
      await deleteMember(id);
      if (memberId === id) setMemberId(null);
      await qc.invalidateQueries();
    } catch {
      setError(t('fam.removeFail'));
    }
  }

  function confirmRemove(id: string, name: string) {
    const title = t('fam.removeTitle', { name });
    const body = t('fam.removeBody', { name });
    if (Platform.OS === 'web') return void (window.confirm(`${title}\n\n${body}`) && remove(id));
    Alert.alert(title, body, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('fam.remove'), style: 'destructive', onPress: () => remove(id) }]);
  }

  return (
    <Screen>
      <H1>{t('fam.title')}</H1>
      <Muted>{t('fam.sub')}</Muted>
      {error ? <Notice>{error}</Notice> : null}

      {members.length === 0 && !adding ? <Muted>{t('fam.none')}</Muted> : null}
      {members.map((m) => (
        <Card key={m.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700', fontSize: 16 }}>{m.display_name}</Text>
            <Muted>{t(`fam.rel.${m.relation}` as Key)}</Muted>
          </View>
          <Muted>{t('prof.line1', { age: ageFrom(m.birth_date), h: m.height_cm, w: m.weight_kg, bmi: Math.round((m.weight_kg / Math.pow(m.height_cm / 100, 2)) * 10) / 10 })}</Muted>
          <Button title={t('fam.remove')} variant="link" onPress={() => confirmRemove(m.id, m.display_name)} />
        </Card>
      ))}

      {adding ? (
        <>
          <H2>{t('fam.add')}</H2>
          <ProfileForm
            mode="member"
            userId={uid!}
            submitLabel={t('fam.save')}
            onSubmitMember={(m) => addMember(uid!, m)}
            onSaved={async () => {
              setAdding(false);
              await qc.invalidateQueries({ queryKey: ['members'] });
            }}
          />
          <Button title={t('common.cancel')} variant="link" onPress={() => setAdding(false)} />
        </>
      ) : (
        <Button title={t('fam.add')} onPress={() => setAdding(true)} />
      )}
    </Screen>
  );
}
