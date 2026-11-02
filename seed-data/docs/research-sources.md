# Nutrition data sources for an Egyptian coaching app

Research/read date: **2026-10-31**. Every source reference below includes its URL and access date. Recommendations and licence interpretations are explicitly distinguished from confirmed publisher statements. No seed data was produced.

## Summary

- Seed generic foods from USDA Foundation Foods, then SR Legacy; USDA explicitly publishes FDC data under CC0. [S1–S2]
- Egyptian NNI tables exist, but I could not confirm an open licence or commercial copying permission. A regional alternative is Lebanese University's 2021 report, which explicitly states CC BY 4.0. [S3–S8]
- Open Food Facts (OFF) allows commercial reuse subject to its licences. On-demand lookup is not a blanket exemption from database share-alike; do not silently accumulate its data into a proprietary food catalogue. [S11–S15]
- OFF's current documented limits are **15 product reads/minute/IP** and **10 searches/minute/IP**. Its current Egyptian-prefix product count could not be verified. [S16, S18]
- A universal Egyptian mandatory nutrient list and reporting basis could not be confirmed. EOS catalogue entries, special-dietary-food rules and policy proposals must be distinguished. [S20–S25]

## Local context and scope

Read [SPEC.md](../SPEC.md) and [existing-seed-0031.sql](../_context/existing-seed-0031.sql), 2026-10-31. The specification prioritizes Foundation then SR Legacy, Egyptian Arabic names, state-specific foods, source IDs, explicit unknowns, and review flags. The SQL calls its numbers `estimate_v1`, requires nutritionist verification, uses per-100-g macros, and exposes global foods plus a workspace's additions through RLS. These are project facts, not independently verified nutrition claims.

**Recommendation:** retain existing slugs when replacing estimates. Treat `cottage-cheese` → جبنة قريش, `feta-cheese` → جبنة بيضاء and `fish-grilled` as review priorities: their current labels are broader or more local than the English food descriptions. This is an inference from the local file, not evidence that their numbers are wrong.

## 1. Egyptian and regional composition tables

“Free access” means readable without payment; it does not establish permission to copy a table into a commercial database. FAO's directory is a discovery catalogue, not a blanket licence for the listed owners' data. [S4, S6]

| Source / owner | Coverage; format; language confirmed | Reuse terms found | Commercial copying decision |
|---|---|---|---|
| **Egypt NNI / Nutrition Institute A.R.E., 1996** | National table; FAO records a 115-page English publication. NNI's own Food Science department says it analyzes foods and updates Egyptian composition tables. [S3–S4] | No open licence or commercial reuse grant located in the inspected owner/directory pages. | **Not cleared.** Obtain written permission covering numerical extraction, redistribution, attribution and updates. Do not assume government ownership means public domain. |
| **Egypt NNI, second edition May 2006** | A third-party scan identifies this edition and raw, processed, cooked and vendor foods; mostly English text in the readable excerpt. No official downloadable CSV verified. [S5] | Uploader access is not an NNI licence; no owner-issued reuse terms confirmed. | **Not cleared.** Use the scan as bibliographic evidence only. Confirm edition and permission with NNI before extraction. |
| **FAO + USDA, Near East, 1982** | Regional commodity/prepared foods; proximate nutrients, minerals, vitamins, amino/fatty acids. English HTML and printed book; publication says machine-readable tables were available on request. A current downloadable CSV was not confirmed. [S6] | Directory says “Free access”; inspected HTML does not state CC0/CC BY. FAO web terms distinguish publication-specific policies and otherwise reserve commercial uses for permission requests. [S6–S7] | **Not cleared for commercial database copying.** Joint USDA authorship does not prove the complete FAO compilation is CC0. Ask FAO to identify the applicable publication licence. |
| **Lebanese University, 2021, Lebanon Food Composition Data** | Traditional dishes, Arabic sweets and market foods; nutrient and fatty-acid tables; English PDF with Arabic-name annexes. University also publishes an Arabic report announcement. [S8] | PDF opening licence page states **“CC-By Attribution 4.0 International.”** DOI: `10.17605/OSF.IO/KU563`. | **Yes, under CC BY 4.0:** attribute authors/source, link licence, identify adaptations; check third-party credit exceptions. Egyptian recipe equivalence still needs review. [S8–S9] |
| **Arab Center for Nutrition / A. O. Musaiger, Bahrain tables** | Foods and composite dishes consumed in Bahrain; compiled and analytical values. FAO-hosted PDF has English tables/text and Arabic sections. [S10] | No explicit commercial reuse grant found in inspected pages; absence of a searchable copyright string is not permission. | **Not cleared.** Request terms from the owner; FAO hosting supplies no automatic licence for third-party content. [S7, S10] |
| **EMFID / Al-Quds University collaboration, WHO supervision according to its site** | Eastern Mediterranean food/recipe web platform; homepage includes Egypt, regional foods and nutrient analysis. English interface inspected; complete language/coverage inventory and bulk export not confirmed. [S19] | Footer says all rights reserved; no open database licence located. | **Not cleared.** Request a data agreement and source-level rights information; a research/developer membership offer is not a commercial redistribution grant. |

