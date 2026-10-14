import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, space } from '@/lib/theme';
import { FadeIn, PressScale, useReducedMotion } from './motion';

const native = Platform.OS !== 'web';

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const inner = padded ? { padding: space.lg, gap: space.md } : undefined;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[{ paddingBottom: 56 }, inner]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <FadeIn y={10} duration={320} style={{ gap: space.md }}>{children}</FadeIn>
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

/** White rounded card with a soft shadow. Pass `delay` (ms) to make it fade in, which staggers nicely down a list. */
export function Card({ children, style, delay }: { children: ReactNode; style?: ViewStyle; delay?: number }) {
  const card = <View style={[s.card, shadow, style]}>{children}</View>;
  return delay === undefined ? card : <FadeIn delay={delay}>{card}</FadeIn>;
}

/** Gradient banner for the most important thing on a screen. Text inside should be white. */
export function Hero({ children, style, delay }: { children: ReactNode; style?: ViewStyle; delay?: number }) {
  const hero = (
    <LinearGradient colors={[colors.gradientA, colors.gradientB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, style]}>
      {children}
    </LinearGradient>
  );
  return delay === undefined ? hero : <FadeIn delay={delay}>{hero}</FadeIn>;
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'good' | 'warn' | 'urgent' }) {
  const bg = tone === 'good' ? colors.primarySoft : tone === 'warn' ? colors.warnBg : tone === 'urgent' ? colors.urgentBg : '#EEF2EE';
  const fg = tone === 'good' ? colors.primaryDark : tone === 'warn' ? '#8A5300' : tone === 'urgent' ? colors.danger : colors.muted;
  return <View style={{ alignSelf: 'flex-start', backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{label}</Text></View>;
}

export function Button({
  title, onPress, variant = 'primary', loading, disabled,
}: { title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'link'; loading?: boolean; disabled?: boolean }) {
  const off = disabled || loading;
  const fg = variant === 'primary' || variant === 'danger' ? '#fff' : colors.primaryDark;
  const label = loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>;
  return (
    <PressScale onPress={onPress} disabled={off} accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!loading }} style={{ opacity: off ? 0.5 : 1 }}>
      {variant === 'primary' ? (
        <LinearGradient colors={[colors.gradientA, colors.gradientB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.btn, shadow]}>{label}</LinearGradient>
      ) : (
        <View style={[s.btn, { backgroundColor: variant === 'danger' ? colors.danger : variant === 'secondary' ? colors.primarySoft : 'transparent' }, variant === 'link' && { minHeight: 36 }]}>{label}</View>
      )}
    </PressScale>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        {...props}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        style={[s.input, focused && { borderColor: colors.primary, boxShadow: '0 0 0 3px rgba(31, 138, 76, 0.15)' } as object, error ? { borderColor: colors.danger } : null, props.style]}
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
          <PressScale key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ selected: on }} scaleTo={0.94}
            style={[s.chip, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
            <Text style={{ color: on ? '#fff' : colors.text, fontWeight: '700' }}>{o.label}</Text>
          </PressScale>
        );
      })}
    </View>
  );
}

/** Multi-select chips (e.g. health conditions). */
export function MultiChips<T extends string>({ options, values, onToggle }: { options: { value: T; label: string }[]; values: T[]; onToggle: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <PressScale key={o.value} onPress={() => onToggle(o.value)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} scaleTo={0.94}
            style={[s.chip, on && { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
            <Text style={{ color: on ? colors.primaryDark : colors.text, fontWeight: '700' }}>{on ? '✓ ' : ''}{o.label}</Text>
          </PressScale>
        );
      })}
    </View>
  );
}

/** Animated progress bar; turns orange when the value is well over the target. */
export function ProgressBar({ value, max, color = colors.primary }: { value: number; max: number; color?: string }) {
  const reduced = useReducedMotion();
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const v = useRef(new Animated.Value(reduced ? pct : 0)).current;
  useEffect(() => {
    if (reduced) return void v.setValue(pct);
    Animated.timing(v, { toValue: pct, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct, reduced]);
  return (
    <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: Math.round(max), now: Math.round(value) }}>
      <Animated.View style={{ width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), height: '100%', backgroundColor: value > max * 1.1 ? colors.accent : color, borderRadius: 6 }} />
    </View>
  );
}

/** A message box. `urgent` is for red-flag / emergency guidance. */
export function Notice({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'info' | 'urgent' }) {
  const bg = tone === 'info' ? colors.primarySoft : tone === 'urgent' ? colors.urgentBg : colors.warnBg;
  const icon = tone === 'info' ? 'ℹ️' : tone === 'urgent' ? '🚨' : '⚠️';
  return (
    <FadeIn y={6} duration={260}>
      <View style={[s.notice, { backgroundColor: bg }, tone === 'urgent' && { borderWidth: 1, borderColor: colors.danger }]} accessibilityRole={tone === 'urgent' ? 'alert' : undefined}>
        <Text style={{ fontSize: 15, marginTop: 1 }}>{icon}</Text>
        <Text style={{ color: colors.text, lineHeight: 20, flex: 1 }}>{children}</Text>
      </View>
    </FadeIn>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  h2: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: colors.border, gap: space.sm },
  hero: { borderRadius: radius.lg, padding: space.xl, gap: space.sm },
  btn: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  btnText: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 14, fontWeight: '700', color: colors.text },
  input: { minHeight: 50, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16, backgroundColor: '#fff', color: colors.text },
  error: { color: colors.danger, fontSize: 13 },
  chip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff', minHeight: 44, justifyContent: 'center' },
  track: { height: 10, backgroundColor: '#E8EEE7', borderRadius: 6, overflow: 'hidden' },
  notice: { borderRadius: radius.md, padding: space.md, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
});
