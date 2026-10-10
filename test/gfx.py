import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent) + '/'
PAGE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'test.html').as_uri()
import asyncio, sys, json
from playwright.async_api import async_playwright
OUT = HERE
async def shot(b, stage, car, post, tag, t=12, views=None):
    pg = await b.new_page(viewport={'width': 960, 'height': 540})
    logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    await pg.add_init_script(f"localStorage.setItem('sideways.settings', JSON.stringify({{stage:{stage}, car:{car}, voice:false, sound:false, ghost:false, shadows:true, post:{'true' if post else 'false'}, cam:0, name:'Tester'}}))")
    await pg.goto(PAGE)
    for i in range(120):
        await pg.wait_for_timeout(500)
        if await pg.evaluate('window.__rally && window.__rally.mode') in ('menu',): break
    else:
        print('never reached menu', logs[:5])
    await pg.click('#startBtn')
    await pg.evaluate(f'window.__rally.auto(true); window.__rally.advance(3.8); window.__rally.advance({t})')
    await pg.screenshot(path=OUT + f'g_{tag}_chase.png')
    for name, v in (views or {}).items():
        await pg.evaluate(f'window.__rally.view({json.dumps(v[0])}, {json.dumps(v[1])}, {v[2]}); window.__rally.advance(0.05)')
        await pg.screenshot(path=OUT + f'g_{tag}_{name}.png')
    await pg.evaluate('window.__rally.view(null)')
    errs = [l for l in logs if 'ERR_TUNNEL' not in l]
    if errs: print(tag, 'logs', errs[:6])
    await pg.close()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        views = {'car': ([3.2, 1.3, 4.2], [0, 0.6, 0], 42), 'side': ([4.5, 0.9, 0.6], [0, 0.5, 0.2], 40)}
        for stage, car, nm in [(0, 0, 'pine'), (1, 3, 'frost'), (2, 4, 'mesa')]:
            for post in ([True, False] if '--ab' in sys.argv else [True]):
                await shot(b, stage, car, post, f'{nm}_{"post" if post else "flat"}', views=views)
        await b.close()
asyncio.run(main())
