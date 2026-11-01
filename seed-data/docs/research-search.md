# Arabic food search and barcode research

Research/read date: **2026-10-31**. References at the end give URLs and read dates. Normalization policy, examples, schema and ranking are proposed designs, not changes applied to the database.

## Summary

- Keep original Arabic for display; search a versioned, lossy normalized representation plus curated aliases. Character folding cannot translate dialect vocabulary. [T1–T5]
- Forty food lookup groups below distinguish Egyptian terms from formal/other-dialect forms and flag unsafe equivalences. **كتاكيت is not a safe alias for ordinary chicken meat.** [T3–T9]
- Recommended starting point: normalized stored terms, exact/prefix matching and GIN trigrams, with workspace visibility enforced before ranking. Supabase lists `pg_trgm` and `unaccent`; project installation was not checked. [T10–T15]
- EAN-13/EAN-8 carry GTIN-13/GTIN-8 and use the same modulo-10 check algorithm. Prefix 622 identifies GS1 Egypt allocation, not manufacture or nutrition accuracy. [T16–T19]

## Local context

Read [SPEC.md](../SPEC.md) and [existing-seed-0031.sql](../_context/existing-seed-0031.sql), 2026-10-31. The existing model scopes private food by **workspace**, not an individual coach ID; global rows have `workspace_id IS NULL`. RLS allows global plus current-workspace reads. Retain that boundary unless product requirements explicitly change it. The seed has no alias/search-normalization schema in the inspected insert file, and its `estimate_v1` values must not be treated as verified.

## 1. Exact normalization policy

Proposed policy **`food-search-ar-v1`**, applied identically to names, aliases and incoming queries. It extends Lucene's documented Arabic folds with explicit Unicode compatibility normalization, digits and whitespace handling. Unicode NFKC and Arabic-specific folding are different operations. [T1–T2]

Perform in this order:

1. Preserve the input separately. Apply **NFKC** to the search copy to regularize compatibility forms, including Arabic presentation forms. Do not use NFKD followed by indiscriminate mark deletion: that could change hamza handling. [T2]
2. Delete tatweel `U+0640`.
3. Delete Arabic combining marks in **U+0610–061A, U+064B–065F, U+0670, U+06D6–06DC, U+06DF–06E4, U+06E7–06E8, U+06EA–06ED**. These ranges are the proposed implementation contract; do not delete the entire Arabic Unicode block.
4. Apply the table below. Leave `ء`, `ؤ`, `ئ` unchanged; no general rule deleting hamza or replacing every hamza-bearing letter is proposed.
5. Convert `A–Z` to `a–z` using locale-independent ASCII folding. Arabic has no upper/lowercase equivalent. Other Latin accent folding is optional and must be separately versioned.
6. Replace every Unicode `White_Space` run with one ASCII space, then trim. This includes tabs, newlines and NBSP; it does not mean all invisible formatting controls. Reject or explicitly flag unexpected controls; do not silently concatenate words around them.
7. Preserve punctuation in this v1 key. Tokenization may ignore punctuation, but an exact-name key should not silently equate `0.5` with `05`. Escape SQL pattern metacharacters for prefix search.

The broader Arabic-mark ranges and wasla/digit folds are project choices; Lucene's cited implementation is precedent for the core alef/yeh/teh-marbuta/harakat/tatweel operations, not a claim that it implements this entire policy. [T1]

| Input | Code points | Output | Loss/risk |
|---|---|---|---|
| أ إ آ ٱ | U+0623, U+0625, U+0622, U+0671 | ا U+0627 | Loses hamza, madda and wasla distinctions; unrelated words can collide. |
| ى | U+0649 | ي U+064A | Loses maqsura/yeh distinction, e.g. على / علي; search only. |
| ة | U+0629 | ه U+0647 | Loses grammatical/spelling distinction; collision example هبة / هبه → هبه. Never rewrite display names. |
| ـ | U+0640 | empty | Decorative elongation lost; intended recall improvement. |
| Arabic marks in step 3 | Listed ranges | empty | Vowels/shadda can distinguish words and pronunciation; food identity still needs context. |
| ٠١٢٣٤٥٦٧٨٩ | U+0660–0669 | 0123456789 | Script distinction lost; numeric value retained. |
| ۰۱۲۳۴۵۶۷۸۹ | U+06F0–06F9 | 0123456789 | Extended Arabic-Indic digit support; same numeric value. |
| A–Z | U+0041–005A | a–z | Loses brand capitalization; retain originals. |
| Unicode whitespace runs | Unicode White_Space | single U+0020 | Layout lost; intentional. |
| Compatibility forms | NFKC-defined mappings | standard forms | Can merge typographical distinctions; keep normalization version. |

