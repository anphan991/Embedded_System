from pathlib import Path
import html
import re
import sys

base = Path(__file__).resolve().parents[1]
source = base / (sys.argv[1] if len(sys.argv) > 1 else 'bao_cao_pan_tilt_te_nga.md')
text = source.read_text(encoding='utf-8')
parts = []
headings = []
para_count = 0

def inline(s):
    s = html.escape(s)
    s = re.sub(r'https://[^\s]+', lambda m: '<a href="' + m.group(0) + '">' + m.group(0) + '</a>', s)
    s = re.sub(r'\[(\d+)\]', r'<a class="citation" href="#ref-\1">[\1]</a>', s)
    return s

for block in re.split(r'\n\s*\n', text.strip()):
    block = block.strip()
    h = re.fullmatch(r'(#{1,4}) (.+)', block)
    if h:
        level = len(h.group(1))
        label = h.group(2)
        ident = 'section-' + str(len(headings))
        headings.append((level, label, ident))
        cls = ' class="chapter"' if label.startswith('Chương ') else ''
        parts.append(f'<h{level} id="{ident}"{cls}>{inline(label)}</h{level}>')
        continue
    ref = re.match(r'^\[(\d+)\] ', block)
    if ref:
        ident = 'ref-' + ref.group(1)
        parts.append(f'<p class="reference" id="{ident}">{inline(block)}</p>')
    elif block.startswith('[Vị trí chèn Hình '):
        parts.append(f'<p class="placeholder">{inline(block)}</p>')
    elif block.startswith('Hình '):
        parts.append(f'<p class="caption">{inline(block)}</p>')
    elif block.startswith('Nguồn:'):
        parts.append(f'<p class="figure-source">{inline(block)}</p>')
    else:
        para_count += 1
        parts.append('<p>' + inline(block) + '</p>')

nav = ' '.join(f'<a href="#{ident}">{html.escape(label)}</a>' for level, label, ident in headings if level == 2)
document = '''<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Báo cáo hệ thống Pan-Tilt và nhận diện té ngã</title>
<style>
*{box-sizing:border-box} html{scroll-behavior:smooth} body{margin:0;background:#f3f3f3;color:#111;font-family:"Times New Roman",serif;font-size:18px;line-height:1.6}
nav{max-width:1000px;margin:24px auto 16px;padding:0 24px;font:14px/1.7 Arial,sans-serif;display:flex;gap:16px;flex-wrap:wrap} nav a{color:#454545;text-decoration:none} nav a:hover{text-decoration:underline}
article{background:white;max-width:1000px;margin:0 auto 48px;padding:60px 80px} h1{font-size:27px;line-height:1.35;text-align:center;margin:0 0 38px;font-weight:bold} h2{font-size:23px;line-height:1.4;margin:38px 0 18px} h3{font-size:20px;line-height:1.4;margin:28px 0 12px} h4{font-size:18px;line-height:1.45;margin:24px 0 12px}
p{margin:0 0 14px;text-align:justify;text-indent:1.15cm;overflow-wrap:break-word;widows:3;orphans:3} a{color:#333;text-decoration:underline;text-underline-offset:2px} .citation{text-decoration:none;white-space:nowrap} .placeholder{text-indent:0;text-align:center;font-style:italic;color:#555;margin:24px 0 8px} .caption{text-indent:0;text-align:center;font-weight:bold;margin-bottom:5px} .figure-source{text-indent:0;font-size:16px;color:#444;margin-bottom:24px} .reference{text-indent:0;font-size:16px;text-align:left;margin-bottom:16px} h2,h3,h4{break-after:avoid}
@media(max-width:760px){body{font-size:17px}article{padding:32px 22px}h1{font-size:24px}h2{font-size:21px}p{text-align:left;text-indent:0}nav{margin-top:16px}}
@media print{@page{size:A4;margin:2.2cm}body{background:white;font-size:13pt;line-height:1.5}nav{display:none}article{max-width:none;margin:0;padding:0}h1{font-size:17pt}h2{font-size:16pt}h3{font-size:14pt}h4{font-size:13pt}.chapter{break-before:page}.reference,.figure-source{font-size:11pt}a{text-decoration:none;color:inherit}}
</style></head><body><nav aria-label="Đi đến các phần">NAV</nav><article>BODY</article></body></html>'''
document = document.replace('NAV', nav).replace('BODY', '\n'.join(parts))
output = source.with_suffix('.html')
output.write_text(document, encoding='utf-8')

refs = set(re.findall(r'^\[(\d+)\]', text, re.M))
used_refs = set(re.findall(r'(?<!^)\[(\d+)\]', '\n'.join(text.split('## Tài liệu tham khảo')[0].splitlines())))
fig_marks = re.findall(r'\[Vị trí chèn Hình ([\d.]+) tại đây\]', text)
fig_captions = re.findall(r'^Hình ([\d.]+)\.', text, re.M)
assert refs
ref_numbers = sorted(map(int, refs))
assert ref_numbers == list(range(ref_numbers[0], ref_numbers[-1] + 1))
assert used_refs <= refs
assert fig_marks == fig_captions
assert len(fig_marks) == len(set(fig_marks))
assert para_count >= 40
print({'output': str(output), 'paragraphs': para_count, 'figures': len(fig_marks), 'references': len(refs)})