### Academic datasets and open CSV checks

- **A confirmed reusable regional academic source exists:** Hoteit et al.'s 2020 Lebanese traditional-dish study explicitly uses a Creative Commons Attribution licence; it reports sugar, salt/sodium and iron, not a complete macro seed. Its HTML tables can be manually extracted with attribution. Do not fill absent nutrients from assumptions. [S26]
- **Lebanese University report:** verified its licence in the PDF itself, not just a directory description. OSF's landing page was blocked during this run; I did not verify an accompanying spreadsheet/CSV. The PDF is sufficient evidence for its stated licence; it is not an Egyptian national table. [S8]
- **Kaggle “Egyptian Food and Drinks (Arabic and English)”** was found, but its page returned no readable metadata. I could not confirm its original numerical sources, measurement basis, file schema or licence. **Do not import it.** A dataset title, a CSV extension, or an uploader's licence cannot establish upstream rights. [S27]
- **Result:** I did not verify a national Egyptian, openly licensed food-composition CSV suitable for commercial seeding. This is a bounded research finding, not proof none exists. NNI permission and EMFID licensing are concrete follow-up routes. [S3–S5, S19, S27]

## 2. USDA FoodData Central

USDA's API guide explicitly identifies FDC data as public domain, not copyrighted, and published under **CC0 1.0 Universal**. It says permission is unnecessary, requests source acknowledgement and optionally notification of products using the data. No commercial-use restriction is stated for the FDC data. The request is not an attribution licence condition. [S1]

Use USDA's suggested citation: **U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, 2019. fdc.nal.usda.gov.** Also retain actual release date, data type, FDC ID and access/extraction date for reproducibility. The extra recordkeeping is our recommendation. [S1]

| FDC type | Publisher's description | Recommended role |
|---|---|---|
| **Foundation** | Analytical commodity/minimally processed foods, with sample metadata and variability. | First choice for a direct food-and-state match. |
| **SR Legacy** | Historic analytical, calculated and literature values; final release April 2018. | Broad generic fallback where Foundation has no equivalent. |
| **Survey / FNDDS** | Foods, beverages and portion weights reported in US dietary surveys; compiled values. | Selective prepared-food/portion reference; US recipes need Egyptian review. |
| **Branded** | Manufacturer label data for named products. | Exclude from generic seed; branded formulations are product-specific. |

Type descriptions: [S2]. Selection order is a recommendation consistent with SPEC.md; newer does not automatically mean a closer match.

**Operational recommendation:** use the already cached releases identified in SPEC.md, preserving their release dates; do not describe the April 2025 local Foundation cache as the current latest release. Check nutrient definitions, edible portion, cooking state, fortification, and energy calculation method before accepting a match. Keep unknowns null and avoid splicing nutrients from unlike foods. [Local SPEC.md; S2]

