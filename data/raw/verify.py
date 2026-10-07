"""Provenance check: WHO Child Growth Standards 2006 tables as adopted by Permenkes 2/2020.

Asserts the published XLSX SD cut-offs against independently supplied WHO reference
values, and cross-checks the XLSX LMS parameters against the WHO Anthro LMS tables
(WorldHealthOrganization/anthro, data-raw/growthstandards/*.txt) at age 0.

Run: python verify.py
"""
import csv
import glob
import os

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))


def load_xlsx(path):
    ws = openpyxl.load_workbook(path, data_only=True).active
    rows = list(ws.iter_rows(values_only=True))
    hdr = [str(h).strip() if h is not None else None for h in rows[0]]
    return hdr, [dict(zip(hdr, r)) for r in rows[1:] if r[0] is not None]


def load_anthro(name):
    """WHO Anthro LMS table: tab-separated, sex (1=M,2=F), age/length/height in DAYS or 0.1cm, l, m, s."""
    with open(os.path.join(HERE, name), newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh, delimiter="\t"))


def sd(L, M, S, Z):
    """LMS -> value at Z. X = M*(1+L*S*Z)^(1/L), or M*exp(S*Z) when L==0."""
    if abs(L) < 1e-9:
        return M * pow(2.718281828459045, S * Z)
    return M * pow(1 + L * S * Z, 1.0 / L)


# (xlsx file, key column, key value, expected SD2neg, SD0, SD2)
SPOT = [
    ("wfa_boys_0-to-5-years_zscores.xlsx", "Month", 0, 2.5, 3.3, 4.4),
    ("lhfa_boys_0-to-2-years_zscores.xlsx", "Month", 0, 46.1, 49.9, 53.7),
    ("wfa_girls_0-to-5-years_zscores.xlsx", "Month", 0, 2.4, 3.2, 4.2),
]

# (xlsx, anthro txt, sex, anthro key col, key val) -- LMS must agree exactly
LMS_XCHECK = [
    ("wfa_boys_0-to-5-years_zscores.xlsx", "weianthro.txt", 1, "age", 0),
    ("wfa_girls_0-to-5-years_zscores.xlsx", "weianthro.txt", 2, "age", 0),
    ("lhfa_boys_0-to-2-years_zscores.xlsx", "lenanthro.txt", 1, "age", 0),
    ("lhfa_girls_0-to-2-years_zscores.xlsx", "lenanthro.txt", 2, "age", 0),
    ("bmi_boys_0-to-2-years_zcores.xlsx", "bmianthro.txt", 1, "age", 0),
    ("bmi_girls_0-to-2-years_zscores.xlsx", "bmianthro.txt", 2, "age", 0),
    ("wfl_boys_0-to-2-years_zscores.xlsx", "wflanthro.txt", 1, "length", 45),
    ("wfl_girls_0-to-2-years_zscores.xlsx", "wflanthro.txt", 2, "length", 45),
    ("wfh_boys_2-to-5-years_zscores.xlsx", "wfhanthro.txt", 1, "height", 65),
    ("wfh_girls_2-to-5-years_zscores.xlsx", "wfhanthro.txt", 2, "height", 65),
]

SD_COLS = ["SD3neg", "SD2neg", "SD1neg", "SD0", "SD1", "SD2", "SD3"]