Do not remove `ال`, stem words, convert ت to ه, map ب to پ, transliterate Latin or infer dialect synonyms in this function. Those are separate lexical decisions. Do not make the normalized key globally unique: collisions are expected. These are recommendations.

### Fifteen deterministic test cases

These are authored acceptance examples under the policy above, not quoted lexical evidence. Input `\t`/`\n` below denotes an actual tab/newline before normalization.

| # | Input | Expected normalized form |
|---|---|---|
| 1 | أَرُزّ | ارز |
| 2 | إدام | ادام |
| 3 | آيس كريم | ايس كريم |
| 4 | ٱلْأَرُزّ | الارز |
| 5 | كُفْتَة | كفته |
| 6 | طَحِينَة | طحينه |
| 7 | مُلُوخِيَّة | ملوخيه |
| 8 | كمثرى | كمثري |
| 9 | طــماطم | طماطم |
| 10 | لبن ١٠٠ جم | لبن 100 جم |
| 11 | زبادي ۲۵۰ جم | زبادي 250 جم |
| 12 | `  فراخ\tمشوية\n ` | فراخ مشويه |
| 13 | WHEY Protein 30G | whey protein 30g |
| 14 | ﻻزانيا | لازانيا |
| 15 | تُفَّاح أخضر ٠١٢٣٤٥٦٧٨٩ | تفاح اخضر 0123456789 |

## 2. Forty lexical lookup groups

**Dialect key:** E = Egyptian everyday/market usage; F = formal/standard Arabic; L = Levantine; G = Gulf. The leftmost term is preferred for this Egyptian app where appropriate. Other dialect terms are useful for menus/imported packs and users familiar with them; their inclusion does not claim they are native Egyptian synonyms. Sources attest vocabulary, not frequency among this app's users. Preserve food state, variety and preparation in every alias target. [T3–T8]

The table is an authored alias proposal, not a copied dictionary. Some entries are spelling/loanword variants rather than etymologically distinct synonyms. They remain different after v1 folding. Conditional groups are retrieval hints, not automatic nutritional equivalences.

