import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/lib/theme';

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const inner = padded ? { padding: space.lg, gap: space.md } : undefined;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[{ paddingBottom: 48 }, inner]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export const H1 = ({ children }: { children: ReactNode }) => <Text style={s.h1} accessibilityRole="header">{children}</Text>;
export const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2} accessibilityRole="header">{children}</Text>;
export const Muted = ({ children, style }: { children: ReactNode; style?: object }) => <Text style={[s.muted, style]}>{children}</Text>;

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Button({
  title, onPress, variant = 'primary', loading, disabled,
}: { title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'link'; loading?: boolean; disabled?: boolean }) {
  const off = disabled || loading;
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : variant === 'secondary' ? colors.primarySoft : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? '#fff' : colors.primaryDark;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1 }, variant === 'link' && { minHeight: 36 }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        {...props}
        style={[s.input, error ? { borderColor: colors.danger } : null, props.style]}
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[s.chip, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          >
            <Text style={{ color: on ? '#fff' : colors.text, fontWeight: '600' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({ value, max, color = colors.primary }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: Math.round(max), now: Math.round(value) }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: value > max * 1.1 ? colors.accent : color, borderRadius: 6 }} />
    </View>
  );
}

export function Notice({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'info' }) {
  return (
    <View style={[s.notice, tone === 'info' && { backgroundColor: colors.primarySoft }]}>
      <Text style={{ color: colors.text, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '800', color: colors.text },
  h2: { fontSize: 18, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: space.lg, borderWidth: 1, borderColor: colors.border, gap: space.sm },
  btn: { minHeight: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  btnText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: space.md, fontSize: 16, backgroundColor: '#fff', color: colors.text },
  error: { color: colors.danger, fontSize: 13 },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', minHeight: 44, justifyContent: 'center' },
  track: { height: 10, backgroundColor: '#ECE8DD', borderRadius: 6, overflow: 'hidden' },
  notice: { backgroundColor: colors.warnBg, borderRadius: radius.md, padding: space.md },
});
