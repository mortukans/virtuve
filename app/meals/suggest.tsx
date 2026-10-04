/**
 * "Ko ēdam?" generator. Collects a MealQuery (mood / craving / effort / max time
 * / who eats / guests / cheap / use-expiring), asks the AI for 3 recipes, lazily
 * fills in preview images, and offers to start a household vote on the results.
 * Route params: ?focus=<product> pins a product the recipes must use; ?expiring=1
 * presets "izlietot drīz". Either one auto-generates once on mount.
 *
 * Redesign ("Virtuve dzīvo"): the composer is a vertically scrolling canvas of
 * expressive cards — a mood grid of SelectCard tiles, segmented effort, a compact
 * time rail, craving + who-eats chips — with a bottom-anchored saffron generate
 * button over a soft fade. Generating is its own lively state; results open on a
 * celebratory hero. Visual only: every bit of the query/generate wiring is kept.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { aiRecipeImage, aiRecipes, getInventory, startVote } from '@src/api/rpc';
import { qk } from '@src/api/queryClient';
import type { Effort, MealQuery, Mood, Recipe } from '@src/api/types';
import { useHouseholdCtx } from '@src/household/context';
import { useAction } from '@src/ui/useAction';
import {
  Body, Button, Card, Chip, Hero, IconButton, IngredientConstellation, Muted, Row, SectionLabel,
  Segmented, SelectCard,
} from '@src/ui/kit';
import { colors, spacing, type as t, withAlpha } from '@src/ui/theme';
import { cravingLabel, effortLabel, L, moodLabel } from '@src/i18n/lv';
import { RecipeCard } from '@src/meals/RecipeCard';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type TimeKey = '10' | '20' | '30' | 'any';

/** Expressive glyph per mood for the SelectCard grid. */
const moodIcon: Record<Mood, IconName> = {
  fast: 'flash',
  healthy: 'leaf',
  hungry: 'flame',
  comfort: 'fast-food',
  light: 'leaf-outline',
  use_soon: 'time',
  any: 'sparkles',
};

/** Short Latvian status phrases cycled while the AI is thinking. */
const GEN_PHRASES = ['Skatos, kas ir virtuvē…', 'Meklēju labāko kombināciju…', L.meals.thinking];

/** Soft transparent→bg fade so scroll content reads under the pinned button. */
function FadeMask() {
  const bands = 8;
  return (
    <View pointerEvents="none" style={styles.fade}>
      {Array.from({ length: bands }).map((_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: withAlpha(colors.bg, i / bands) }} />
      ))}
    </View>
  );
}

