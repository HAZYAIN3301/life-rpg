"""Render the source-backed multiplayer report; requires reportlab, no app writes."""
from pathlib import Path
import re
from html import escape
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    KeepTogether,
)
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'MULTIPLAYER-RESEARCH-2026-09.md'
OUTPUT = ROOT / 'output/pdf/satoru-multiplayer-research.pdf'
FONT_DIR = Path('/System/Library/Fonts/Supplemental')
for name, filename in (
    ('Report', 'Arial.ttf'), ('Report-Bold', 'Arial Bold.ttf'),
    ('Report-Italic', 'Arial Italic.ttf'), ('Report-BoldItalic', 'Arial Bold Italic.ttf'),
):
    pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / filename)))
pdfmetrics.registerFontFamily('Report', normal='Report', bold='Report-Bold',
                            italic='Report-Italic', boldItalic='Report-BoldItalic')

INK = colors.HexColor('#171717')
MUTED = colors.HexColor('#626262')
GRAY = colors.HexColor('#ededed')
styles = {
    'body': ParagraphStyle('body', fontName='Report', fontSize=10.1, leading=14.3,
                           textColor=INK, spaceAfter=8, splitLongWords=True),
    'title': ParagraphStyle('title', fontName='Report-Bold', fontSize=24, leading=29,
                            textColor=INK, spaceAfter=22, keepWithNext=True),
    'h2': ParagraphStyle('h2', fontName='Report-Bold', fontSize=15, leading=19,
                         textColor=INK, spaceBefore=17, spaceAfter=9, keepWithNext=True),
    'h3': ParagraphStyle('h3', fontName='Report-Bold', fontSize=11.6, leading=15,
                         textColor=INK, spaceBefore=11, spaceAfter=6, keepWithNext=True),
    'list': ParagraphStyle('list', fontName='Report', fontSize=10.1, leading=14.3,
                           textColor=INK, leftIndent=13, firstLineIndent=-10, spaceAfter=6),
    'cell': ParagraphStyle('cell', fontName='Report', fontSize=8.1, leading=10.8,
                           textColor=INK, alignment=TA_LEFT),
    'ref': ParagraphStyle('ref', fontName='Report', fontSize=8.6, leading=12.2,
                          textColor=INK, spaceAfter=7),
}
for style in styles.values():
    style.allowWidows = 0
    style.allowOrphans = 0

def inline(text):
    value = escape(text)
    # Links are clickable in the PDF; all source URLs stay explicit in Markdown.
    value = re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)',
                   lambda m: f'<a href="{m.group(2)}"><u>{m.group(1)}</u></a>', value)
    value = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', value)
    value = re.sub(r'`([^`]+)`', r'<font size="9">\1</font>', value)
    return value

def paragraph(text, style='body'):
    return Paragraph(inline(text), styles[style])

def page_frame(canvas: Canvas, doc):
    canvas.saveState()
    width, height = A4
    if doc.page > 1:
        canvas.setFont('Report', 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(44, height - 27, 'Satoru — мультиплеер')
        canvas.setStrokeColor(colors.HexColor('#d6d6d6'))
        canvas.line(44, height - 33, width - 44, height - 33)
    canvas.setFillColor(MUTED)
    canvas.setFont('Report', 8)
    canvas.drawRightString(width - 44, 23, str(doc.page))
    canvas.restoreState()

def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=44, rightMargin=44,
                            topMargin=47, bottomMargin=42,
                            title='Мультиплеер Satoru: от счётчика XP к совместному приключению',
                            author='Satoru', pageCompression=1)
    lines = SOURCE.read_text(encoding='utf-8').splitlines()
    flow = []
    index = 0
    refs = False
    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue
        if line.startswith('|'):
            rows = []
            while index < len(lines) and lines[index].strip().startswith('|'):
                cells = [cell.strip() for cell in lines[index].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', cell) for cell in cells):
                    rows.append(cells)
                index += 1
            cols = len(rows[0])
            proportions = [0.18, 0.27, 0.28, 0.27] if cols == 4 else [0.26, 0.38, 0.36]
            table_data = [[paragraph(('**' + cell + '**') if r == 0 else cell, 'cell')
                           for cell in cells] for r, cells in enumerate(rows)]
            table = Table(table_data, colWidths=[doc.width * p for p in proportions],
                          repeatRows=1, hAlign='LEFT', splitByRow=1)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), GRAY),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 7),
                ('RIGHTPADDING', (0, 0), (-1, -1), 7),
                ('TOPPADDING', (0, 0), (-1, -1), 7),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
                ('LINEBELOW', (0, 0), (-1, 0), 0.65, colors.HexColor('#999999')),
                ('LINEBELOW', (0, 1), (-1, -1), 0.3, colors.HexColor('#d6d6d6')),
            ]))
            flow.extend([Spacer(1, 4), KeepTogether([table]), Spacer(1, 12)])
            continue
        if line.startswith('# '):
            flow.append(paragraph(line[2:], 'title'))
        elif line.startswith('## '):
            if line == '## Источники':
                refs = True
            flow.append(paragraph(line[3:], 'h2'))
        elif line.startswith('### '):
            flow.append(paragraph(line[4:], 'h3'))
        elif line.startswith('- '):
            flow.append(KeepTogether([paragraph('• ' + line[2:], 'list')]))
        elif re.match(r'^\d+\. ', line):
            flow.append(KeepTogether([paragraph(line, 'list')]))
        else:
            collected = [line]
            while index + 1 < len(lines) and lines[index + 1].strip():
                if re.match(r'^(#|\||- |\d+\. )', lines[index + 1]):
                    break
                index += 1
                collected.append(lines[index].strip())
            flow.append(paragraph(' '.join(collected), 'ref' if refs else 'body'))
        index += 1
    doc.build(flow, onFirstPage=page_frame, onLaterPages=page_frame)
    print(OUTPUT)

if __name__ == '__main__':
    build()
