import Svg, { Circle, Path } from 'react-native-svg';

export type IconName = 'home' | 'plan' | 'chat' | 'progress' | 'profile' | 'heart' | 'clock' | 'flame' | 'drop' | 'moon' | 'run' | 'plate' | 'bell' | 'check';

/** Small line icons (24x24 grid) drawn with SVG so they look the same on every phone and browser. */
export function Icon({ name, size = 24, color = '#16231B', stroke = 2 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  const p = { stroke: color, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && <Path {...p} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />}
      {name === 'plan' && <Path {...p} d="M4 5h16v15H4zM4 10h16M9 3v4M15 3v4" />}
      {name === 'chat' && <Path {...p} d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z" />}
      {name === 'progress' && <Path {...p} d="M5 20V10M12 20V4M19 20v-7" />}
      {name === 'profile' && (<><Path {...p} d="M20 21a8 8 0 0 0-16 0" /><Circle {...p} cx="12" cy="7.5" r="4" /></>)}
      {name === 'heart' && <Path {...p} d="M12 21s-7.5-4.6-9.3-9.2C1.4 8.3 3.4 5 6.6 5c2 0 3.5 1.1 5.4 3.2C13.9 6.1 15.4 5 17.4 5c3.2 0 5.2 3.3 3.9 6.8C19.5 16.4 12 21 12 21z" />}
      {name === 'clock' && (<><Circle {...p} cx="12" cy="12" r="9" /><Path {...p} d="M12 7v5l3 2" /></>)}
      {name === 'flame' && <Path {...p} d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.5 1 2 2 2 0-3-1-5 1-8z" />}
      {name === 'drop' && <Path {...p} d="M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11z" />}
      {name === 'moon' && <Path {...p} d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />}
      {name === 'run' && (<><Circle {...p} cx="14" cy="4.5" r="1.8" /><Path {...p} d="M8 21l3-6 3 2 2-5-4-2-2 3-3-1M14 12l3 3h3" /></>)}
      {name === 'plate' && (<><Circle {...p} cx="12" cy="12" r="9" /><Circle {...p} cx="12" cy="12" r="4.5" /></>)}
      {name === 'bell' && <Path {...p} d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 0 0 4 0" />}
      {name === 'check' && <Path {...p} d="M5 12.5l4.5 4.5L19 7.5" />}
    </Svg>
  );
}
