import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent) + '/'
PAGE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'test.html').as_uri()
import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 960, 'height': 540})
        await pg.add_init_script("localStorage.setItem('sideways.settings', JSON.stringify({stage:0, car:2, voice:false, sound:false, ghost:false, shadows:true, cam:0}))")
        await pg.goto(PAGE)
        for i in range(120):
            await pg.wait_for_timeout(500)
            if await pg.evaluate('window.__rally && window.__rally.mode') == 'menu': break
        await pg.click('#startBtn')
        await pg.evaluate('window.__rally.auto(true); window.__rally.advance(3.8)')
        js = await pg.evaluate("window.__rally.W.T.notes ? window.__rally.W.T.notes.filter(n => n.kind === 'jump').map(n => n.mid) : null")
        print('jumps', js)
        target = js[0] - 25
        while await pg.evaluate('window.__rally.car.s') < target:
            await pg.evaluate('window.__rally.advance(0.5)')
        t = 0
        for i in range(80):
            await pg.evaluate('window.__rally.advance(0.05)')
            if await pg.evaluate('window.__rally.car.air && window.__rally.car.vy > 0.5'): t = i; break
        print('air at', t)
        await pg.evaluate('window.__rally.view([5.5, 1.2, 1.0], [0, 0.4, 0.3], 50)')
        shots = 0; landed = False
        for i in range(60):
            await pg.evaluate('window.__rally.advance(0.05)')
            air = await pg.evaluate('window.__rally.car.air')
            if i == 6: await pg.screenshot(path='jump_air.png')
            if not air and not landed:
                landed = True
                for k in range(3):
                    await pg.screenshot(path=f'jump_land{k}.png'); await pg.evaluate('window.__rally.advance(0.05)')
                break
        await b.close()
asyncio.run(main())
