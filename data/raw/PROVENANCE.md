# Provenance manifest — WHO Child Growth Standards 2006 / Permenkes RI No. 2 Tahun 2020

Retrieved 2026-10-06. Every URL below was actually requested and returned the status shown.
Nothing here is inferred or reconstructed.

## Source A — official WHO expanded z-score tables (PRIMARY, machine-readable)

All 14 Permenkes tables. Each XLSX carries **both** the 7 SD cut-offs and the LMS parameters.
Base: `https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/`
All returned **HTTP 200**, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

| # | Permenkes table | File | Bytes | Path under base |
|---|---|---|---|---|
| 1 | BB/U boys 0–60 bln | wfa_boys_0-to-5-years_zscores.xlsx | 14319 | weight-for-age/…?sfvrsn=97a05331_9 |
| 8 | BB/U girls 0–60 bln | wfa_girls_0-to-5-years_zscores.xlsx | 14320 | weight-for-age/…?sfvrsn=4c03b8db_7 |
| 2 | PB/U boys 0–24 bln | lhfa_boys_0-to-2-years_zscores.xlsx | 11931 | length-height-for-age/…?sfvrsn=30e044c_9 |
| 9 | PB/U girls 0–24 bln | lhfa_girls_0-to-2-years_zscores.xlsx | 11938 | length-height-for-age/…?sfvrsn=e9e66a95_11 |
| 3 | TB/U boys 24–60 bln | lhfa_boys_2-to-5-years_zscores.xlsx | 12835 | length-height-for-age/…?sfvrsn=17e5ad91_9 |
| 10 | TB/U girls 24–60 bln | lhfa_girls_2-to-5-years_zscores.xlsx | 12882 | length-height-for-age/…?sfvrsn=2ec187b9_11 |
| 4 | BB/PB boys 45–110 cm | wfl_boys_0-to-2-years_zscores.xlsx | 18744 | weight-for-length-height/…?sfvrsn=e27a9da3_7 |
| 11 | BB/PB girls 45–110 cm | wfl_girls_0-to-2-years_zscores.xlsx | 18644 | weight-for-length-height/…?sfvrsn=288bc4e4_7 |
| 5 | BB/TB boys 65–120 cm | wfh_boys_2-to-5-years_zscores.xlsx | 17375 | weight-for-length-height/…?sfvrsn=202c0545_7 |
| 12 | BB/TB girls 65–120 cm | wfh_girls_2-to-5-years_zscores.xlsx | 17388 | weight-for-length-height/…?sfvrsn=4d66af6a_7 |
| 6 | IMT/U boys 0–24 bln | bmi_boys_0-to-2-years_zcores.xlsx | 11775 | body-mass-index-for-age/…?sfvrsn=df725cc9_7 |
| 13 | IMT/U girls 0–24 bln | bmi_girls_0-to-2-years_zscores.xlsx | 11787 | body-mass-index-for-age/…?sfvrsn=2be9859c_7 |
| 7 | IMT/U boys 24–60 bln | bmi_boys_2-to-5-years_zscores.xlsx | 12461 | body-mass-index-for-age/…?sfvrsn=73010c9b_5 |
| 14 | IMT/U girls 24–60 bln | bmi_girls_2-to-5-years_zscores.xlsx | 12227 | body-mass-index-for-age/…?sfvrsn=452aca36_7 |

Note: `bmi_boys_0-to-2-years_zcores.xlsx` is misspelled ("zcores") **in WHO's own URL**. Do not "fix" it — 200 requires the typo.