| # | Lookup group | Usage / qualification | Evidence |
|---|---|---|---|
| 1 | طماطم / قوطة / بندورة | E / E-Cairo / L | T3, T4 |
| 2 | رز / أرز | E / F; normalization gives رز versus ارز | T3 |
| 3 | فراخ / دجاج | E / F; retain cut/state | T3, T5 |
| 4 | عيش / خبز | E / F,L; bread family, not a particular loaf | T3, T5 |
| 5 | لبن / حليب | E / F,L; milk only in this mapping | T3 |
| 6 | جبنة / جبن | E / F; specific cheese still required | T3 |
| 7 | لحمة / لحم | E / F; do not infer animal | T3, T5 |
| 8 | جمبري / قريدس | E / L; species/state still required | T9 |
| 9 | توم / ثوم | E / F | T3, T5 |
| 10 | بتنجان / باذنجان | E / F | T3, T5 |
| 11 | كرنب / ملفوف | E / F,L | T3, T5 |
| 12 | برتقان / برتقال | E / F | T3, T5 |
| 13 | لمون / ليمون | E / F; Lebanese context can differ | T3, T4 |
| 14 | بطاطس / بطاطا | E potato / L potato; **conditional** | T3, T4 |
| 15 | بطاطا / بطاطا حلوة | E sweet potato / F,L; **conditional** | T4 |
| 16 | كمترى / كمثرى / نجاص | E / F / L | T4, T25 |
| 17 | خوخ / دراق | E peach / L peach; **conditional** | T4 |
| 18 | فراولة / فريز | E / L-Lebanon,Syria | T4 |
| 19 | كريز / كرز | E / F | T4, T25 |
| 20 | مانجو / منجة | E market variants | T4, T25 |
| 21 | كنتالوب / شمام | E; cultivar distinctions need review | T4, T5 |
| 22 | زتون / زيتون | E spelling / F | T4, T5 |
| 23 | أفوكاتو / أفوكادو | E loanword variant / F | T4 |
| 24 | يوسفي / يوستفندي / يوسف أفندي | E,F / E / L-Syria | T4 |
| 25 | جريب فروت / ليمون هندي | E loan / F | T4, T25 |
| 26 | كوسة / كوسا | E / F,L spelling | T4, T5 |
| 27 | فلفل رومي / فلفل حلو / فلفل بارد | E / F / G; bell pepper | T4 |
| 28 | فلفل حراق / فلفل حار | E / F; fresh chilli, not spice powder | T4 |
| 29 | قرنبيط / زهرة | E / L-Jordan,Palestine,G | T4, T6 |
| 30 | بسلة / بازلاء | E / F | T4 |
| 31 | درة / ذرة | E spelling / F; qualify maize | T4 |
| 32 | قرع / يقطين | E / F; match pumpkin type | T4 |
| 33 | بنجر / شمندر | E / F,L | T4, T6 |
| 34 | خرشوف / أرضي شوكي | E / L; not تين شوكي | T4 |
| 35 | مشروم / عيش الغراب / فطر | E loans/names / F; edible species required | T4, T7 |
| 36 | جنزبيل / زنجبيل | E / F | T4, T25 |
| 37 | عين جمل / جوز | E / F,L; walnut, not all nuts | T8 |
| 38 | دقيق / طحين | E / F,L; same cereal/type only | T8 |
| 39 | عسل أسود / دبس قصب | E / descriptive F; not date molasses | T8 |
| 40 | طعمية / فلافل | E / regional name; **recipe-dependent** | T5 |

**Do not install all 40 as unconditional equivalences.** In an Egyptian locale, بطاطا should first retrieve sweet potato. A Levantine potato alias must carry locale/disambiguation rather than silently select the wrong nutrition record. Similarly خوخ can mean plum in some Levantine contexts. [T4]

**Explicit chicken correction:** كتاكيت denotes chicks; it is not a dependable adult chicken-meat synonym. Do not attach it to every فراخ row. The lexical meaning is documented, but frequency as a food-search term in Egypt was not confirmed. [T20]

Other dangerous merges: لبن can mean yogurt/fermented milk elsewhere; generic فلافل need not use Egyptian fava-bean طعمية ingredients. A broad cheese/bread/meat alias should retrieve labelled choices, never replace one recipe's macros with another's. [T3, T5]

**Human minimum for aliases:** Egyptian Arabic reviewer approves target, dialect and ambiguity; nutrition reviewer checks any alias spanning dishes, species or states. Do not import dictionary prose or entire word lists without checking their licences; this report provides short factual vocabulary evidence, not permission to republish a dictionary.

## 3. PostgreSQL implementation options

| Option | Arabic behaviour | Assessment for this catalogue |
|---|---|---|
| `pg_trgm` | Character-trigram similarity after our normalization; no dialect understanding. | Useful typo fallback. `%` is indexable; `similarity()` supplies a score. Do not search only by `similarity(...) > x` and assume index use. [T10] |
| `unaccent` | Rule-based substitutions/removals; not a complete specified Arabic normalizer. | Optional Latin-accent handling. Verify actual installed rules; no assumption it folds all Arabic forms/digits. [T11] |
| FTS with `simple` | Token matching with lowercase lexemes, without Arabic stemming supplied by `simple`. | Optional for reordered multiword terms; not typo correction or synonyms. Normalize first. [T12–T13] |
| Stored normalized columns | Same explicit policy for query and stored text. | Recommended foundation. Populate on write through a controlled backend/trigger and version/backfill together. This is our design. |
| Prefix matching | Literal normalized `LIKE 'term%'`. | Good short-query behaviour; B-tree `text_pattern_ops` helps under non-C collations. Escape `%`, `_` and escape character. [T14] |
| Alias/term table | Curated phrase variants and locale/ambiguity flags. | Essential for فراخ/دجاج. Easier to review than a managed-server dictionary file. PostgreSQL synonym dictionaries use server-side files and do not support phrases. [T12] |

