import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent) + '/'
PAGE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'test.html').as_uri()
import asyncio, sys
from playwright.async_api import async_playwright

OUT = HERE

async def wait_menu(pg):
    for i in range(120):
        await pg.wait_for_timeout(500)
        if await pg.evaluate('window.__rally && window.__rally.mode') == 'menu':
            return

async def main(stage, car, tag):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 960, 'height': 540})
        logs = []
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        await pg.add_init_script(f"localStorage.setItem('sideways.settings', JSON.stringify({{stage:{stage}, car:{car}, voice:false, sound:false, ghost:false, shadows:true, cam:0}}))")
        await pg.goto(PAGE)
        await wait_menu(pg)
        await pg.click('#startBtn')
        await pg.evaluate('window.__rally.auto(true); window.__rally.advance(3.8); window.__rally.advance(14)')
        await pg.screenshot(path=OUT + f'fx_{tag}_chase.png')
        # low view beside the rear wheel, looking forward along the car
        await pg.evaluate('window.__rally.view([2.2, 0.55, -3.6], [0.4, 0.3, 1.5], 50); window.__rally.advance(0.05)')
        await pg.screenshot(path=OUT + f'fx_{tag}_wheel.png')
        # high rear view to see tracks behind
        await pg.evaluate('window.__rally.view([0, 4.5, -9], [0, 0, 2], 50); window.__rally.advance(0.05)')
        await pg.screenshot(path=OUT + f'fx_{tag}_tracks.png')
        await pg.evaluate('window.__rally.view(null)')
        info = await pg.evaluate('''(() => { const r = window.__rally; return { dirt: r.dbg && r.dbg.dirt, mode: r.mode }; })()''')
        print(tag, info)
        # crash: aim the car at the nearest tree / rock / wall
        res = await pg.evaluate('''(() => {
          const r = window.__rally, W = r.W, c = r.car;
          r.auto(false);
          let best = null, bd = 1e9;
          for (const arr of W.O.cols.values()) for (const o of arr) {
            if (o.kind !== 'tree' && o.kind !== 'rock' && o.kind !== 'cactus') continue;
            const d = Math.hypot(o.x - c.x, o.z - c.z); if (d > 15 && d < bd) { bd = d; best = o; }
          }
          if (!best) return null;
          const h = Math.atan2(best.x - c.x, best.z - c.z);
          // start 9 m before it
          c.x = best.x - Math.sin(h) * 9; c.z = best.z - Math.cos(h) * 9; c.h = h;
          c.vx = Math.sin(h) * 16; c.vz = Math.cos(h) * 16; c.vF = 16; c.w = 0;
          return { kind: best.kind, x: best.x, z: best.z };
        })()''')
        print('target', res)
        times = [0.45, 0.1, 0.1, 0.25]
        for i, t in enumerate(times):
            await pg.evaluate(f'window.__rally.advance({t})')
            await pg.screenshot(path=OUT + f'fx_{tag}_crash{i}.png')
        print('logs', logs[:6])
        await b.close()

stage, car, tag = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
asyncio.run(main(stage, car, tag))