## 3. Open Food Facts

### Licences and implications

The OFF publisher identifies **ODbL 1.0 for the database**, **DbCL 1.0 for individual contents**, and links **CC BY-SA 3.0 for product images**. Separate packaging artwork/trademark rights can remain. DbCL is not a way around database obligations. [S11, S13–S15]

Interpretation, not an OFF ruling: ODbL §§4.3–4.6 require attribution and, for Publicly Used Derivative Databases, share-alike plus a machine-readable database/alterations offer. Repeated small extractions can become substantial. Internal-use and Collective Database exceptions are qualified. [S12]

| App behaviour | Practical interpretation / action |
|---|---|
| Transient barcode prefill | Attribute OFF beside the suggestion. No explicit publisher exemption for this workflow was confirmed. [S11, S14] |
| Save/edit repeated suggestions | Could accumulate a derivative database; editing is no automatic exemption. Our recommendation: track field provenance and obtain a persistence-specific licence review. [S12] |
| Independent physical-label entry | Our recommendation for private foods: genuinely transcribe the pack, retain evidence, and record that source. |
| Bulk import used through the app | Budget for ODbL attribution, share-alike and the machine-readable offer; a server-only dump does not automatically avoid Public Use. [S12] |
| Separate OFF/USDA/private catalogues | Genuine collective separation can preserve independent components; SQL separation alone does not establish this. OFF warns broadly about combined databases. [S12, S14] |
| Display/crop OFF photos | Credit creator/source, link CC BY-SA 3.0, retain notices and license adaptations appropriately. Packaging rights remain separate. Recommendation: omit unnecessary photos. [S11, S15] |

**Suggested attribution (our wording):** “Product data: Open Food Facts contributors, ODbL 1.0” linked to OFF and the licence, plus the particular product URL. ODbL concerns database rights; it does not automatically open-source application code. [S12]

### Egyptian coverage: not verified

I could not obtain a defensible count of distinct OFF food records whose barcode starts `622`. OFF terms returned a bot notice through the reader; direct country/facet/search attempts returned HTTP 503. These failures do not establish a zero count. No current count is asserted. [S18]

**Reproducible follow-up recommendation:** take a dated official export, preserve code strings, deduplicate, count valid 13-digit codes matching `^622[0-9]{10}$`, and separately count those with usable nutrition. Report invalid/missing codes and unknown nutrition. Count `countries_tags=en:egypt` separately: sold-in-Egypt and a GS1 Egypt allocation are different populations. Do not count a search for the literal code `622` as a prefix count. GS1 Egypt confirms 622 allocation; it does not establish manufacturing origin or market completeness. [S16, S28]

### API operation

- Current official documentation: **15 read-product requests/minute/IP**, **10 search requests/minute/IP**; backend requests share the server's IP budget. It also describes global limits and possible 503s. Older 100/min claims should not override the current page. [S16]
- Identify the app using `AppName/Version (ContactEmail)` User-Agent and fill the API usage form. Use selective fields and a bounded cache; use exports for more than a few hundred products. These are publisher requests/guidance. [S16]
- Recommendation: barcode lookup only after explicit submission; no OFF search-as-you-type. Handle missing records, timeouts and rate limits by leaving the coach a manual form. Persisting a cache requires the licence analysis above. [S12, S16]
- Full terms page could not be read beyond the bot notice; the accessible publisher API/licence/help pages and underlying licence texts were used. Additional current page-specific terms remain unconfirmed. [S11–S18]

### Expected quality problems

OFF describes voluntary data with no guarantee of accuracy/completeness and supplies quality-control guidance. Expect missing nutrients/photos, incomplete translations, OCR/transcription errors, implausible values, and values needing comparison with the actual pack. [S16–S17]