Discovery URLs (all HTTP 200, links regex-extracted from HTML):
- https://www.who.int/tools/child-growth-standards/standards/weight-for-age
- https://www.who.int/tools/child-growth-standards/standards/length-height-for-age
- https://www.who.int/tools/child-growth-standards/standards/weight-for-length-height
- https://www.who.int/toolkits/child-growth-standards/standards/body-mass-index-for-age-bmi-for-age
  (BMI lives under **/toolkits/**, not /tools/ — the /tools/ path 404s)

Authority: served from `cdn.who.int`, the official WHO content CDN, under
`/media/docs/default-source/child-growth/child-growth-standards/indicators/`, and linked directly
from the WHO Child Growth Standards tool pages.

## Source B — official WHO Anthro LMS parameter tables (BONUS, finer resolution)

Base: `https://raw.githubusercontent.com/WorldHealthOrganization/anthro/master/data-raw/growthstandards/`
All **HTTP 200**. Byte sizes match the GitHub git-tree API exactly (independent integrity check).

| File | Bytes | Indicator |
|---|---|---|
| weianthro.txt | 111813 | weight-for-age |
| lenanthro.txt | 100323 | length-for-age |
| hcanthro.txt | 91947 | head circumference-for-age |
| bmianthro.txt | 120786 | BMI-for-age |
| wflanthro.txt | 43302 | weight-for-length |
| wfhanthro.txt | 37158 | weight-for-height |
| acanthro.txt | 107829 | arm circumference (MUAC)-for-age |
| ssanthro.txt | 104662 | subscapular skinfold-for-age |
| tsanthro.txt | 104527 | triceps skinfold-for-age |

Authority: `WorldHealthOrganization/anthro` is WHO's own GitHub org; the repo description is
"Computation of the WHO Child Growth Standards". These are the LMS tables shipped with WHO Anthro.

## Source C — Permenkes RI No. 2 Tahun 2020 (the adopting regulation)

| File | Bytes | URL | Status |
|---|---|---|---|
| permenkes-no-2-tahun-2020.pdf | 2363729 | https://peraturan.bpk.go.id/Download/144762/Permenkes%20Nomor%202%20Tahun%202020.pdf | 200, application/pdf |
| permenkes-no-2-tahun-2020.txt | 96492 | (derived locally from the PDF via pypdf; not downloaded) | — |

Landing page: https://peraturan.bpk.go.id/Details/152505/permenkes-no-2-tahun-2020 — HTTP 200,
`<title>` = "Permenkes No. 2 Tahun 2020 tentang Standar Antropometri Anak - JDIH BPK".
Found via https://peraturan.bpk.go.id/Search/?keywords=Standar+Antropometri+Anak (the `q=` param is ignored; `keywords=` is the real one).

**The ID in the task brief (131013) is wrong** — it resolves to a Lombok Barat Perbup. Correct ID is **152505**.

The PDF has 2 stray `\r\n` bytes before the `%PDF` header. pypdf tolerates this; pdfminer/pdfplumber
reject it with "No /Root object!". Strip the first 2 bytes to use pdfminer.

Authority: BPK (Badan Pemeriksa Keuangan) JDIH is Indonesia's official national legal-document repository.
PDF p.12 states verbatim: *"Klasifikasi penilaian status gizi berdasarkan Indeks Antropometri sesuai
dengan kategori status gizi pada WHO Child Growth Standards untuk anak usia 0-5 tahun."*

## Verification

Run `python verify.py` and `python compare_permenkes.py` from this directory.

**verify.py** — 14/14 tables present with correct row counts and all 7 SD columns; the three
supplied spot-checks pass exactly; XLSX LMS values match the Anthro .txt bit-for-bit at age 0 for
10 independent (file, sex, key) pairs; and every SD column in every row is reproducible from its
own L,M,S. Result: **ALL CHECKS PASSED**.

**compare_permenkes.py** — parses all 14 "Tabel N." blocks out of the PDF and compares against the
WHO XLSX. Result: **5978 cells compared, 1 mismatch**.

### The one mismatch is a typo in the Permenkes, not in WHO

Table 12 (BB/TB girls), TB = 69.5 cm, column −3 SD:
- Permenkes PDF text layer: `6.` (the decimal digit is genuinely absent)
- WHO XLSX: `6.3`
- LMS recomputation: L=−0.3833, M=8.2039, S=0.09065, Z=−3 → 6.3339 → **6.3**

Char-level inspection of PDF p.39 confirms it: that cell contains two glyphs (`'6'`, `'.'`) followed by
a space, whereas every other cell in the row contains three (`'6'`,`'.'`,`'9'` etc.). Both pypdf and
pdfplumber read it identically, so this is a defect in the source PDF, not an extraction artifact.
It is the only such cell in all 78 pages.

**Use WHO's 6.3. The Permenkes value is unusable.**

## Errata / gotchas for anyone parsing these files

1. `lhfa_*_2-to-5-years_zscores.xlsx` has a trailing-space header: `'M       '`, not `'M'`. Strip headers.
2. At month 24 the length-for-age and height-for-age files **disagree** (boys: M=87.8161 vs 87.1161).
   That 0.7 cm is the recumbent-length vs standing-height offset, and Permenkes p.12 mandates exactly
   that ±0.7 cm correction. Do not treat it as a data error.
3. Anthro .txt `age` is in **DAYS** (0–1826), not months. `sex`: 1=male, 2=female.
   WFL/WFH .txt step by 0.1 cm; the XLSX tables step by 0.5 cm.
4. Anthro allowed age range is 0–1856 days; the table only extends to 1826.
