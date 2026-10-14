import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useT } from '@/i18n';
import { colors } from '@/lib/theme';

/** One toggle for both screens so nobody has to hunt for the other option. */
export function AuthTabs({ active }: { active: 'in' | 'up' }) {
  const t = useT();
  const router = useRouter();
  const seg = (id: 'in' | 'up', label: string) => {
    const on = active === id;
    return (
      <Pressable
        key={id}
        accessible
        accessibilityLabel={label}
        accessibilityState={{ selected: on }}
        onPress={() => !on && router.replace(id === 'in' ? '/sign-in' : '/sign-up')}
        style={{ flex: 1, paddingVertical: 11, borderRadius: 14, alignItems: 'center', backgroundColor: on ? '#fff' : 'transparent', boxShadow: on ? '0 4px 12px rgba(60,50,120,0.14)' : undefined } as object}
      >
        <Text style={{ fontWeight: '800', color: on ? colors.text : colors.muted }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#EFEAF8', borderRadius: 18, padding: 4 }}>
      {seg('in', t('h4.auth.tabIn'))}
      {seg('up', t('h4.auth.tabUp'))}
    </View>
  );
}