**Recommendation:** start with stored terms, exact/prefix and trigrams. Add FTS only if multiword order hurts observed recall. No external search service is justified by the stated few-thousand-row size alone; latency must be measured rather than promised.

### Suggested columns and indexes (design only)

- `foods`: existing `id`, `workspace_id`, `slug`, `name_ar`, `name_en`; proposed `name_ar_norm`, `name_en_norm`, `normalization_version`, `verification_status`, source/reviewer fields, state and category.
- `food_search_terms`: `id`, `food_id`, `workspace_id`, `term`, `term_norm`, `language`, `dialect`, `kind` (canonical/alias), `ambiguity`, `approved_at`, `normalization_version`. Insert canonical Arabic and English as terms too; do not rely on fuzzy comparison against one long concatenated blob.
- Indexes: B-tree `foods(workspace_id)` and `food_search_terms(food_id)`; B-tree `food_search_terms(term_norm text_pattern_ops)` for exact/prefix; **GIN `(term_norm gin_trgm_ops)`** for fuzzy; optionally B-tree `(workspace_id, term_norm text_pattern_ops)` after measuring tenant growth. [T10, T14]
- Optional `search_vector` derived from normalized canonical names and approved aliases, indexed with GIN; use explicit `'simple'` in vector and query creation. Recompute whenever an alias changes. [T12–T13]
- Stored normalized text avoids normalizing every row at read time. If considering generated columns/expression indexes, all generation functions must meet PostgreSQL immutability requirements; do not falsely mark a rule-dependent wrapper immutable. Use a trigger or backend-maintained stored column if uncertain. [T21]
- Scope terms to their parent food and preserve consistency if `workspace_id` is duplicated. RLS on terms must not leak another workspace's aliases, counts or fuzzy suggestions; require parent visibility. Joins alone do not protect a directly queryable terms table. [Local SQL; T15]

### Query and ranking sketch (not executed)

This is reviewable SQL inside the report, not a migration. Assume a prepared `:q` normalized by v1, `:prefix` containing the escaped query followed by `%`, and trusted workspace context. Extension operators/opclasses must be schema-qualified or reachable through the configured search path. The sketch uses the existing `app_workspace_id()` model.

```sql
-- Example proposed indexes, after pg_trgm is enabled:
CREATE INDEX food_terms_trgm ON food_search_terms
  USING gin (term_norm gin_trgm_ops);
CREATE INDEX food_terms_prefix ON food_search_terms
  (term_norm text_pattern_ops);

WITH candidate_terms AS (
  SELECT food_id, 0 AS tier, 1.0::real AS score
  FROM food_search_terms
  WHERE term_norm = :q AND approved_at IS NOT NULL
  UNION ALL
  SELECT food_id, 1, 0.0::real
  FROM food_search_terms
  WHERE term_norm LIKE :prefix ESCAPE E'\\'
    AND approved_at IS NOT NULL
  UNION ALL
  SELECT food_id, 2, similarity(term_norm, :q)
  FROM food_search_terms
  WHERE char_length(:q) >= 3 AND term_norm % :q
    AND approved_at IS NOT NULL
), visible AS (
  SELECT f.id, f.name_ar, f.workspace_id,
         min(c.tier) AS match_tier, max(c.score) AS fuzzy_score
  FROM candidate_terms c JOIN foods f ON f.id = c.food_id
  WHERE (f.workspace_id IS NULL AND f.verification_status = 'verified')
     OR f.workspace_id = app_workspace_id()
  GROUP BY f.id, f.name_ar, f.workspace_id
)
SELECT * FROM visible
ORDER BY match_tier,
         CASE WHEN workspace_id IS NULL THEN 0 ELSE 1 END,
         fuzzy_score DESC, id
LIMIT 20;
```

