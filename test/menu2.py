import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent) + '/'
PAGE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'test.html').as_uri()
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for name, vw, vh, mob in [('desk', 1280, 760, False), ('phone', 390, 844, True)]:
            ctx = await b.new_context(viewport={'width': vw, 'height': vh}, has_touch=mob, is_mobile=mob)
            pg = await ctx.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.add_init_script("localStorage.setItem('sideways.settings', JSON.stringify({stage:2, car:5, voice:false, sound:false, ghost:true, shadows:false, cam:0}))")
            await pg.goto(PAGE)
            for i in range(80):
                await pg.wait_for_timeout(500)
                if await pg.evaluate('window.__rally && window.__rally.mode') == 'menu': break
            await pg.click('#tabCar')
            await pg.evaluate('window.__rally.advance(0.3)')
            if name == 'desk':
                box = await pg.query_selector('#gSheet canvas')
                bb = await box.bounding_box()
                await pg.mouse.move(bb['x'] + bb['width'] * 0.7, bb['y'] + bb['height'] * 0.5)
            await pg.screenshot(path=f'' + HERE + 'shot_menu_{name}_car.png')
            await pg.click('#tabOpts')
            await pg.evaluate('window.__rally.advance(0.1)')
            await pg.screenshot(path=f'' + HERE + 'shot_menu_{name}_opts.png')
            print(name, errs, await pg.evaluate('document.documentElement.scrollWidth'))
            await ctx.close()
        await b.close()
asyncio.run(main())
