import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/lib/theme';
import { useComfort } from '@/state/comfort';

/** React Native's native animation driver does not exist in the browser. */
const native = Platform.OS !== 'web';

/** True when the user asked the system for less motion; every animation here then jumps straight to its end state. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  const comfort = useComfort((s) => s.active);   // Comfort Mode switches animation off as well
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      const q = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReduced(q.matches);
      const on = () => setReduced(q.matches);
      q.addEventListener?.('change', on);
      return () => q.removeEventListener?.('change', on);
    }
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced || comfort;
}

/** Fades and slides its content in when it first appears. Use `delay` to stagger a list. */
export function FadeIn({ children, delay = 0, y = 16, duration = 420, style }: { children: ReactNode; delay?: number; y?: number; duration?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return void v.setValue(1);
    const a = Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [reduced]);
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [y, 0] }) }] }, style]}>{children}</Animated.View>
  );
}

/** A Pressable that gently shrinks while pressed. */
export function PressScale({ children, style, scaleTo = 0.97, ...rest }: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle>; scaleTo?: number }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(1)).current;
  const to = (n: number) => !reduced && Animated.spring(v, { toValue: n, speed: 40, bounciness: 6, useNativeDriver: native }).start();
  return (
    <Pressable {...rest} onPressIn={(e) => { to(scaleTo); rest.onPressIn?.(e); }} onPressOut={(e) => { to(1); rest.onPressOut?.(e); }}>
      <Animated.View style={[{ transform: [{ scale: v }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Counts up (or down) to `value`. */
export function CountUp({ value, duration = 800, format = (n: number) => String(Math.round(n)), style }: { value: number; duration?: number; format?: (n: number) => string; style?: StyleProp<TextStyle> }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? value : 0)).current;
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    const id = v.addListener(({ value: n }) => setShown(n));
    if (reduced) { v.setValue(value); setShown(value); }
    else Animated.timing(v, { toValue: value, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [value, reduced]);
  return <Text style={style}>{format(shown)}</Text>;
}

/** Circular progress ring that animates to `progress` (0..1, values above 1 simply fill the ring). */
export function Ring({ size = 150, stroke = 14, progress, color = colors.primary, track = '#E9EFE9', children }: { size?: number; stroke?: number; progress: number; color?: string; track?: string; children?: ReactNode }) {
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = Math.max(0, Math.min(1, progress));
  const v = useRef(new Animated.Value(reduced ? target : 0)).current;
  const [shown, setShown] = useState(reduced ? target : 0);   // plain state, not an animated SVG component: that adds attributes the web DOM rejects
  useEffect(() => {
    const id = v.addListener(({ value }) => setShown(value));
    if (reduced) { v.setValue(target); setShown(target); }
    else Animated.timing(v, { toValue: target, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [target, reduced]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - shown)}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Shimmering placeholder block while data loads. */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: native }),
      Animated.timing(v, { toValue: 0.5, duration: 700, useNativeDriver: native }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced]);
  return <Animated.View accessibilityElementsHidden style={[{ width, height, borderRadius: radius, backgroundColor: '#E5EBE5', opacity: v }, style]} />;
}

/** Slow "breathing" pulse for something that wants attention (e.g. the next routine step). */
export function Pulse({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
      Animated.timing(v, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced]);
  return <Animated.View style={[{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }] }, style]}>{children}</Animated.View>;
}

/** Tick that pops in when `done` becomes true. */
export function CheckPop({ done, size = 28 }: { done: boolean; size?: number }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return void v.setValue(done ? 1 : 0);
    Animated.spring(v, { toValue: done ? 1 : 0, friction: 4, tension: 120, useNativeDriver: native }).start();
  }, [done, reduced]);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: done ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? colors.primarySoft : '#fff' }}>
      <Animated.Text style={{ color: colors.primary, fontWeight: '900', fontSize: size * 0.55, transform: [{ scale: v }], opacity: v }}>✓</Animated.Text>
    </View>
  );
}