**Ranking contract:** exact normalized name/approved alias, then prefix, then fuzzy; **within each match tier, verified global first, then own-workspace food**. Thus an exact private match beats an unrelated fuzzy global match. This explicitly resolves the competing priorities in the brief. Hide unverified global rows from default client search; private rows retain a visible provenance/verification label. These are proposed product rules.

Keep RLS active in every candidate branch and on `foods`; the final predicate is additional scoping. Never use a bypass-RLS service role or `SECURITY DEFINER` as a search shortcut. Set authenticated workspace context safely in the backend transaction; aliases must inherit the parent's scope. [Local SQL; T15]

For 1–2 characters, exact/prefix only; return a limited list. Prefix plans with bound parameters and collation need checking; a sequential scan at this size can be reasonable. Trigram default similarity threshold is 0.3; tune against an approved query set, not a guessed universal Arabic threshold. Do not keep modifying a pooled session's threshold across requests; use transaction-local settings if needed. [T10, T14; tuning policy is our recommendation]

For phrase order, an optional branch can use `search_vector @@ plainto_tsquery('simple', :q)`. It provides AND-style token matching; keep it separate from exact phrases. Do not concatenate untrusted raw text into `to_tsquery`. Exact barcode lookup should bypass name fuzziness. [T13]

### Supabase support and checks still needed

**Yes:** hosted Supabase's extension catalogue lists both **`pg_trgm` and `unaccent`**. GIN/B-tree and PostgreSQL full-text search are database facilities; `simple` needs no separate extension. Availability is not proof the extensions are enabled on this project's database. No project was connected or queried. [T12, T15]

Suggested read-only deployment checks:

```sql
SELECT name, default_version, installed_version
FROM pg_available_extensions WHERE name IN ('pg_trgm', 'unaccent');
SELECT extname, extnamespace::regnamespace
FROM pg_extension WHERE extname IN ('pg_trgm', 'unaccent');
SELECT cfgname FROM pg_ts_config WHERE cfgname = 'simple';
```

Also test `show_trgm('فراخ')`, representative Arabic exact/prefix/fuzzy results, RLS isolation with two workspaces, and `EXPLAIN (ANALYZE, BUFFERS)` on real-sized data. I did not confirm this project's PostgreSQL version, locale, extension installation or latency. The Supabase changelog was checked; no search-extension removal relevant to this proposal was identified in the inspected recent entries. [T15, T22]

## 4. Barcode structure and validation

### Structures

- **EAN-13** is the barcode symbology carrying **GTIN-13**, a 13-digit identifier: GS1 Company Prefix plus item reference occupy the first 12 digits, followed by a check digit. Prefix length varies; do not hardcode a fixed manufacturer's slice. [T16, T23]
- **EAN-8** carries **GTIN-8**: GS1-8 prefix plus item reference form seven digits, followed by the check digit. It is assigned for small packages; it is not obtained by truncating EAN-13. An arbitrary eight-digit till code is not necessarily GTIN-8. [T17]
- **622** is the allocation associated with **GS1 Egypt**. It identifies the issuing organisation, not country of manufacture. Accept valid imported barcodes with other prefixes; do not require 622. Prefix alone supplies no nutrition. [T16, T19]

### Modulo-10 check digit

For either length, remove the last digit. Moving right-to-left through the remaining body, multiply digits alternately by **3, 1, 3, 1…**, starting with 3. Let the sum be `S`; expected check digit is **`(10 - (S % 10)) % 10`**. Compare with the supplied final digit. [T18]

Authored examples, calculated under that algorithm:

| Input | Weighted body sum | Result |
|---|---|---|
| 6223000350065 | 55 | Expected 5: checksum passes. |
| 6223000350064 | 55 | Expected 5: reject as mistyped GTIN. |
| 96385074 | 86 | Expected 4: checksum passes as length 8. |
| 00000000 | 0 | Checksum passes mathematically; reject as an app placeholder policy. |

