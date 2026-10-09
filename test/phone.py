import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent) + '/'
PAGE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'test.html').as_uri()
import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for name, vw, vh in [('portrait', 390, 844), ('landscape', 844, 390)]:
            ctx = await b.new_context(viewport={'width': vw, 'height': vh}, has_touch=True, is_mobile=True, device_scale_factor=1)
            pg = await ctx.new_page()
            logs = []
            pg.on('pageerror', lambda e: logs.append(str(e)))
            await pg.add_init_script("localStorage.setItem('sideways.settings', JSON.stringify({stage:1, car:2, voice:false, sound:false, ghost:true, shadows:false, cam:0}))")
            await pg.goto(PAGE)
            for i in range(80):
                await pg.wait_for_timeout(500)
                if await pg.evaluate('window.__rally && window.__rally.mode') == 'menu': break
            await pg.evaluate('window.__rally.advance(0.3)')
            await pg.screenshot(path=f'' + HERE + 'shot_phone_{name}_menu.png')
            await pg.evaluate('window.__rally.startRace(); window.__rally.auto(true); window.__rally.advance(3.8); window.__rally.advance(9)')
            await pg.screenshot(path=f'' + HERE + 'shot_phone_{name}_race.png')
            sw = await pg.evaluate('document.documentElement.scrollWidth')
            print(name, 'scrollWidth', sw, logs)
            await ctx.close()
        await b.close()
asyncio.run(main())
