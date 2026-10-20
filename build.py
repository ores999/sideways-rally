import pathlib
root = pathlib.Path(__file__).parent
src = root / 'src'
page = (src / 'page.html').read_text()
scripts = ''.join(f"<script>\n{(src / n).read_text()}\n</script>\n" for n in ['core.js', 'gl.js', 'carmodel.js', 'world.js', 'net.js', 'game.js'])
out = page + scripts
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist' / 'sideways-rally.html').write_text(out)
# a standalone test page with a document skeleton (the artifact host adds this itself)
(root / 'dist' / 'test.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + out + '</body></html>')
print('built', len(out) // 1024, 'KB')
