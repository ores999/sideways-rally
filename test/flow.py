import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent) + '/'
PAGE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'test.html').as_uri()
import asyncio, os
from playwright.async_api import async_playwright
CHANNEL = os.environ.get('PW_CHANNEL')  # e.g. PW_CHANNEL=chrome to use the installed Chrome instead of Playwright's Chromium
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel=CHANNEL, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 800, 'height': 450})
        logs = []
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        await pg.add_init_script("localStorage.setItem('sideways.settings', JSON.stringify({stage:2, car:1, voice:true, sound:true, ghost:true, shadows:false, cam:0}))")
        await pg.goto(PAGE)
        for i in range(80):
            await pg.wait_for_timeout(500)
            if await pg.evaluate('window.__rally && window.__rally.mode') == 'menu': break
        await pg.click('#startBtn')
        await pg.evaluate('window.__rally.auto(true); window.__rally.advance(3.8); window.__rally.advance(115)')
        print('after run:', await pg.evaluate('window.__rally.mode'), 'results visible:', await pg.is_visible('#results'))
        print('stored pb:', await pg.evaluate("(()=>{const r=JSON.parse(localStorage.getItem('sideways.pb.mesa.impressa')); return r && [r.t, r.car, r.q.length]})()"), 'medal', await pg.evaluate("localStorage.getItem('sideways.medal.mesa')"))
        await pg.screenshot(path='' + HERE + 'shot_flow_results.png')
        # retry via Enter key
        await pg.keyboard.press('Enter')
        await pg.evaluate('window.__rally.advance(3.8); window.__rally.advance(30)')
        print('retry mode:', await pg.evaluate('window.__rally.mode'), 'delta text:', await pg.inner_text('#hDelta'))
        await pg.screenshot(path='' + HERE + 'shot_flow_retry.png')
        # pause, then menu
        await pg.keyboard.press('Escape'); await pg.evaluate('window.__rally.advance(0.1)')
        print('paused visible:', await pg.is_visible('#pause'))
        await pg.click('#pMenu'); await pg.evaluate('window.__rally.advance(0.2)')
        print('menu visible:', await pg.is_visible('#menu'), 'mode', await pg.evaluate('window.__rally.mode'))
        # switch stage from menu
        await pg.click('#stageList .row:nth-child(1)')
        for i in range(60):
            await pg.wait_for_timeout(500)
            if await pg.evaluate('window.__rally.mode') == 'menu': break
        await pg.evaluate('window.__rally.advance(0.2)')
        print('stage now:', await pg.evaluate('window.__rally.W.st.id'))
        await pg.click('#tabCar'); await pg.click('#carList .row:nth-child(5)')
        await pg.evaluate('window.__rally.advance(0.2)')
        await pg.screenshot(path='' + HERE + 'shot_flow_menu2.png')
        # manual gearbox
        await pg.click('#tabOpts'); await pg.click('#gearManual')
        await pg.evaluate('window.__rally.startRace(); window.__rally.advance(3.8)')
        await pg.keyboard.down('ArrowUp')
        gears = []
        for i in range(8):
            await pg.evaluate('window.__rally.advance(0.7)')
            gears.append(await pg.evaluate('[window.__rally.car.gear, Math.round(window.__rally.car.rpm), Math.round(window.__rally.car.vF*3.6)]'))
            await pg.keyboard.press('KeyE')
        await pg.keyboard.up('ArrowUp')
        print('manual gears (gear,rpm,kmh):', gears)
        await pg.screenshot(path='' + HERE + 'shot_flow_manual.png')
        for l in logs[:20]: print(l)
        await b.close()
asyncio.run(main())
