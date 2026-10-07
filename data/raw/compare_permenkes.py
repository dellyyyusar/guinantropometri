"""Compare Permenkes 2/2020 appendix tables against the official WHO XLSX cut-offs.

Parses every "Tabel N." block out of the extracted PDF text and asserts all seven SD
columns match the corresponding WHO file value-for-value.

Run: python compare_permenkes.py
"""
import os
import re
import sys

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
TXT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "permenkes-no-2-tahun-2020.txt")

# Tabel N -> (who xlsx, key column name in xlsx)
TABLES = {
    1: ("wfa_boys_0-to-5-years_zscores.xlsx", "Month"),
    2: ("lhfa_boys_0-to-2-years_zscores.xlsx", "Month"),
    3: ("lhfa_boys_2-to-5-years_zscores.xlsx", "Month"),
    4: ("wfl_boys_0-to-2-years_zscores.xlsx", "Length"),
    5: ("wfh_boys_2-to-5-years_zscores.xlsx", "Height"),
    6: ("bmi_boys_0-to-2-years_zcores.xlsx", "Month"),
    7: ("bmi_boys_2-to-5-years_zscores.xlsx", "Month"),
    8: ("wfa_girls_0-to-5-years_zscores.xlsx", "Month"),
    9: ("lhfa_girls_0-to-2-years_zscores.xlsx", "Month"),
    10: ("lhfa_girls_2-to-5-years_zscores.xlsx", "Month"),
    11: ("wfl_girls_0-to-2-years_zscores.xlsx", "Length"),
    12: ("wfh_girls_2-to-5-years_zscores.xlsx", "Height"),
    13: ("bmi_girls_0-to-2-years_zscores.xlsx", "Month"),
    14: ("bmi_girls_2-to-5-years_zscores.xlsx", "Month"),
}

SD = ["SD3neg", "SD2neg", "SD1neg", "SD0", "SD1", "SD2", "SD3"]


def who_rows(fname):
    ws = openpyxl.load_workbook(os.path.join(HERE, fname), data_only=True).active
    rows = list(ws.iter_rows(values_only=True))
    hdr = [str(h).strip() for h in rows[0]]
    out = {}
    for r in rows[1:]:
        if r[0] is None:
            continue
        out[round(float(r[0]), 1)] = dict(zip(hdr, r))
    return out


def main():
    pages = open(TXT, encoding="utf-8").read().split("\n\f\n")
    # appendix tables live on PDF pages 16..44 (1-indexed)
    blob = "\n".join(pages[15:44])
    blob = re.sub(r"^\s*-\s*\d+\s*-\s*$", "", blob, flags=re.M)  # strip page numbers

    marks = [(m.start(), int(m.group(1))) for m in re.finditer(r"Tabel\s+(\d+)\.", blob)]
    assert marks, "no 'Tabel N.' markers found"

    total = bad = 0
    for i, (pos, num) in enumerate(marks):
        if num not in TABLES:
            continue  # 5-18y tables (WHO Reference 2007) are out of scope
        end = marks[i + 1][0] if i + 1 < len(marks) else len(blob)
        chunk = blob[pos:end]
        fname, keycol = TABLES[num]
        who = who_rows(fname)

        found, mism = 0, []
        # a data row = 8 numbers: key + 7 SD cut-offs
        for line in chunk.splitlines():
            nums = re.findall(r"-?\d+(?:[.,]\d+)?", line)
            if len(nums) != 8:
                continue
            try:
                vals = [float(n.replace(",", ".")) for n in nums]
            except ValueError:
                continue
            key = round(vals[0], 1)
            if key not in who:
                continue
            found += 1
            w = who[key]
            for j, col in enumerate(SD):
                total += 1
                if abs(float(w[col]) - vals[j + 1]) > 0.051:
                    bad += 1
                    if len(mism) < 3:
                        mism.append(f"key={key} {col}: who={w[col]} permenkes={vals[j+1]}")

        pct = 100.0 * found / len(who) if who else 0
        flag = "OK " if found == len(who) and not mism else "!! "
        print(f"{flag}Tabel {num:<2} {fname:<42} rows {found:>3}/{len(who):<3} ({pct:5.1f}%)")
        for m in mism:
            print(f"      MISMATCH {m}")

    print(f"\ncompared {total} cut-off cells, {bad} mismatches")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