Passing the checksum is syntactic validation only; it does not prove GS1 assignment, food identity, authenticity or label accuracy. [T18; implication of the algorithm]

### Proposed entry rule

1. Store the original and canonical barcode as **text**, preserving leading zeros. Convert both Arabic-Indic digit sets to ASCII. Trim outer whitespace; optionally remove internal ASCII spaces/hyphens with a visible confirmation. Reject remaining non-digits for a GTIN field. Never use the food-name normalization function to “fix” a barcode.
2. For the initial EAN feature, accept lengths **8 or 13** only after checksum validation and placeholder checks. Do not invent a missing digit or accept a bad checksum as a global GTIN. Offer a separate local-code field so the coach can still save a legitimate private food.
3. Imported packs can use **UPC-A / GTIN-12**, and logistics can use **GTIN-14**. If supporting them later, validate their lengths/checksum explicitly and retain the input format; do not label them malformed EAN-13. A separate optional 14-digit zero-padded matching key can unify legitimate GTIN representations, not arbitrary short local codes. [T23–T24]
4. **Restricted circulation:** GS1's general specification reserves ranges including `02` and `20–29` in the relevant longer-number structures; EAN-13 representations commonly appear as `020–029` and `200–299`. Treat these as local/restricted candidates, not globally reusable product IDs. They may encode price/weight with retailer-specific layouts. I did not verify an Egyptian retailer-wide decoding scheme. [T23]
5. GTIN-8 has its own allocation table; do not apply the GTIN-13 company-prefix segmentation blindly. Keep suspected in-store numbers and other short till/PLU codes as `(workspace_id, retailer, local_code)` with `identifier_kind=local`, no automatic OFF lookup and no global deduplication. [T17, T23; storage policy is our proposal]
6. A supported valid GTIN that is missing from OFF is still eligible for manual label entry. Matching a barcode must lead to pack identity and unit/basis confirmation, not automatic client-visible nutrition approval. This is our workflow recommendation.

## References and access dates

Each cited claim points to these dated URLs; design choices/test cases are authored above.

