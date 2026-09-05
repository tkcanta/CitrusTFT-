#!/usr/bin/env python3
"""Bundle the local CSS/JS into one HTML. Python standard library only.
Fonts remain remote; no font binaries are embedded or distributed.
Run: python build_standalone.py [output.html]
"""
from pathlib import Path
import re
import sys
ROOT = Path(__file__).resolve().parent
OUTPUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / 'TFT-Thumbnail-Editor.html'
html = (ROOT / 'index.html').read_text(encoding='utf-8')
for name in ('vendor/gforce.css', 'styles.css'):
    pattern = r'<link\b[^>]*href="' + re.escape(name) + r'"[^>]*>'
    html, count = re.subn(pattern, lambda _: '<style>\n' + (ROOT / name).read_text(encoding='utf-8') + '\n</style>', html)
    if count != 1:
        raise RuntimeError(f'Expected exactly one stylesheet reference: {name}')
blocks = []
for name in ('vendor/gforce.js', 'assets.js', 'core.js', 'catalog.js', 'sources.js', 'app.js'):
    pattern = r'<script\b[^>]*src="' + re.escape(name) + r'"[^>]*>\s*</script>'
    html, count = re.subn(pattern, '', html)
    if count != 1:
        raise RuntimeError(f'Expected exactly one script reference: {name}')
    source = (ROOT / name).read_text(encoding='utf-8').replace('</script', '<\\/script')
    blocks.append('<script>\n' + source + '\n</script>')
license_text = (ROOT / 'vendor/GFORCE-LICENSE.txt').read_text(encoding='utf-8')
html = html.replace('</body>', '\n'.join(blocks) + '\n</body>')
html = html.replace('<head>', '<head>\n<!-- G-Force UI 1.0.0 license\n' + license_text + '\n-->')
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(html, encoding='utf-8')
print(OUTPUT)
