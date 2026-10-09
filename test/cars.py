import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent) + '/'
PAGE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'test.html').as_uri()
import asyncio, sys
from playwright.async_api import async_playwright
views = [('night', [3.2, 1.3, 5.2], [0, 0.6, 0.4], 38)]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 640, 'height': 400})
        logs = []
        pg.on('pageerror', lambda e: logs.append(str(e)))
        pg.on('console', lambda m: logs.append(m.text) if m.type == 'error' else None)
        await pg.add_init_script("localStorage.setItem('sideways.settings', JSON.stringify({stage:%s, car:0, voice:false, sound:false, ghost:true, shadows:true, cam:0}))" % (sys.argv[1] if len(sys.argv) > 1 else 0))
        await pg.goto(PAGE)
        for i in range(80):
            await pg.wait_for_timeout(500)
            if await pg.evaluate('window.__rally && window.__rally.mode') == 'menu': break
        await pg.evaluate("document.getElementById('menu').hidden = true; document.getElementById('garage').hidden = true")
        for ci in [1, 3]:
            await pg.evaluate(f'window.__rally.pickCar({ci})')
            await pg.evaluate("document.getElementById('menu').hidden = true; document.getElementById('garage').hidden = true")
            for name, cp, cl, fov in views:
                await pg.evaluate(f'window.__rally.view({cp}, {cl}, {fov}); window.__rally.advance(0.1)')
                await pg.screenshot(path=f'' + HERE + 'car{ci}_{name}.png')
        print(logs[:10])
        await b.close()
asyncio.run(main())
