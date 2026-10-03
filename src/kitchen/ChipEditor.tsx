/**
 * Virtuve kitchen — ChipEditor: build a list of free-text names shown as
 * removable chips. Used for the "Vienmēr mājās" staples editor. Adds on the
 * inline "+" or the keyboard return; keeps the keyboard open for fast entry.
 */
import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Chip, IconButton } from '@src/ui/kit';
import { colors, radius, spacing } from '@src/ui/theme';

export function ChipEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft('');
  };
  const remove = (name: string) => onChange(values.filter((x) => x !== name));

  return (
    <View>
      {values.length > 0 ? (
        <View style={styles.chips}>
          {values.map((v) => (
            <Chip key={v} label={v} selected onRemove={() => remove(v)} />
          ))}
        </View>
      ) : null}
      <View style={styles.inputWrap}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          onSubmitEditing={add}
          returnKeyType="done"
          blurOnSubmit={false}
          autoCapitalize="sentences"
          style={styles.input}
        />
        <IconButton icon="add-circle" onPress={add} color={colors.accent} size={28} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.md,
    paddingRight: 4,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 12 },
});
