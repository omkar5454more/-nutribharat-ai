import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Ellipse, G } from 'react-native-svg';
import { useT } from '@/i18n';
import { colors } from '@/lib/theme';
import { LanguagePicker } from './common';
import { Icon } from './icons';
import { FadeIn, useReducedMotion } from './motion';
import { Mascot } from './Mascot';
import { Field } from './ui';

/** A heart badge that gently floats. Stays still when the person prefers reduced motion. */
function FloatingHeart() {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(v, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced]);
  return (
    <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
      <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 30px rgba(120,90,180,0.28)' } as object}>
        <Icon name="heart" size={38} color="#E2557B" />
      </View>
    </Animated.View>
  );
}

function Petals() {
  return (
    <Svg width="100%" height={340} viewBox="0 0 400 340" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="none">
      <G x={200} y={130} opacity={0.35}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <Ellipse key={a} cx={0} cy={-80} rx={30} ry={92} fill="#FFFFFF" transform={`rotate(${a})`} />)}
      </G>
    </Svg>
  );
}

const PILLS = ['h4.auth.pill1', 'h4.auth.pill2', 'h4.auth.pill3', 'h4.auth.pill4'] as const;

/** Shared look for sign-in / sign-up: pastel gradient, floating logo, feature chips and a rounded form sheet. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const t = useT();
  return (
    <LinearGradient colors={['#D9D4F5', '#F5D5E6', '#FBE4D2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <Petals />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: 'center', gap: 10, marginTop: 8 }}>
              <Mascot mood="happy" size={104} />
              <Text style={{ fontSize: 30, fontWeight: '800', color: '#1F1B3A', letterSpacing: -0.5 }} accessibilityRole="header">{t('app.name')}</Text>
              <Text style={{ fontSize: 16, color: '#4A4568', fontWeight: '600', textAlign: 'center' }}>{t('h4.auth.hero')}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {PILLS.map((k, i) => (
                <FadeIn key={k} delay={150 + i * 90} y={10}>
                  <View style={{ backgroundColor: '#FFFFFFB3', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}><Text style={{ color: '#3A3560', fontWeight: '700', fontSize: 12 }}>{t(k)}</Text></View>
                </FadeIn>
              ))}
            </View>
            <FadeIn delay={200} y={24}>
              <View style={{ backgroundColor: '#fff', borderRadius: 28, padding: 20, gap: 14, boxShadow: '0 20px 50px rgba(91,79,168,0.18)' } as object}>
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>{title}</Text>
                  <Text style={{ color: colors.muted }}>{subtitle}</Text>
                </View>
                {children}
              </View>
            </FadeIn>
            <LanguagePicker />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

/** Password box with a Show / Hide toggle. */
export function PasswordField({ label, value, onChangeText, error, onSubmitEditing, autoComplete }: { label: string; value: string; onChangeText: (v: string) => void; error?: string; onSubmitEditing?: () => void; autoComplete?: 'password' | 'new-password' }) {
  const t = useT();
  const [show, setShow] = useState(false);
  return (
    <View>
      <Field label={label} value={value} onChangeText={onChangeText} secureTextEntry={!show} autoComplete={autoComplete} error={error} onSubmitEditing={onSubmitEditing} style={{ paddingRight: 70 }} />
      <Pressable onPress={() => setShow((s) => !s)} accessibilityRole="button" accessibilityLabel={show ? t('h4.auth.hide') : t('h4.auth.show')} style={{ position: 'absolute', right: 14, bottom: error ? 34 : 14 }}>
        <Text style={{ color: colors.primaryDark, fontWeight: '700' }}>{show ? t('h4.auth.hide') : t('h4.auth.show')}</Text>
      </Pressable>
    </View>
  );
}

/** 0 = empty, 1 = weak, 2 = okay, 3 = strong. A hint only; the real rule (8+ characters) is enforced on submit. */
export const passwordStrength = (p: string): 0 | 1 | 2 | 3 => {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  else if (p.length >= 12) s++;
  return Math.max(1, s) as 1 | 2 | 3;
};

export function StrengthMeter({ password }: { password: string }) {
  const t = useT();
  const s = passwordStrength(password);
  if (!s) return null;
  const color = s === 1 ? '#E0645C' : s === 2 ? '#F0A93B' : '#2FB172';
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[1, 2, 3].map((i) => <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= s ? color : '#E9E6F2' }} />)}
      </View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{t(s === 1 ? 'h4.auth.weak' : s === 2 ? 'h4.auth.ok' : 'h4.auth.strong')}</Text>
    </View>
  );
}
