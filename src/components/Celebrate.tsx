import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, Platform, Text, View } from 'react-native';
import { create } from 'zustand';
import { Bubble, Mascot } from './Mascot';
import { useReducedMotion } from './motion';

/** Fire a short celebration from anywhere: `celebrate('Workout done!')`. Always short, never required, and never shown in Comfort Mode. */
export const useCelebrate = create<{ message: string | null; id: number; fire: (message: string) => void; clear: () => void }>((set) => ({
  message: null,
  id: 0,
  fire: (message) => set((s) => ({ message, id: s.id + 1 })),
  clear: () => set({ message: null }),
}));
export const celebrate = (message: string) => useCelebrate.getState().fire(message);

const COLORS = ['#7C6FD0', '#F28C9B', '#F6C04E', '#4FC38A', '#5BB8F0', '#E2557B'];

function Piece({ i, delay }: { i: number; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const w = Dimensions.get('window').width;
  const startX = useMemo(() => Math.random() * w, [w]);
  const drift = useMemo(() => (Math.random() - 0.5) * 120, []);
  const spin = useMemo(() => Math.random() * 720 - 360, []);
  const size = useMemo(() => 7 + Math.random() * 7, []);
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1700 + Math.random() * 900, delay, easing: Easing.in(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', top: -20, left: startX, width: size, height: size * 1.4, borderRadius: 2, backgroundColor: COLORS[i % COLORS.length],
        opacity: v.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, Dimensions.get('window').height * 0.8] }) },
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, drift] }) },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${spin}deg`] }) },
        ],
      }}
    />
  );
}

/** Confetti falling over the screen with the mascot cheering. Mounted once in the signed-in layout. */
export function CelebrationLayer() {
  const { message, id, clear } = useCelebrate();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(clear, 2800);
    return () => clearTimeout(timer);
  }, [id, message]);
  if (!message) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }} key={id}>
      {reduced ? null : Array.from({ length: 28 }, (_, i) => <Piece key={i} i={i} delay={i * 35} />)}
      <View style={{ position: 'absolute', bottom: 110, left: 0, right: 0, alignItems: 'center', gap: 6 }}>
        <Mascot mood="cheer" size={110} />
        <Bubble><Text style={{ fontWeight: '800', color: '#1F1B3A', fontSize: 16 }}>{message}</Text></Bubble>
      </View>
    </View>
  );
}
