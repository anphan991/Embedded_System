from pathlib import Path
import re
import shutil

base = Path(__file__).resolve().parents[1]
main = base / 'bao_cao_pan_tilt_te_nga.md'
addition = base / 'chuong_4_den_7.md'
original = main.read_text(encoding='utf-8')
original_body, original_refs = original.split('\n## Tài liệu tham khảo\n', 1)
original_body = original_body.split('\n## Chương 4.', 1)[0].rstrip()
original_refs = original_refs.split('\n## Phụ lục', 1)[0]
original_refs = original_refs.split('\n[16]', 1)[0].strip()
new = addition.read_text(encoding='utf-8').split('\n\n', 1)[1]
new_body, new_end = new.split('\n## Tài liệu tham khảo bổ sung\n', 1)
new_refs, appendix = new_end.split('\n## Phụ lục\n', 1)
combined = (original_body + '\n\n' + new_body.strip()
            + '\n\n## Tài liệu tham khảo\n\n' + original_refs
            + '\n\n' + new_refs.strip()
            + '\n\n## Phụ lục\n\n' + appendix.strip() + '\n')
assert re.findall(r'^## Chương (\d+)\.', combined, re.M) == list('1234567')
assert not re.search(r'còi|buzzer|âm thanh', combined, re.I)
main.write_text(combined, encoding='utf-8')
shutil.copyfile(base / '_work' / 'ket_qua_kiem_thu_2026-10-11.txt',
                base / 'bien_ban_kiem_thu_2026-10-11.txt')
print({'chapters': 7, 'characters': len(combined)})
