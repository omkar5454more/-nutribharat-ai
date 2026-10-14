import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { useLang, useT } from '@/i18n';
import { colors } from '@/lib/theme';

const LOCALES: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', bn: 'bn-IN', gu: 'gu-IN' };

/**
 * Voice input using the browser's speech recognition (Chrome / Edge / Safari). It only turns speech into text for the box next to it;
 * the audio is handled by the browser, not by this app. Hidden where the browser does not support it (native builds would need a speech package).
 */
export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [listening, setListening] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const rec = useRef<any>(null);
  const supported = Platform.OS === 'web' && typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  useEffect(() => () => { try { rec.current?.stop(); } catch { /* ignore */ } }, []);
  if (Platform.OS !== 'web') return null;

  function toggle() {
    if (!supported) return setUnsupported(true);
    if (listening) { try { rec.current?.stop(); } catch { /* ignore */ } return; }
    const R = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r = new R();
    r.lang = LOCALES[lang] ?? 'en-IN';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e: any) => { const text = e.results?.[0]?.[0]?.transcript; if (text) onText(String(text)); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    try { r.start(); } catch { setListening(false); }
  }

  return (
    <>
      <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={listening ? t('h4.voice.listening') : t('h4.voice.start')}
        style={{ minHeight: 44, minWidth: 44, borderRadius: 22, backgroundColor: listening ? '#E2557B' : '#EFEAF8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
        <Text style={{ fontSize: 18 }}>{listening ? '●' : '🎤'}</Text>
      </Pressable>
      {unsupported ? <Text style={{ color: colors.muted, fontSize: 12 }}>{t('h4.voice.unsupported')}</Text> : null}
    </>
  );
}
