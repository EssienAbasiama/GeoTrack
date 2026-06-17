# -*- coding: utf-8 -*-
"""Guarantee the TOC / List-of-Figures / List-of-Tables render with page numbers
right-aligned in a vertical column with dotted leaders.

Defines TOC 1/2/3 paragraph styles with a right-aligned tab stop + dot leader at
the right margin (6.5"), so when Word updates the fields the numbers line up.
"""
from docx import Document
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.shared import Inches, Pt

DOC = "GeoTrack_Report_FINAL.docx"
RIGHT_TAB = Inches(6.5)          # usable width = 8.5" - 1" - 1"

doc = Document(DOC)
existing = {s.name for s in doc.styles if s.name}


def ensure_toc_style(name, indent_in):
    if name in existing:
        st = doc.styles[name]
    else:
        st = doc.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
        st.base_style = doc.styles["Normal"]
    st.font.name = "Times New Roman"
    st.font.size = Pt(12)
    pf = st.paragraph_format
    pf.left_indent = Inches(indent_in)
    pf.space_after = Pt(3)
    pf.tab_stops.clear_all()
    pf.tab_stops.add_tab_stop(RIGHT_TAB, WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
    return st


for name, indent in [("TOC 1", 0.0), ("TOC 2", 0.3), ("TOC 3", 0.6)]:
    ensure_toc_style(name, indent)

OUT = DOC
try:
    doc.save(OUT)
except PermissionError:
    OUT = "GeoTrack_Report_FINAL_aligned.docx"
    doc.save(OUT)
    print(f"(Original was open/locked; saved as {OUT} instead.)")
print(f"TOC 1/2/3 styles set in {OUT}: right tab + dot leader at 6.5\".")
# verify
d2 = Document(OUT)
for name in ("TOC 1", "TOC 2", "TOC 3"):
    st = d2.styles[name]
    tabs = st.paragraph_format.tab_stops
    info = [(round(t.position / 914400, 2), str(t.alignment), str(t.leader)) for t in tabs]
    print(f"  {name}: indent={round(st.paragraph_format.left_indent/914400,2)}in tabs={info}")