# Permenkes 2/2020 table -> (source file, expected row count)
EXPECTED = {
    "BB/U boys 0-60m": ("wfa_boys_0-to-5-years_zscores.xlsx", 61),
    "PB/U boys 0-24m": ("lhfa_boys_0-to-2-years_zscores.xlsx", 25),
    "TB/U boys 24-60m": ("lhfa_boys_2-to-5-years_zscores.xlsx", 37),
    "BB/PB boys 45-110cm": ("wfl_boys_0-to-2-years_zscores.xlsx", 131),
    "BB/TB boys 65-120cm": ("wfh_boys_2-to-5-years_zscores.xlsx", 111),
    "IMT/U boys 0-24m": ("bmi_boys_0-to-2-years_zcores.xlsx", 25),
    "IMT/U boys 24-60m": ("bmi_boys_2-to-5-years_zscores.xlsx", 37),
    "BB/U girls 0-60m": ("wfa_girls_0-to-5-years_zscores.xlsx", 61),
    "PB/U girls 0-24m": ("lhfa_girls_0-to-2-years_zscores.xlsx", 25),
    "TB/U girls 24-60m": ("lhfa_girls_2-to-5-years_zscores.xlsx", 37),
    "BB/PB girls 45-110cm": ("wfl_girls_0-to-2-years_zscores.xlsx", 131),
    "BB/TB girls 65-120cm": ("wfh_girls_2-to-5-years_zscores.xlsx", 111),
    "IMT/U girls 0-24m": ("bmi_girls_0-to-2-years_zscores.xlsx", 25),
    "IMT/U girls 24-60m": ("bmi_girls_2-to-5-years_zscores.xlsx", 37),
}


def main():
    tables = {}
    for name in glob.glob(os.path.join(HERE, "*.xlsx")):
        tables[os.path.basename(name)] = load_xlsx(name)

    # 1. all 14 tables present, right row count, all 7 SD columns
    for label, (fname, nrows) in EXPECTED.items():
        assert fname in tables, f"MISSING {fname} for {label}"
        hdr, rows = tables[fname]
        assert len(rows) == nrows, f"{label}: {len(rows)} rows, expected {nrows}"
        for c in SD_COLS:
            assert c in hdr, f"{label}: missing SD column {c}"
        print(f"OK  {label:<22} {fname:<42} {len(rows):>4} rows  7 SD cutpoints")

    # 2. spot checks against independently supplied WHO values
    for fname, key, kval, e3, e2, ep2 in SPOT:
        hdr, rows = tables[fname]
        r = next(x for x in rows if x[key] == kval)
        got = (r["SD2neg"], r["SD0"], r["SD2"])
        assert got == (e3, e2, ep2), f"{fname} {key}={kval}: got {got}, want {(e3, e2, ep2)}"
        print(f"OK  spot {fname} {key}={kval}: -2SD={got[0]} med={got[1]} +2SD={got[2]}")

    # 3. cross-check XLSX LMS vs WHO Anthro LMS tables
    for xname, aname, sex, akey, aval in LMS_XCHECK:
        hdr, rows = tables[xname]
        x = rows[0]
        a = next(
            r
            for r in load_anthro(aname)
            if int(r["sex"]) == sex and abs(float(r[akey]) - aval) < 1e-9
        )
        for col in ("L", "M", "S"):
            assert abs(float(x[col]) - float(a[col.lower()])) < 1e-9, (
                f"{xname} vs {aname} sex={sex} {akey}={aval}: {col} "
                f"xlsx={x[col]} anthro={a[col.lower()]}"
            )
        print(f"OK  LMS  {xname:<42} == {aname} sex={sex} {akey}={aval}")

    # 4. internal consistency: SD cut-offs must equal LMS(L,M,S,Z) rounded to 1dp
    zs = [-3, -2, -1, 0, 1, 2, 3]
    for fname, (hdr, rows) in tables.items():
        if not all(c in hdr for c in SD_COLS):
            continue
        for r in rows:
            L, M, S = float(r["L"]), float(r["M"]), float(r["S"])
            for z, c in zip(zs, SD_COLS):
                exp = round(sd(L, M, S, z), 1)
                assert abs(exp - float(r[c])) <= 0.101, (
                    f"{fname} {r[hdr[0]]}: {c} file={r[c]} lms-derived={exp}"
                )
        print(f"OK  LMS->{len(zs)}SD reproducible from L,M,S in {fname}")

    print(f"\nALL CHECKS PASSED: {len(EXPECTED)} tables, {len(tables)} xlsx files verified.")


if __name__ == "__main__":
    main()
