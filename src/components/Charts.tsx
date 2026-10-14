import { Text, View } from 'react-native';
import { colors } from '@/lib/theme';
import { FadeIn } from './motion';

export type Bar = { label: string; value: number; color?: string };

/** A simple vertical bar chart that fits any phone width. `max` fixes the scale (e.g. 10 for symptom strength). */
export function BarChart({ bars, max, height = 90, empty = '' }: { bars: Bar[]; max?: number; height?: number; empty?: string }) {
  const top = max ?? Math.max(1, ...bars.map((b) => b.value));
  return (
    <View accessibilityRole="image" accessibilityLabel={bars.map((b) => `${b.label}: ${b.value}`).join(', ')} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: bars.length > 14 ? 2 : 6, height: height + 22 }}>
      {bars.map((b, i) => (
        <View key={`${b.label}-${i}`} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: height + 22 }}>
          <FadeIn y={4} delay={Math.min(i * 15, 300)} duration={300} style={{ width: '100%', alignItems: 'center' }}>
            <View style={{ width: '100%', maxWidth: 28, height: Math.max(b.value > 0 ? 4 : 2, (b.value / top) * height), backgroundColor: b.value > 0 ? b.color ?? colors.primary : '#E9E6F2', borderRadius: 6 }} />
          </FadeIn>
          {bars.length <= 14 ? <Text style={{ fontSize: 10, color: colors.muted, marginTop: 4 }} numberOfLines={1}>{b.label}</Text> : null}
        </View>
      ))}
      {!bars.length && empty ? <Text style={{ color: colors.muted }}>{empty}</Text> : null}
    </View>
  );
}

/** A row of small coloured dots, one per day (used for the mood week). */
export function DotRow({ items }: { items: { label: string; emoji: string | null }[] }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {items.map((d, i) => (
        <View key={i} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
          <Text style={{ fontSize: 20, opacity: d.emoji ? 1 : 0.25 }}>{d.emoji ?? '·'}</Text>
          <Text style={{ fontSize: 10, color: colors.muted }}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}