- **T1:** [Apache Lucene ArabicNormalizer](https://lucene.apache.org/core/9_12_0/analysis/common/org/apache/lucene/analysis/ar/ArabicNormalizer.html), read 2026-10-31.
- **T2:** [Unicode UAX #15](https://www.unicode.org/reports/tr15/), read 2026-10-31.
- **T3:** [Food vocabulary across Arabic varieties](https://openarabic.org/food-in-arabic/), read 2026-10-31; short lexical comparisons, not a frequency survey.
- **T4:** [Fruit/vegetable dialect comparisons](https://www.openarabic.org/fruits-and-vegetables-in-arabic/), read 2026-10-31; publisher links underlying dialect sources. Regional labels are lookup context, not proof all variants are common in Egypt.
- **T5:** [Playaling Egyptian food vocabulary](https://playaling.com/egyptian-arabic-food-vocabulary/), read 2026-10-31.
- **T6:** [Qatar agricultural census bilingual crop names, including زهرة/قرنبيط and شمندر/بنجر](https://www.fao.org/fileadmin/templates/ess/ess_test_folder/World_Census_Agriculture/Country_info_2010/Reports/Reports_6/QTR_AR_CENSUS_LIKE_DATA_2010_2014.pdf), indexed PDF extract read 2026-10-31.
- **T7:** [Egyptian journal paper using فطر عيش الغراب (المشروم)](https://jedu.journals.ekb.eg/article_200354_33e1a697d4c4048469c51b8f7018ede0.pdf), indexed paper extract read 2026-10-31; vocabulary evidence only.
- **T8:** [Egypt CAPMAS walnut naming](https://www.censusinfo.capmas.gov.eg/metadata-en-v4.2/index.php/catalog/636/download/1764), [Carrefour Egypt flour vocabulary](https://www.carrefouregypt.com/mafegy/ar/c/FEGY12004331), [Egypt export portal: دبس قصب (عسل اسود)](https://www.expoegypt.gov.eg/products/i/دبس-قصب-عسل-اسود), indexed owner-page extracts read 2026-10-31. CAPMAS's grouped category also includes pecans; it must not justify merging pecan and walnut nutrition.
- **T9:** [جمبري lexical entry and قريدس synonym](https://en.wiktionary.org/wiki/جمبري), read 2026-10-31; dialect sections distinguish Egyptian borrowing from Levantine usage.
- **T10:** [PostgreSQL pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html), read 2026-10-31.
- **T11:** [PostgreSQL unaccent](https://www.postgresql.org/docs/current/unaccent.html), read 2026-10-31.
- **T12:** [PostgreSQL text-search dictionaries](https://www.postgresql.org/docs/current/textsearch-dictionaries.html), read 2026-10-31.
- **T13:** [PostgreSQL query parsing and ranking](https://www.postgresql.org/docs/current/textsearch-controls.html), read 2026-10-31.
- **T14:** [PostgreSQL pattern operator classes](https://www.postgresql.org/docs/current/indexes-opclass.html), read 2026-10-31.
- **T15:** [Supabase supported extensions](https://supabase.com/docs/guides/database/extensions), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), read 2026-10-31.
- **T16:** [GS1 Egypt GTIN guide](https://gs1eg.org/en/the-complete-guide-to-gs1s-gtin-barcodes/), read 2026-10-31.
- **T17:** [GS1 GTIN-8 specification change document](https://www.gs1.org/docs/barcodes/GSCN_21-271_GTIN8.pdf), [GS1 Sweden retail barcode guide](https://gs1.se/en/guides/how-to-guides/barcoding-the-product/), read 2026-10-31.
- **T18:** [GS1 UK check-digit calculation](https://www.gs1uk.org/knowledge-hub/standards/what-is-a-check-digit), read 2026-10-31.
- **T19:** [GS1 Moldova prefix list](https://gs1md.org/wp-content/uploads/2016/06/Prefix_list.pdf), read 2026-10-31, confirms 622; historical supporting list, checked against T16.
- **T20:** [Lexical study including كتكوت = صغير الدجاج](https://urnop-alger2.com/wp-content/uploads/2019/03/Doctorat-SIAM-Karima.pdf), indexed academic excerpt read 2026-10-31; not evidence for Egyptian food-query frequency.
- **T21:** [PostgreSQL generated columns](https://www.postgresql.org/docs/current/ddl-generated-columns.html), read 2026-10-31.
- **T22:** [Supabase changelog](https://supabase.com/changelog.md), read 2026-10-31 by direct HTTP; web reader could not render Markdown.
- **T23:** [GS1 General Specifications, Release 26.0, January 2026](https://ref.gs1.org/standards/genspecs/), read 2026-10-31; current PDF exceeded web-reader size but was retrieved and parsed in memory; prefix allocation table on PDF page 26. [GS1 UK copy](https://www.gs1uk.org/sites/default/files/inline-files/GS1_General_Specifications.pdf) rendered only an iframe and was not relied on as readable text.
- **T24:** [GS1 Digital Link identifier representation](https://ref.gs1.org/standards/digital-link/uri-syntax/1.7.0/), read 2026-10-31; specifies 14-digit GTIN representation with filler zeros in this context.
- **T25:** [Lingualism Egyptian food vocabulary](https://resources.lingualism.com/egyptian-arabic/food-and-drink/), indexed publisher table read 2026-10-31; directly attests Egyptian pear, cherry, mango, grapefruit and ginger forms. Direct requests timed out/returned 403, but the search reader recovered these entries.

**Research limits:** this is no production benchmark or installed-database audit. I could not establish term frequencies for the proposed 40 groups, an Egyptian national in-store-code layout, or an unconditional equivalence for the flagged foods. Direct Lingualism page retrieval failed; an indexed Egyptian publisher table was recovered as T25. Other comparisons use the readable comparative pages and additional sources above. Require the two human reviews described above before enabling ambiguous aliases.
