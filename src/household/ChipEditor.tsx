/**
 * ChipEditor — a reusable free-text tag editor. Shows the current tags as
 * removable Chips and a small input row to add new ones. Used across onboarding
 * and member profiles (likes / dislikes / never / allergies / cuisines …).
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Chip, IconButton, Row } from '@src/ui/kit';
import { colors, radius, spacing, type as t } from '@src/ui/theme';

export function ChipEditor({
  label, tags, onChange, placeholder, color = colors.accent, warning,
}: {
  label?: string;
  tags: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Chip colour — e.g. red for allergies. */
  color?: string;
  /** Small note under the editor (e.g. the allergy warning). */
  warning?: string;
}) {
  const [text, setText] = useState('');

  const add = () => {
    const value = text.trim();
    if (!value) { setText(''); return; }
    const exists = tags.some((x) => x.toLowerCase() === value.toLowerCase());
    if (!exists) onChange([...tags, value]);
    setText('');
  };
  const remove = (tag: string) => onChange(tags.filter((x) => x !== tag));

  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={[t.small, { marginBottom: 6 }]}>{label}</Text> : null}

      {tags.length > 0 ? (
        <View style={styles.wrap}>
          {tags.map((tag) => (
            <Chip key={tag} label={tag} selected color={color} onRemove={() => remove(tag)} />
          ))}
        </View>
      ) : null}

      <Row gap={spacing.sm}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          onSubmitEditing={add}
          returnKeyType="done"
          blurOnSubmit={false}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <IconButton icon="add-circle" onPress={add} color={colors.accent} size={30} />
      </Row>

      {warning ? <Text style={[t.tiny, { color: colors.textFaint, marginTop: 6 }]}>{warning}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
});
