import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button, Card, Field, H2, Muted, Notice, Screen } from '@/components/ui';
import { cleanBarcode, isValidBarcode, LabelSchema, type Product } from '@/core/barcode';
import { makeCustomItem } from '@/core/nutrition';
import { useT, type Key } from '@/i18n';
import { lookupProduct } from '@/lib/data';
import { colors } from '@/lib/theme';
import { useDraft } from '@/state/draft';

type Stage = { name: 'start' } | { name: 'searching' } | { name: 'found'; code: string; product: Product } | { name: 'label'; code: string; reason: Key };

/** Packaged food: scan or type the barcode, look the product up, confirm how much was eaten. Missing products fall back to typing the label. */
export default function Barcode() {
  const t = useT();
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const addItem = useDraft((s) => s.addItem);
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>({ name: 'start' });
  const [cameraOn, setCameraOn] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [grams, setGrams] = useState('');
  const [label, setLabel] = useState({ name: '', kcal: '', protein_g: '', carbs_g: '', fat_g: '' });
  const busy = useRef(false);

  async function find(raw: string) {
    const code = cleanBarcode(raw);
    if (busy.current) return;
    setError('');
    if (!isValidBarcode(code)) return setError(t('bc.invalid'));
    busy.current = true;
    setCameraOn(false);
    setStage({ name: 'searching' });
    const r = await lookupProduct(code);
    busy.current = false;
    if (r.ok) {
      setGrams(String(r.product.servingGrams ?? 100));
      setStage({ name: 'found', code, product: r.product });
    } else {
      setStage({ name: 'label', code, reason: r.reason === 'not_found' ? 'bc.notFound' : r.reason === 'no_nutrition' ? 'bc.noNutrition' : 'bc.badResponse' });
    }
  }

  async function startCamera() {
    setError('');
    if (!permission?.granted) {
      const p = await requestPermission();
      if (!p.granted) return setError(t('scan.camPerm'));
    }
    setCameraOn(true);
  }

  const amount = Number(grams.replace(',', '.'));
  // opened from Today: continue to the review screen; opened from the review screen: just go back to it
  const done = () => (next === 'review' ? router.replace('/review') : router.back());

  function addProduct(code: string, p: Product) {
    if (!(amount > 0 && amount <= 2000)) return setError(t('review.saveFail'));
    addItem(makeCustomItem(`pkg:${code}`, p.brand ? `${p.name} (${p.brand})` : p.name, p.per100g, Math.round(amount)));
    done();
  }

  function addLabel() {
    const r = LabelSchema.safeParse({ ...label, fiber_g: 0 });
    if (!r.success || !(amount > 0 && amount <= 2000)) return setError(t('bc.labelInvalid'));
    const { name, ...per100g } = r.data;
    addItem(makeCustomItem(`custom:${name.toLowerCase()}`, name, per100g, Math.round(amount)));
    done();
  }

  return (
    <Screen>
      {stage.name === 'start' ? (
        <>
          <Muted>{t('bc.tip')}</Muted>
          {cameraOn ? (
            <View style={{ height: 260, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' }}>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
                onBarcodeScanned={({ data }) => find(data)}
              />
            </View>
          ) : (
            <Button title={`📷  ${t('bc.camera')}`} onPress={startCamera} />
          )}
          <Field label={t('bc.number')} value={typed} onChangeText={setTyped} keyboardType="number-pad" onSubmitEditing={() => find(typed)} maxLength={20} />
          <Button title={t('bc.lookup')} variant="secondary" onPress={() => find(typed)} />
        </>
      ) : null}

      {stage.name === 'searching' ? (
        <View style={{ alignItems: 'center', gap: 8, padding: 24 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Muted>{t('bc.searching')}</Muted>
        </View>
      ) : null}

      {stage.name === 'found' ? (
        <>
          <Card>
            <H2>{stage.product.name}</H2>
            {stage.product.brand ? <Muted>{stage.product.brand}</Muted> : null}
            <Text style={{ color: colors.text }}>
              {t('bc.per100', { kcal: stage.product.per100g.kcal, p: stage.product.per100g.protein_g, c: stage.product.per100g.carbs_g, f: stage.product.per100g.fat_g })}
            </Text>
            <Muted>{t('bc.source')}</Muted>
          </Card>
          <Field label={t('bc.amount')} value={grams} onChangeText={setGrams} keyboardType="decimal-pad" />
          <Button title={t('bc.add')} onPress={() => addProduct(stage.code, stage.product)} />
        </>
      ) : null}

      {stage.name === 'label' ? (
        <>
          <Notice>{t(stage.reason)}</Notice>
          <H2>{t('bc.labelTitle')}</H2>
          <Muted>{t('bc.labelHint')}</Muted>
          <Field label={t('bc.name')} value={label.name} onChangeText={(v) => setLabel({ ...label, name: v })} maxLength={60} />
          <Field label={t('bc.kcal100')} value={label.kcal} onChangeText={(v) => setLabel({ ...label, kcal: v })} keyboardType="decimal-pad" />
          <Field label={t('bc.protein100')} value={label.protein_g} onChangeText={(v) => setLabel({ ...label, protein_g: v })} keyboardType="decimal-pad" />
          <Field label={t('bc.carbs100')} value={label.carbs_g} onChangeText={(v) => setLabel({ ...label, carbs_g: v })} keyboardType="decimal-pad" />
          <Field label={t('bc.fat100')} value={label.fat_g} onChangeText={(v) => setLabel({ ...label, fat_g: v })} keyboardType="decimal-pad" />
          <Field label={t('bc.amount')} value={grams} onChangeText={setGrams} keyboardType="decimal-pad" />
          <Button title={t('bc.add')} onPress={addLabel} />
        </>
      ) : null}

      {error ? <Notice>{error}</Notice> : null}
    </Screen>
  );
}