**Review recommendations:** check barcode, brand, flavour, size, country formulation, label date, per-serving versus per-100 basis, g versus mg, salt versus sodium, kcal versus kJ, and prepared versus as-sold. Treat missing sugar/fibre as unknown, not zero; never infer safety/allergen absence from an empty field. Use quality flags as a review signal, not certification. [S17]

## 4. Other sources and Egyptian labelling

| Source | What it gives | Reuse/scraping assessment |
|---|---|---|
| Coach's physical product label | Current local formulation, barcode, portion and declared nutrients. | Recommended entry workflow: independently transcribe facts and retain evidence privately. Do not assume the packaging photo/artwork has an open licence. |
| Egyptian supermarket pages, e.g. Carrefour Egypt | Product identity, categories and sometimes pack photographs; inspected flour listing confirms local catalogue vocabulary, not complete nutrition availability. [S29] | No commercial extraction licence verified. Review current site terms and obtain permission before bulk collection; do not bypass access blocks. Page visibility is not reuse permission. |
| Manufacturer material, e.g. Juhayna brochure | Ingredients, product variants and package sizes; potentially nutrition information for matching packs. Inspected brochure is historical and does not establish current values. [S30] | No open data licence verified. Seek a current authorized data feed or written permission; do not scrape images/descriptions wholesale. |
| UNICEF Egypt packaged-food study | November 2024 market/labelling analysis, drawing on Mintel GNPD. | Useful evidence about missing labels; the report is not a grant to copy the underlying commercial Mintel database. [S24] |
| NNI or commissioned accredited laboratory | Egyptian recipes and direct measurements. | Obtain a contract granting commercial database rights and documenting sampling/methods. No laboratory was contacted in this research. |

### What is actually established about mandatory labels?

1. **EOS 1546/2024** is the general prepackaged-food labelling standard; its catalogue lists adoption 2024-08-18 and **غير الزامى** (non-mandatory), referring to Codex CXS 1-1985. That catalogue status alone does not settle obligations imposed through other decisions. [S20]
2. **EOS 3120/2008** concerns nutrition-label guidance, lists **غير الزامى**, and references CAC/GL 2-1985 amended 2006. Its full paid text was not obtained, so I cannot quote an Egyptian required nutrient list from it. [S21]
3. A third-party page describes **ES 1523/2019** as a nutrition-label standard. EOS's catalogue instead identifies **1523/2023 as dried egg**. The third-party claim was not corroborated and should not drive validation rules. [S22]
4. **Confirmed narrower category:** USDA/FAS's 2025 Egypt report describes NFSA rules for **foods for special dietary uses (FSDU)**: energy in kcal or kJ, protein/carbohydrate/fat in grams, per 100 g or 100 ml **and** the specified consumption quantity; vitamin/mineral values use appropriate metric units on the stated bases. This is FAS reporting, not the underlying NFSA legal text, and must not be generalized to every packaged food. [S23]
5. UNICEF's 2024 report associates incomplete nutrition declarations with missing Egyptian nutrition-labelling legislation and recommends Codex nutrients. NFSA's May 2025 perspective discusses mandatory nutrition labelling; it is a perspective, not an enacted regulation. These do not establish what was legally enacted by October 2026. [S24–S25]
6. **I could not confirm a current universal Egyptian mandatory nutrient set, exemptions or a universal per-100/per-serving rule from enacted primary legal text.** Obtain current NFSA decisions, product-category standards and enforceability advice before making a legal-compliance claim. The app should support both bases and missing optional fields rather than reject labels for not matching an assumed five/seven-nutrient schema. [S20–S25]
7. **EFSA** usually means the European Food Safety Authority, an EU scientific-advice agency; Egypt's relevant food-safety body here is **NFSA**, alongside EOS standards. EU or Gulf rules are not proof of Egyptian requirements. [S23, S31]

## 5. Recommendation and minimum human review

The following is our proposed release policy, not a requirement asserted by a source:

