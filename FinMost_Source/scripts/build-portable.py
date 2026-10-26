"""Собрать автономный HTML из тех же файлов, которые использует сайт."""
from pathlib import Path
import base64
import hashlib
import sys

root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
html = (dist / 'index.html').read_text(encoding='utf-8')
hashes = []
scripts = []
for filename in ['engine.js', 'learning.js', 'app.js']:
    code = (dist / filename).read_text(encoding='utf-8').replace('</script', '<\\/script')
    hashes.append("'sha256-" + base64.b64encode(hashlib.sha256(code.encode()).digest()).decode() + "'")
    html = html.replace(f'<script defer src="{filename}"></script>', '')
    scripts.append('<script>' + code + '</script>')
html = html.replace('</body>', '\n'.join(scripts) + '\n</body>')
html = html.replace("script-src 'self'", 'script-src ' + ' '.join(hashes))
html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>' + (dist / 'styles.css').read_text(encoding='utf-8') + '</style>')
icon = base64.b64encode((dist / 'icon.svg').read_bytes()).decode()
html = html.replace('href="icon.svg"', 'href="data:image/svg+xml;base64,' + icon + '"')
out = Path(sys.argv[1]) if len(sys.argv) > 1 else dist / 'downloads' / 'FinMost.html'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding='utf-8')
print(f'{out} ({out.stat().st_size} bytes)')
