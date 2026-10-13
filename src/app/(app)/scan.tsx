import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Platform, View } from 'react-native';
import { Button, Muted, Notice, Screen } from '@/components/ui';
import { matchFood } from '@/core/match';
import { makeItem } from '@/core/nutrition';
import type { MealItem } from '@/core/types';
import { analyzePhoto } from '@/lib/data';
import { colors } from '@/lib/theme';
import { useDraft } from '@/state/draft';

export default function Scan() {
  const router = useRouter();
  const start = useDraft((s) => s.start);
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pick(source: 'camera' | 'library') {
    setError('');
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError(source === 'camera' ? 'Camera permission is needed to scan a meal. You can allow it in Settings, or choose a photo from your gallery.' : 'Photo access is needed to choose a picture. You can allow it in Settings.');
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled) return;
    const asset = res.assets[0];
    setUri(asset.uri);
    await analyse(asset.uri, asset.width, asset.height);
  }

  async function analyse(photoUri: string, width: number, height: number) {
    setBusy(true);
    try {
      // shrink first: faster upload, lower AI cost, and the full-size photo never leaves the phone
      const ctx = ImageManipulator.ImageManipulator.manipulate(photoUri);
      const MAX = 1024;
      if (Math.max(width, height) > MAX) {
        const k = MAX / Math.max(width, height);
        ctx.resize({ width: Math.round(width * k), height: Math.round(height * k) }); // explicit size: `height: null` breaks on web
      }
      const rendered = await ctx.renderAsync();
      const out = await rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.7, base64: true });
      if (!out.base64) throw new Error('Could not read the photo.');

      const result = await analyzePhoto(out.base64);
      if (!result.is_food || result.items.length === 0) {
        setError('We could not see any food in that photo. Try again in better light, or add the food manually.');
        return;
      }
      const items: MealItem[] = [];
      const unmatched: { name: string; grams: number }[] = [];
      for (const it of result.items) {
        const m = matchFood(it.name);
        if (m) items.push(makeItem(m.food, Math.round(it.estimated_grams), 'ai', it.confidence));
        else unmatched.push({ name: it.name, grams: Math.round(it.estimated_grams) });
      }
      start(items, unmatched);
      router.replace('/review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Muted>Take a clear photo from above, with all the food in view. You will be able to correct anything on the next screen.</Muted>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: 260, borderRadius: 14, backgroundColor: colors.border }} accessibilityLabel="Your meal photo" /> : null}
      {busy ? (
        <View style={{ alignItems: 'center', gap: 8, padding: 16 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Muted>Looking at your meal…</Muted>
        </View>
      ) : (
        <>
          {Platform.OS !== 'web' ? <Button title="📷  Take a photo" onPress={() => pick('camera')} /> : null}
          <Button title="🖼  Choose from gallery" variant="secondary" onPress={() => pick('library')} />
          <Button title="Add food without a photo" variant="link" onPress={() => { useDraft.getState().reset(); router.replace('/review'); }} />
        </>
      )}
      {error ? <Notice>{error}</Notice> : null}
      <Muted>Photos are analysed by AI and are not stored. Estimates from a photo can be off, especially for oil, ghee and sugar, so please check the amounts.</Muted>
    </Screen>
  );
}