1. **Generic global seed:** Foundation exact matches, SR Legacy fallback; selectively review FNDDS. Preserve original source and food state. Use licensed Lebanese data only when its actual food/recipe matches, or label it a regional proxy. Do not claim NNI/FAO commercial permission until documented. [S1–S10]
2. **Leave packaged products and variable Egyptian dishes to coaches initially.** Coaches enter actual labels or a documented weighed recipe. A named US branded product or Lebanese dish is not evidence of an Egyptian formulation. OFF can be an optional attributed suggestion after the persistence/licence decision. [S2, S8, S11–S14]
3. **Every client-visible global record:** a nutrition professional confirms identity, state, edible portion, source record/release, nutrient units/basis and household weight evidence. A second reviewer checks every proxy, mixed dish, unit conversion and corrected anomaly; unresolved records remain hidden or explicitly unverified.
4. **Every packaged save:** coach compares all entered values with the pack, confirms basis and serving weight, and retains dated evidence/source. Require a grams conversion before using a serving in a per-100-g calculation; ml is not automatically grams. Missing required planning macros prevent release; missing micronutrients stay null.
5. **Validation supplements review:** run the existing project's macro/portion checks, but flag rather than silently “repair” values. Alcohol, fibre and differing energy methods can require explanation. Global verification must not be inferred from passing arithmetic checks. [Local SPEC.md]
6. **Provenance minimum:** owner, source URL/ID, release/access date, original unit/basis, conversion notes, licence and attribution, state, confidence, reviewer/date and version. Keep immutable historical meal-plan values when catalogue records change. This is a proposed data-governance safeguard.

## Sources and access log

All dates below are **read/accessed 2026-10-31**, not publication dates. Search extracts are identified where full retrieval failed.

