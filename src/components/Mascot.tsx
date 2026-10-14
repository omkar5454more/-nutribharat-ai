import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { useReducedMotion } from './motion';

export type MascotMood = 'happy' | 'cheer' | 'sleepy' | 'care' | 'wave' | 'think';

/**
 * "Nuti", the app's friendly round character. It bobs gently, blinks, and changes expression with `mood`.
 * Standing still (no bobbing or blinking) when the person prefers reduced motion or Comfort Mode is on.
 */
export function Mascot({ mood = 'happy', size = 120 }: { mood?: MascotMood; size?: number }) {
  const reduced = useReducedMotion();
  const bob = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const [blink, setBlink] = useState(false);
  const native = Platform.OS !== 'web';

  useEffect(() => {
    if (reduced) return;
    const b = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: mood === 'cheer' ? 380 : 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      Animated.timing(bob, { toValue: 0, duration: mood === 'cheer' ? 380 : 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
    ]));
    b.start();
    return () => b.stop();
  }, [reduced, mood]);

  useEffect(() => {
    if (reduced || mood !== 'wave') return;
    const w = Animated.loop(Animated.sequence([
      Animated.timing(wave, { toValue: 1, duration: 320, useNativeDriver: native }),
      Animated.timing(wave, { toValue: 0, duration: 320, useNativeDriver: native }),
    ]));
    w.start();
    return () => w.stop();
  }, [reduced, mood]);

  useEffect(() => {
    if (reduced || mood === 'sleepy') return;
    const id = setInterval(() => { setBlink(true); setTimeout(() => setBlink(false), 140); }, 3200);
    return () => clearInterval(id);
  }, [reduced, mood]);

  const closed = mood === 'sleepy' || blink;
  const eyeY = mood === 'think' ? 66 : 70;
  const mouth =
    mood === 'cheer' ? 'M 78 96 Q 100 124 122 96 Z'
    : mood === 'sleepy' ? 'M 90 100 Q 100 104 110 100'
    : mood === 'think' ? 'M 92 102 Q 100 100 108 104'
    : 'M 82 96 Q 100 114 118 96';
  const armUp = mood === 'cheer';

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, mood === 'cheer' ? -12 : -6] }) }] }}
    >
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <LinearGradient id="body" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#8EE0B0" />
            <Stop offset="1" stopColor="#4FC38A" />
          </LinearGradient>
        </Defs>
        {/* soft shadow */}
        <Ellipse cx="100" cy="184" rx="48" ry="8" fill="#5B4FA8" opacity={0.12} />
        {/* leaf on top */}
        <Path d="M 100 32 C 84 10 112 -2 124 14 C 116 30 106 34 100 32 Z" fill="#2FA36B" />
        <Path d="M 100 32 L 110 16" stroke="#1E7F50" strokeWidth={3} strokeLinecap="round" />
        {/* arms */}
        <G>
          <Ellipse cx="34" cy={armUp ? 78 : 118} rx="16" ry="12" fill="#7ED6A4" transform={armUp ? 'rotate(-40 34 78)' : 'rotate(20 34 118)'} />
          <Ellipse cx="166" cy={mood === 'wave' || armUp ? 78 : 118} rx="16" ry="12" fill="#7ED6A4" transform={mood === 'wave' || armUp ? 'rotate(40 166 78)' : 'rotate(-20 166 118)'} />
        </G>
        {/* body */}
        <Circle cx="100" cy="104" r="68" fill="url(#body)" />
        <Ellipse cx="100" cy="128" rx="42" ry="30" fill="#E9FFF3" opacity={0.55} />
        {/* cheeks */}
        <Ellipse cx="64" cy="94" rx="10" ry="7" fill="#FF9DB8" opacity={0.7} />
        <Ellipse cx="136" cy="94" rx="10" ry="7" fill="#FF9DB8" opacity={0.7} />
        {/* eyes */}
        {closed ? (
          <>
            <Path d="M 70 70 Q 78 76 86 70" stroke="#1F1B3A" strokeWidth={4} strokeLinecap="round" fill="none" />
            <Path d="M 114 70 Q 122 76 130 70" stroke="#1F1B3A" strokeWidth={4} strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            <Ellipse cx="78" cy={eyeY} rx="9" ry="11" fill="#1F1B3A" />
            <Ellipse cx="122" cy={eyeY} rx="9" ry="11" fill="#1F1B3A" />
            <Circle cx="81" cy={eyeY - 4} r="3.2" fill="#fff" />
            <Circle cx="125" cy={eyeY - 4} r="3.2" fill="#fff" />
          </>
        )}
        {/* mouth */}
        <Path d={mouth} fill={mood === 'cheer' ? '#E2557B' : 'none'} stroke="#1F1B3A" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        {mood === 'care' ? <Path d="M 100 142 C 84 130 90 118 100 126 C 110 118 116 130 100 142 Z" fill="#E2557B" /> : null}
        {mood === 'think' ? <Path d="M 148 40 q 6 -10 14 -4 q 8 6 0 14 q -6 4 -6 10" stroke="#5B4FA8" strokeWidth={4} strokeLinecap="round" fill="none" /> : null}
      </Svg>
    </Animated.View>
  );
}

/** A speech bubble that sits beside or under the mascot. */
export function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, boxShadow: '0 6px 18px rgba(91,79,168,0.14)' } as object}>
      {children}
    </View>
  );
}
