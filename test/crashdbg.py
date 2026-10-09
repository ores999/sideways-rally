import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent) + '/'
PAGE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'test.html').as_uri()
import asyncio, sys, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 640, 'height': 360})
        await pg.add_init_script("localStorage.setItem('sideways.settings', JSON.stringify({stage:0, car:0, voice:false, sound:true, ghost:false, shadows:false, cam:0}))")
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(PAGE)
        for i in range(120):
            await pg.wait_for_timeout(500)
            if await pg.evaluate('window.__rally && window.__rally.mode') == 'menu': break
        await pg.click('#startBtn')
        await pg.evaluate('window.__rally.auto(true); window.__rally.advance(3.8); window.__rally.advance(14)')
        print('dbg', await pg.evaluate('JSON.stringify(window.__rally.dbg)'))
        await pg.evaluate('''(() => {
          const r = window.__rally, W = r.W, c = r.car; r.auto(false);
          let best = null, bd = 1e9;
          for (const arr of W.O.cols.values()) for (const o of arr) { if (o.kind !== 'tree') continue; const d = Math.hypot(o.x - c.x, o.z - c.z); if (d > 15 && d < bd) { bd = d; best = o; } }
          const h = Math.atan2(best.x - c.x, best.z - c.z);
          c.x = best.x - Math.sin(h) * 9; c.z = best.z - Math.cos(h) * 9; c.h = h; c.vx = Math.sin(h) * 16; c.vz = Math.cos(h) * 16; c.vF = 16; c.w = 0;
        })()''')
        for i in range(16):
            await pg.evaluate('window.__rally.advance(0.05)')
            d = await pg.evaluate('(() => { const d = window.__rally.dbg, c = window.__rally.car; return [Math.hypot(c.vx,c.vz).toFixed(1), d.hitFlash.toFixed(2), d.chips, d.dust, d.hitK.toFixed(2), d.shake.toFixed(2), document.getElementById("hitFlash").style.opacity]; })()')
            print(i, d)
        print('audio', await pg.evaluate('typeof AudioContext'), 'errors', errs)
        await b.close()
asyncio.run(main())