export default function Suggest() {
  const { household, activeId } = useHouseholdCtx();
  const members = household?.members ?? [];
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{ focus?: string | string[]; expiring?: string | string[] }>();
  const focus = (Array.isArray(params.focus) ? params.focus[0] : params.focus)?.trim() || undefined;
  const expiringParam = (Array.isArray(params.expiring) ? params.expiring[0] : params.expiring) === '1';

  const [mood, setMood] = useState<Mood>('any');
  const [craving, setCraving] = useState<string | null>(null);
  const [effort, setEffort] = useState<Effort>('normal');
  const [timeKey, setTimeKey] = useState<TimeKey>('any');
  const [eaters, setEaters] = useState<string[]>([]);
  const [initEaters, setInitEaters] = useState(false);
  const [guests, setGuests] = useState(0);
  const [cheap, setCheap] = useState(false);
  const [expiring, setExpiring] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);

  const [footerH, setFooterH] = useState(150);
  const [phrase, setPhrase] = useState(0);

  const { run, busy } = useAction();
  const voteAction = useAction();

  const inventory = useQuery({ queryKey: qk.inventory(activeId!), queryFn: () => getInventory(activeId!), enabled: !!activeId });
  const inventoryEmpty = inventory.data?.length === 0;

  useEffect(() => {
    if (!initEaters && members.length) {
      setEaters(members.filter((m) => m.eats_by_default).map((m) => m.id));
      setInitEaters(true);
    }
  }, [members, initEaters]);

  // Cycle the "thinking" phrases only while generating.
  useEffect(() => {
    if (!busy) { setPhrase(0); return; }
    const id = setInterval(() => setPhrase((p) => (p + 1) % GEN_PHRASES.length), 1800);
    return () => clearInterval(id);
  }, [busy]);

  const toggleEater = (id: string) =>
    setEaters((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const loadImages = (list: Recipe[]) => {
    list.forEach((r) => {
      if (r.image_url) return;
      aiRecipeImage(r.id)
        .then((res) => {
          if (res?.image_url) {
            setRecipes((cur) => (cur ? cur.map((x) => (x.id === r.id ? { ...x, image_url: res.image_url, image_is_ai: true } : x)) : cur));
          }
        })
        .catch(() => undefined);
    });
  };

  const generate = (overrides?: Partial<MealQuery>) => {
    if (!activeId) return;
    const query: MealQuery = {
      mood,
      effort,
      max_time_min: timeKey === 'any' ? null : Number(timeKey),
      eaters,
      cheap,
      prioritise_expiring: expiring,
      ...(craving ? { craving: cravingLabel[craving] } : null),
      ...(guests > 0 ? { guests } : null),
      ...(focus ? { focus } : null),
      ...overrides,
    };
    void run(() => aiRecipes(activeId, query), {
      onDone: (res) => {
        setRecipes(res.recipes);
        loadImages(res.recipes);
      },
    });
  };

  // "Esmu noguris" — fast, minimal effort, ≤20 min, then generate right away.
  const generateTired = () => {
    setMood('fast');
    setEffort('minimal');
    setTimeKey('20');
    generate({ mood: 'fast', effort: 'minimal', max_time_min: 20 });
  };

  // Arriving with ?focus=<product> or ?expiring=1 presets the query and generates once.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !activeId) return;
    if (focus) {
      autoRan.current = true;
      generate({ focus });
    } else if (expiringParam) {
      autoRan.current = true;
      setExpiring(true);
      setMood('use_soon');
      generate({ prioritise_expiring: true, mood: 'use_soon' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, focus, expiringParam]);

  const startVoteNow = () => {
    if (!activeId || !recipes?.length) return;
    void voteAction.run(() => startVote(activeId, recipes.map((r) => r.id)), {
      onDone: (session) => router.push(`/vote/${session.id}`),
    });
  };

  const moods = Object.keys(moodLabel) as Mood[];
  const cravings = Object.keys(cravingLabel);
  // Chunk moods into rows of two for the expressive tile grid.
  const moodRows: Mood[][] = [];
  for (let i = 0; i < moods.length; i += 2) moodRows.push(moods.slice(i, i + 2));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.topbar}>
        <IconButton icon="chevron-back" bg onPress={() => router.back()} />
        <Text style={styles.topbarTitle}>Šovakar</Text>
        <View style={{ width: 44 }} />
      </View>

      {busy ? (
        // ── Generating ───────────────────────────────────────────────────────
        <View style={styles.generating}>
          <IngredientConstellation size={1.5} />
          <Hero style={{ textAlign: 'center', marginTop: spacing.xl }}>{L.meals.composerTitle}</Hero>
          <Row gap={spacing.sm} style={{ justifyContent: 'center', marginTop: spacing.lg }}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[t.body, styles.genPhrase]}>{GEN_PHRASES[phrase]}</Text>
          </Row>
        </View>
      ) : recipes ? (
        // ── Results ──────────────────────────────────────────────────────────
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.huge }]}
          showsVerticalScrollIndicator={false}
        >
          <Hero>{`${L.meals.ideasTitle} 🎉`}</Hero>
          <Muted style={{ marginTop: 6 }}>{L.meals.results}</Muted>

          <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
            {recipes.map((r) => (
              <RecipeCard key={r.id} recipe={r} activeId={activeId!} />
            ))}
            {recipes.length > 1 ? (
              <Button label={L.meals.startVote} icon="people-outline" loading={voteAction.busy} onPress={() => startVoteNow()} />
            ) : null}
            <Button label={L.meals.anotherOption} icon="refresh-outline" variant="secondary" onPress={() => generate()} />
          </View>
        </ScrollView>
      ) : (
        // ── Composer ─────────────────────────────────────────────────────────
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.content, { paddingBottom: footerH + spacing.md }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Hero>{L.meals.composerTitle}</Hero>
            <Body muted style={styles.intro}>{L.meals.composerIntro}</Body>

            {focus ? (
              <Card style={styles.focusCard}>
                <Row gap={spacing.md}>
                  <View style={styles.medallion}>
                    <Ionicons name="restaurant" size={18} color={colors.accent} />
                  </View>
                  <Text style={[t.body, { flex: 1 }]}>
                    Izmantojam: <Text style={{ color: colors.accent, fontWeight: '700' }}>{focus}</Text>
                  </Text>
                </Row>
              </Card>
            ) : null}

            {inventoryEmpty ? (
              <Card style={styles.infoCard}>
                <Body style={{ marginBottom: spacing.md }}>{L.meals.emptyInventory}</Body>
                <Button label={L.home.scanFridge} icon="camera-outline" onPress={() => router.push('/scan')} />
              </Card>
            ) : null}

            <Card onPress={generateTired} style={styles.tiredCard}>
              <Row gap={spacing.md}>
                <View style={styles.medallion}>
                  <Ionicons name="bed-outline" size={22} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={t.bodyStrong}>{L.meals.tired}</Text>
                  <Text style={[t.small, { marginTop: 2 }]}>{L.meals.tiredDesc}</Text>
                </View>
                <Ionicons name="sparkles" size={18} color={colors.accentSoft} />
              </Row>
            </Card>

            <SectionLabel style={styles.label}>{L.meals.pickMood}</SectionLabel>
            {moodRows.map((row, ri) => (
              <View key={ri} style={styles.gridRow}>
                {row.map((m) => (
                  <SelectCard
                    key={m}
                    title={moodLabel[m]}
                    icon={moodIcon[m]}
                    selected={mood === m}
                    onPress={() => setMood(m)}
                    minHeight={96}
                  />
                ))}
                {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
              </View>
            ))}

            <SectionLabel style={styles.label}>{L.meals.pickEffort}</SectionLabel>
            <Segmented<Effort>
              value={effort}
              onChange={setEffort}
              options={[
                { value: 'minimal', label: effortLabel.minimal },
                { value: 'normal', label: effortLabel.normal },
                { value: 'can_cook', label: effortLabel.can_cook },
              ]}
            />

            <SectionLabel style={styles.label}>{L.meals.maxTime}</SectionLabel>
            <View style={styles.wrap}>
              <Chip label={L.meals.min10} selected={timeKey === '10'} onPress={() => setTimeKey('10')} />
              <Chip label={L.meals.min20} selected={timeKey === '20'} onPress={() => setTimeKey('20')} />
              <Chip label={L.meals.min30} selected={timeKey === '30'} onPress={() => setTimeKey('30')} />
              <Chip label={L.meals.anyTime} selected={timeKey === 'any'} onPress={() => setTimeKey('any')} />
            </View>

            <SectionLabel style={styles.label}>{L.meals.craving}</SectionLabel>
            <View style={styles.wrap}>
              {cravings.map((c) => (
                <Chip
                  key={c}
                  label={cravingLabel[c]}
                  selected={craving === c}
                  onPress={() => setCraving((cur) => (cur === c ? null : c))}
                />
              ))}
            </View>

            {members.length > 0 ? (
              <>
                <SectionLabel style={styles.label}>{L.meals.whoEats}</SectionLabel>
                <View style={styles.wrap}>
                  {members.map((m) => {
                    const on = eaters.includes(m.id);
                    return (
                      <Chip
                        key={m.id}
                        label={m.display_name}
                        selected={on}
                        icon={on ? 'checkmark-circle' : 'person-outline'}
                        onPress={() => toggleEater(m.id)}
                      />
                    );
                  })}
                </View>
              </>
            ) : null}

            <Card style={styles.guestsCard}>
              <Row gap={spacing.md}>
                <View style={styles.guestsIcon}>
                  <Ionicons name="people-outline" size={20} color={colors.text} />
                </View>
                <Text style={[t.bodyStrong, { flex: 1 }]}>{L.meals.guests}</Text>
                <Row gap={spacing.md}>
                  <IconButton icon="remove-circle-outline" color={colors.accent} onPress={() => setGuests((g) => Math.max(0, g - 1))} />
                  <Text style={[t.bodyStrong, { minWidth: 24, textAlign: 'center' }]}>{guests}</Text>
                  <IconButton icon="add-circle-outline" color={colors.accent} onPress={() => setGuests((g) => g + 1)} />
                </Row>
              </Row>
            </Card>

            <SectionLabel style={styles.label}>Papildu</SectionLabel>
            <View style={styles.wrap}>
              <Chip
                label="Taupīgi"
                selected={cheap}
                icon={cheap ? 'checkmark-circle' : 'wallet-outline'}
                onPress={() => setCheap((v) => !v)}
              />
              <Chip
                label="Izlietot, kas drīz jāizlieto"
                selected={expiring}
                icon={expiring ? 'checkmark-circle' : 'time-outline'}
                onPress={() => setExpiring((v) => !v)}
              />
            </View>
          </ScrollView>

          <View style={styles.footer} onLayout={(e) => setFooterH(e.nativeEvent.layout.height)} pointerEvents="box-none">
            <FadeMask />
            <View style={[styles.footerPanel, { paddingBottom: insets.bottom + spacing.md }]}>
              <Button label={L.meals.generate} icon="restaurant" onPress={() => generate()} />
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm,
  },
  topbarTitle: { flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },

  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  intro: { marginTop: spacing.sm, lineHeight: 23 },
  label: { marginTop: spacing.xl, marginBottom: spacing.md },

  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm, marginBottom: spacing.sm },

  medallion: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(colors.accent, 0.14) },
  focusCard: { marginTop: spacing.lg, borderColor: withAlpha(colors.accent, 0.5) },
  infoCard: { marginTop: spacing.lg },
  tiredCard: { marginTop: spacing.lg },

  guestsCard: { marginTop: spacing.xl },
  guestsIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  fade: { height: 56, flexDirection: 'column' },
  footerPanel: { backgroundColor: colors.bg, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  generating: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  genPhrase: { marginLeft: spacing.sm, color: colors.textMuted },
});
