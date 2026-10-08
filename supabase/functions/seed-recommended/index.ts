// Seed a curated set of free, global "recommended" recipes (household_id = null),
// each with a real food photo. Idempotent: upserts by fixed id so re-running is
// safe. Reads need no membership (the recipes RLS allows household_id is null),
// so the app lists them with a direct select; only the write needs service role.
import { json, preflight } from '../_shared/cors.ts';
import { adminClient, HttpError, requireUser } from '../_shared/supa.ts';

type Ing = { name: string; qty: string; have: boolean };
type Step = { n: number; text: string; timer_min?: number };
type Seed = {
  id: string; title: string; summary: string; active: number; total: number; servings: number;
  kcal: number; cost: number; tags: string[]; image: string; ingredients: Ing[]; steps: string[];
};

const IMG = (f: string) => `https://www.themealdb.com/images/media/meals/${f}`;
const ing = (name: string, qty: string): Ing => ({ name, qty, have: false });

const RECIPES: Seed[] = [
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    title: 'Krēmīga vistas un spinātu pasta',
    summary: 'Ātra vienas pannas pasta ar maigu krējuma mērci un svaigiem spinātiem.',
    active: 15, total: 25, servings: 4, kcal: 620, cost: 5.5, tags: ['fast', 'comfort', 'one_pan'],
    image: IMG('wvqpwt1468339226.jpg'),
    ingredients: [ing('Pasta (penne vai spageti)', '400 g'), ing('Vistas fileja', '400 g'), ing('Spināti', '150 g'), ing('Krējums', '200 ml'), ing('Ķiploks', '2 daiviņas'), ing('Parmezāns', '50 g'), ing('Olīveļļa', '2 ēd.k.'), ing('Sāls un pipari', 'pēc garšas')],
    steps: [
      'Uzvāri pastu sālsūdenī līdz al dente, nokās un atstāj malā.',
      'Sagriez vistu gabaliņos un apcep olīveļļā uz vidējas uguns 5–6 min, līdz zeltaina.',
      'Pievieno sasmalcinātu ķiploku, pēc minūtes ielej krējumu un ļauj sautēties.',
      'Iemaisi spinātus un rīvētu parmezānu, līdz spināti savīst un mērce sabiezē.',
      'Pievieno pastu, samaisi, pagaršo ar sāli un pipariem un pasniedz.',
    ],
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000002',
    title: 'Dārzeņu zupa',
    summary: 'Sātīga, lēta zupa no tā, kas ledusskapī — ideāla aukstai dienai.',
    active: 15, total: 35, servings: 4, kcal: 220, cost: 3.0, tags: ['healthy', 'cheap', 'light', 'vegetarian'],
    image: IMG('x2fw9e1560460636.jpg'),
    ingredients: [ing('Kartupeļi', '3 gab.'), ing('Burkāns', '2 gab.'), ing('Sīpols', '1 gab.'), ing('Puravs vai kāposts', '200 g'), ing('Dārzeņu buljons', '1,2 l'), ing('Olīveļļa', '2 ēd.k.'), ing('Pētersīļi', 'sauja'), ing('Sāls un pipari', 'pēc garšas')],
    steps: [
      'Sagriez sīpolu un burkānu, apcep katlā olīveļļā 5 min.',
      'Pievieno kubiņos grieztus kartupeļus un pārējos dārzeņus.',
      'Ielej karsto buljonu un vāri uz lēnas uguns 20 min, līdz dārzeņi mīksti.',
      'Pagaršo ar sāli un pipariem, pārkaisi ar pētersīļiem un pasniedz ar maizi.',
    ],
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000003',
    title: 'Cepta vista ar kartupeļiem',
    summary: 'Klasika krāsnī — kraukšķīga vista un zeltaini kartupeļi vienā pannā.',
    active: 15, total: 55, servings: 4, kcal: 680, cost: 6.0, tags: ['comfort', 'high_protein', 'one_pan'],
    image: IMG('wyxwsp1486979827.jpg'),
    ingredients: [ing('Vistas stilbiņi vai spārniņi', '1 kg'), ing('Kartupeļi', '800 g'), ing('Ķiploks', '4 daiviņas'), ing('Olīveļļa', '3 ēd.k.'), ing('Paprika (malta)', '1 tēj.k.'), ing('Timiāns vai rozmarīns', '1 tēj.k.'), ing('Sāls un pipari', 'pēc garšas')],
    steps: [
      'Uzkarsē krāsni līdz 200 °C.',
      'Sagriez kartupeļus daiviņās, sajauc ar eļļu, garšvielām un ķiploku.',
      'Ieliec pannā kopā ar vistu, pārkaisi ar sāli, papriku un timiānu.',
      'Cep 40–45 min, līdz vista kraukšķīga un kartupeļi mīksti (iekšējā temp. vismaz 75 °C).',
      'Pirms pasniegšanas ļauj dažas minūtes atpūsties.',
    ],
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000004',
    title: 'Lasis ar dārzeņiem krāsnī',
    summary: 'Veselīgs, viegls un gatavs 25 minūtēs — lasis ar sezonas dārzeņiem.',
    active: 10, total: 25, servings: 2, kcal: 480, cost: 7.0, tags: ['healthy', 'high_protein', 'fast', 'light'],
    image: IMG('ikizdm1763760862.jpg'),
    ingredients: [ing('Laša fileja', '2 gab. (300 g)'), ing('Brokoļi', '200 g'), ing('Ķiršu tomāti', '150 g'), ing('Citrons', '1/2 gab.'), ing('Olīveļļa', '2 ēd.k.'), ing('Ķiploks', '1 daiviņa'), ing('Sāls un pipari', 'pēc garšas')],
    steps: [
      'Uzkarsē krāsni līdz 200 °C un pārklāj plāti ar cepampapīru.',
      'Izklāj brokoļus un tomātus, apslaki ar eļļu, sāli un ķiploku.',
      'Uzliec laša filejas, apslaki ar citrona sulu un eļļu.',
      'Cep 12–15 min, līdz lasis viegli pārslojas ar dakšiņu. Pasniedz uzreiz.',
    ],
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000005',
    title: 'Grieķu salāti ar fetu',
    summary: 'Svaigs, kraukšķīgs salāts bez gatavošanas — 10 minūtēs uz galda.',
    active: 10, total: 10, servings: 2, kcal: 320, cost: 4.0, tags: ['healthy', 'fast', 'light', 'vegetarian'],
    image: IMG('7ytdtz1784833420.jpg'),
    ingredients: [ing('Tomāti', '3 gab.'), ing('Gurķis', '1 gab.'), ing('Sarkanais sīpols', '1/2 gab.'), ing('Fetas siers', '150 g'), ing('Olīvas', '50 g'), ing('Olīveļļa', '3 ēd.k.'), ing('Oregano', '1 tēj.k.'), ing('Sāls', 'pēc garšas')],
    steps: [
      'Sagriez tomātus un gurķi lielākos gabalos, sīpolu plānās šķēlēs.',
      'Sajauc bļodā ar olīvām.',
      'Uzliec virsū fetas gabalu, apslaki ar olīveļļu un pārkaisi ar oregano un sāli.',
      'Pasniedz ar svaigu maizi.',
    ],
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000006',
    title: 'Pankūkas',
    summary: 'Plānās pankūkas brokastīm vai našķim — ar ievārījumu vai skābo krējumu.',
    active: 15, total: 30, servings: 4, kcal: 350, cost: 2.5, tags: ['cheap', 'comfort', 'vegetarian'],
    image: IMG('rwuyqx1511383174.jpg'),
    ingredients: [ing('Milti', '250 g'), ing('Piens', '500 ml'), ing('Olas', '2 gab.'), ing('Cukurs', '1 ēd.k.'), ing('Sāls', 'šķipsna'), ing('Sviests cepšanai', '30 g')],
    steps: [
      'Sakuļ olas ar cukuru un sāli, pakāpeniski pievieno pienu un miltus, līdz mīkla gluda.',
      'Ļauj mīklai pastāvēt 10 min.',
      'Karsē pannu, viegli ieeļļo un lej plānu kārtu mīklas.',
      'Cep katru pusi ~1 min, līdz zeltaina. Pasniedz ar ievārījumu.',
    ],
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000007',
    title: 'Sēņu risoto',
    summary: 'Krēmīgs itāļu risoto ar sēnēm un parmezānu — mājīgs un piesātinošs.',
    active: 25, total: 35, servings: 3, kcal: 520, cost: 5.0, tags: ['comfort', 'vegetarian'],
    image: IMG('xxrxux1503070723.jpg'),
    ingredients: [ing('Risoto rīsi (Arborio)', '300 g'), ing('Šampinjoni', '300 g'), ing('Sīpols', '1 gab.'), ing('Dārzeņu buljons', '1 l'), ing('Baltvīns (neobligāti)', '100 ml'), ing('Parmezāns', '50 g'), ing('Sviests', '30 g'), ing('Olīveļļa', '2 ēd.k.')],
    steps: [
      'Apcep sasmalcinātu sīpolu eļļā, pievieno šķēlēs grieztas sēnes un cep 5 min.',
      'Pievieno rīsus un maisot apcep minūti, ielej vīnu (ja lieto).',
      'Pa pusei lej karsto buljonu, nepārtraukti maisot, līdz šķidrums uzsūcas.',
      'Turpini ~18 min, līdz rīsi mīksti, bet viegli izteikti.',
      'Noņem no uguns, iemaisi sviestu un parmezānu, pasniedz uzreiz.',
    ],
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000008',
    title: 'Vistas karijs ar rīsiem',
    summary: 'Aromātisks karijs ar maigu kokosmērci — pasniedz ar tvaicētiem rīsiem.',
    active: 20, total: 40, servings: 4, kcal: 600, cost: 6.0, tags: ['comfort', 'high_protein'],
    image: IMG('sstssx1487349585.jpg'),
    ingredients: [ing('Vistas fileja', '500 g'), ing('Kokospiens', '400 ml'), ing('Sīpols', '1 gab.'), ing('Ķiploks', '2 daiviņas'), ing('Karija pasta vai pulveris', '2 ēd.k.'), ing('Rīsi', '300 g'), ing('Olīveļļa', '2 ēd.k.'), ing('Sāls', 'pēc garšas')],
    steps: [
      'Uzvāri rīsus pēc iepakojuma norādēm.',
      'Apcep sīpolu un ķiploku eļļā, pievieno gabaliņos grieztu vistu un apcep.',
      'Iemaisi karija pastu, pēc minūtes ielej kokospienu.',
      'Sautē 15 min uz lēnas uguns, līdz vista gatava un mērce sabiezē.',
      'Pagaršo ar sāli un pasniedz ar rīsiem.',
    ],
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000009',
    title: 'Dārzeņu omlete',
    summary: 'Ātras un sātīgas brokastis vai vakariņas no olām un dārzeņiem.',
    active: 10, total: 15, servings: 2, kcal: 300, cost: 2.5, tags: ['fast', 'healthy', 'high_protein', 'vegetarian', 'one_pan'],
    image: IMG('hqaejl1695738653.jpg'),
    ingredients: [ing('Olas', '4 gab.'), ing('Paprika', '1 gab.'), ing('Tomāts', '1 gab.'), ing('Sīpolloki', '2 ēd.k.'), ing('Siers', '50 g'), ing('Sviests', '20 g'), ing('Sāls un pipari', 'pēc garšas')],
    steps: [
      'Sakuļ olas ar sāli un pipariem.',
      'Apcep sīki grieztu papriku un tomātu pannā ar sviestu 3 min.',
      'Ielej olas, pārkaisi ar sieru un cep uz lēnas uguns, līdz olas sacietē.',
      'Pārloc uz pusēm, pārkaisi ar sīpollokiem un pasniedz.',
    ],
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-00000000000a',
    title: 'Mājas burgeri',
    summary: 'Sulīgi liellopa burgeri ar visu, ko mīli — labāki par ātrās ēdināšanas.',
    active: 25, total: 35, servings: 4, kcal: 720, cost: 6.5, tags: ['comfort', 'high_protein'],
    image: IMG('lgmnff1763789847.jpg'),
    ingredients: [ing('Malta liellopa gaļa', '500 g'), ing('Burgeru maizītes', '4 gab.'), ing('Siers (čedars)', '4 šķēles'), ing('Tomāts', '1 gab.'), ing('Salātlapas', '4 lapas'), ing('Sīpols', '1 gab.'), ing('Sāls un pipari', 'pēc garšas')],
    steps: [
      'Sajauc gaļu ar sāli un pipariem, izveido 4 plācenīšus.',
      'Cep uz karstas pannas vai grila 3–4 min katru pusi.',
      'Pēdējā minūtē uzliec sieru, lai izkūst.',
      'Apgraudē maizītes un saliec kārtām: salāti, kotlete, tomāts, sīpols.',
      'Pasniedz ar iecienītajām mērcēm.',
    ],
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-00000000000b',
    title: 'Spageti boloņēze',
    summary: 'Iecienītā ģimenes klasika — bagātīga gaļas mērce ar spageti.',
    active: 20, total: 45, servings: 4, kcal: 650, cost: 5.0, tags: ['comfort', 'cheap', 'high_protein'],
    image: IMG('pbzcrx1763765096.jpg'),
    ingredients: [ing('Spageti', '400 g'), ing('Malta gaļa', '400 g'), ing('Tomātu mērce (passata)', '500 g'), ing('Sīpols', '1 gab.'), ing('Burkāns', '1 gab.'), ing('Ķiploks', '2 daiviņas'), ing('Olīveļļa', '2 ēd.k.'), ing('Sāls, pipari, oregano', 'pēc garšas')],
    steps: [
      'Apcep sīpolu, burkānu un ķiploku eļļā 5 min.',
      'Pievieno malto gaļu un apcep, līdz tā brūna.',
      'Ielej tomātu mērci, pievieno garšvielas un sautē 20 min uz lēnas uguns.',
      'Pa to laiku uzvāri spageti sālsūdenī al dente.',
      'Pasniedz spageti ar mērci un rīvētu parmezānu.',
    ],
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-00000000000c',
    title: 'Gaļas un dārzeņu sautējums',
    summary: 'Lēni sautēta, sātīga gaļa ar dārzeņiem — mājīgs viena katla ēdiens.',
    active: 20, total: 90, servings: 5, kcal: 560, cost: 6.0, tags: ['comfort', 'high_protein', 'one_pan'],
    image: IMG('sxxpst1468569714.jpg'),
    ingredients: [ing('Liellopa vai cūkas gaļa (sautēšanai)', '700 g'), ing('Kartupeļi', '4 gab.'), ing('Burkāns', '2 gab.'), ing('Sīpols', '1 gab.'), ing('Tomātu biezenis', '2 ēd.k.'), ing('Gaļas buljons', '600 ml'), ing('Olīveļļa', '2 ēd.k.'), ing('Lauru lapa, sāls, pipari', 'pēc garšas')],
    steps: [
      'Sagriez gaļu kubiņos un apcep katlā eļļā, līdz brūna no visām pusēm.',
      'Pievieno sīpolu un burkānu, apcep 5 min.',
      'Iemaisi tomātu biezeni, ielej buljonu un pievieno garšvielas.',
      'Sautē zem vāka uz lēnas uguns 60 min.',
      'Pievieno kartupeļus un sautē vēl 20 min, līdz viss mīksts.',
    ],
  },
];

function toRow(s: Seed) {
  return {
    id: s.id,
    household_id: null,
    title: s.title,
    summary: s.summary,
    time_active_min: s.active,
    time_total_min: s.total,
    servings: s.servings,
    kcal: s.kcal,
    tags: s.tags,
    ingredients: s.ingredients,
    steps: s.steps.map((text, i) => ({ n: i + 1, text } as Step)),
    uses_item_ids: [],
    missing: [],
    est_cost_eur: s.cost,
    image_url: s.image,
    image_is_ai: false,
    source: 'family',
    created_by: null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    await requireUser(req); // any signed-in user may trigger the idempotent seed
    const admin = adminClient();
    const rows = RECIPES.map(toRow);
    // Idempotent upsert by fixed id — re-running updates content/images in place.
    const { error } = await admin.from('recipes').upsert(rows, { onConflict: 'id' });
    if (error) throw new HttpError(500, error.message);
    return json({ seeded: rows.length });
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(500, 'error');
    return json({ error: err.code }, err.status);
  }
});