- **S1:** [USDA API guide, licensing and citation](https://fdc.nal.usda.gov/api-guide/), read 2026-10-31.
- **S2:** [USDA data-type comparison/documentation](https://fdc.nal.usda.gov/data-documentation/), read 2026-10-31.
- **S3:** [NNI Food Science department](https://nni.gov.eg/قســم-علـــوم-الأطعمـــة/), read 2026-10-31, indexed owner-page extract.
- **S4:** [FAO INFOODS Egypt](https://www.fao.org/infoods/infoods/tables-and-databases/egypt/en/), read 2026-10-31.
- **S5:** [Third-party 2006 NNI scan](https://www.scribd.com/document/807058999/Food-Composition-Tables-%25D8%25A7%25D9%2584%25D9%2585%25D8%25B9%25D9%2587%25D8%25AF-%25D8%25A7%25D9%2584%25D9%2582%25D9%2588%25D9%2585%25D9%258A), readable indexed excerpt, read 2026-10-31; not a rights source.
- **S6:** [Near East table HTML](https://www.fao.org/4/x6879e/x6879e00.htm), [current directory](https://www.fao.org/food-composition/tables-and-databases/en/), [INFOODS directory](https://www.fao.org/infoods/infoods/tables-and-databases/en/), read 2026-10-31.
- **S7:** [FAO terms](https://www.fao.org/contact-us/terms/en/), read 2026-10-31; linked publication-policy page could not be retrieved.
- **S8:** [Lebanese University 2021 English report](https://ul.edu.lb/files/ann/20211215-ULFPH-RePa-Version-Eng.pdf), read 2026-10-31; PDF opening pages retrieved in memory after web-reader failures, licence on PDF page 2. [FAO record](https://www.fao.org/food-composition/tables-and-databases/detail/%28lebanon--2021%29-lebanon-food-composition-data--traditional-dishes--arabic-sweets-and-market-foods/en), read 2026-10-31. [OSF](https://osf.io/ku563/) attempted 2026-10-31, blocked; no CSV verified.
- **S9:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), licence identified by S8; terms cross-check listed here, read 2026-10-31.
- **S10:** [FAO-hosted Bahrain PDF](https://www.fao.org/fileadmin/templates/food_composition/documents/pdf/FOODCOMPOSITONTABLESFORBAHRAIN.pdf), read 2026-10-31.
- **S11:** [OFF licence guidance](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/), read 2026-10-31.
- **S12:** [ODbL 1.0 legal text](https://opendatacommons.org/licenses/odbl/1-0/), especially §§1, 4.3–4.6, read 2026-10-31.
- **S13:** [DbCL 1.0](https://opendatacommons.org/licenses/dbcl/1-0/), read 2026-10-31.
- **S14:** [OFF API reuse conditions](https://support.openfoodfacts.org/help/en-gb/12-donnees-api/94-y-a-t-il-des-conditions-pour-utiliser-l-api), read 2026-10-31.
- **S15:** [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/deed.en), reached through OFF's licence link, read 2026-10-31.
- **S16:** [OFF current API introduction](https://openfoodfacts.github.io/openfoodfacts-server/api/), read 2026-10-31, rate limits and identification sections.
- **S17:** [OFF app quality controls](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/how-to-create-data-quality-controls-in-your-app/), read 2026-10-31.
- **S18:** [OFF terms](https://world.openfoodfacts.org/terms-of-use), [country JSON](https://world.openfoodfacts.org/country/egypt.json), [exploratory facet JSON](https://world.openfoodfacts.org/facets/code/622.json), attempted 2026-10-31; bot notice/HTTP 503, no usable count or full terms. The exploratory facet's prefix semantics were not established.
- **S19:** [EMFID](https://emfid.org/frontend/web/index.php), read 2026-10-31.
- **S20:** [EOS 1546/2024](https://www.eos.org.eg/ar/standard/7306), read 2026-10-31.
- **S21:** [EOS 3120/2008](https://www.eos.org.eg/ar/standard/8982), read 2026-10-31.
- **S22:** [Uncorroborated third-party label claim](https://nutritionfactlabel.com/regulations/eg-eos/), [EOS catalogue 1523/2023](https://www.eos.org.eg/en/standardSearch?page=78), read 2026-10-31.
- **S23:** [USDA/FAS Egypt FAIRS 2025, pp. 8–10](https://apps.fas.usda.gov/newgainapi/api/Report/DownloadReportByFileName?fileName=FAIRS+Country+Report+Annual_Cairo_Egypt_EG2025-0025.pdf), read 2026-10-31.
- **S24:** [UNICEF Egypt packaged-food report, November 2024](https://www.unicef.org/egypt/media/12771/file/THE%20HEALTHINESS%20OF%20PACKAGED%20FOOD%20%26%20BEVERAGE%20PRODUCTS%20in%20Egypt.pdf.pdf), methods and recommendations, read 2026-10-31.
- **S25:** [NFSA policy-team perspective, May 2025](https://gforss.org/wp-content/uploads/2025/05/JNFSA.2025-1_SugarIntakeReductionEG_vf.pdf), read 2026-10-31.
- **S26:** [Hoteit et al., Lebanese dish analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC7702163/), indexed full-text/licence extract read 2026-10-31; later direct access hit a browser challenge.
- **S27:** [Kaggle Egyptian food dataset](https://www.kaggle.com/datasets/mohanedmaged/egyptian-food-and-drinks-arabic-and-english), attempted 2026-10-31; unreadable metadata, rights unconfirmed.
- **S28:** [GS1 Egypt GTIN guide](https://gs1eg.org/en/the-complete-guide-to-gs1s-gtin-barcodes/), read 2026-10-31.
- **S29:** [Carrefour Egypt flour listing](https://www.carrefouregypt.com/mafegy/ar/self-rising-flour/5-stars-flour-self-raising-1k/p/17534), indexed page read 2026-10-31; reuse terms unconfirmed.
- **S30:** [Juhayna manufacturer brochure](https://www.juhayna.com/app/uploads/2020/02/1580813972_461_12633461_englishbrochurenewfinal28nov.pdf), indexed manufacturer PDF read 2026-10-31.
- **S31:** [EFSA's role](https://www.efsa.europa.eu/en/about/about-efsa), read 2026-10-31.
