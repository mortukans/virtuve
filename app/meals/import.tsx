/**
 * "Importēt recepti" — bring an outside recipe into Virtuve. The user picks a
 * source (link / pasted text / screenshot), the ai-import edge function parses it
 * into a stored recipe, and we jump straight to the new recipe's detail screen.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { aiImportRecipe } from '@src/api/rpc';
import { useHouseholdCtx } from '@src/household/context';
import { useAction } from '@src/ui/useAction';
import { Body, Button, Field, IconButton, Screen, Segmented, Spinner } from '@src/ui/kit';
import { colors, radius, spacing, type as t } from '@src/ui/theme';
import { L } from '@src/i18n/lv';

type Source = 'url' | 'text' | 'image';

export default function ImportRecipe() {
  const { activeId } = useHouseholdCtx();
  const { run, busy } = useAction();

  const [source, setSource] = useState<Source>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);

  const pickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5 });
      if (res.canceled) return;
      const b64 = res.assets[0]?.base64;
      if (b64) setImage(b64);
    } catch {
      // ignore picker errors — the user can simply try again
    }
  };

  const canImport =
    source === 'url' ? url.trim().length > 0 : source === 'text' ? text.trim().length > 0 : !!image;

  const go = () => {
    if (!activeId || !canImport) return;
    let payload: { kind: Source; data: string };
    if (source === 'url') payload = { kind: 'url', data: url.trim() };
    else if (source === 'text') payload = { kind: 'text', data: text.trim() };
    else payload = { kind: 'image', data: image as string };

    void run(() => aiImportRecipe(activeId, payload), {
      onDone: (res) => router.replace(`/meals/${res.recipe.id}`),
    });
  };

  return (
    <Screen scroll>
      <View style={styles.head}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
        <Text style={t.h1}>{L.meals.importTitle}</Text>
      </View>

      <Body muted style={{ marginBottom: spacing.lg }}>{L.meals.importBody}</Body>

      <Segmented<Source>
        value={source}
        onChange={setSource}
        options={[
          { value: 'url', label: L.meals.importUrl },
          { value: 'text', label: L.meals.importText },
          { value: 'image', label: L.meals.importImage },
        ]}
      />

      <View style={{ marginTop: spacing.lg }}>
        {source === 'url' ? (
          <Field
            value={url}
            onChangeText={setUrl}
            placeholder={L.meals.importUrlPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
          />
        ) : null}

        {source === 'text' ? (
          <Field
            value={text}
            onChangeText={setText}
            placeholder={L.meals.importTextPlaceholder}
            multiline
            style={styles.multiline}
          />
        ) : null}

        {source === 'image' ? (
          image ? (
            <View style={{ gap: spacing.sm }}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${image}` }}
                style={styles.preview}
                contentFit="cover"
              />
              <Button
                variant="secondary"
                icon="image-outline"
                label="Izvēlēties citu attēlu"
                onPress={() => { void pickImage(); }}
              />
            </View>
          ) : (
            <Button
              variant="secondary"
              icon="image-outline"
              label="Izvēlēties ekrānšāviņu"
              onPress={() => { void pickImage(); }}
            />
          )
        ) : null}
      </View>

      <Button
        label={L.meals.importGo}
        icon="download-outline"
        loading={busy}
        disabled={!canImport}
        onPress={go}
        style={{ marginTop: spacing.lg }}
      />

      {busy ? (
        <View style={{ marginTop: spacing.xxl }}>
          <Spinner label={L.meals.importing} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, marginLeft: -spacing.sm },
  multiline: { minHeight: 160, paddingTop: 12, textAlignVertical: 'top' },
  preview: { width: '100%', height: 220, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
});
