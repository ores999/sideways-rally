# Online room test: three browsers (separate contexts) meet in a room on the real Supabase Realtime server, the host
# starts a race and the AI drives every car. Checks: lobby, invite link, start lights in sync, the others drawn where
# they really are, pausing online (the clock keeps running), retiring, the room result and points, a reload putting
# you back in the room with your points, and the next driver taking over when the host leaves.
# Broadcasts are ephemeral (nothing is stored), and every REST call is blocked so no time reaches the online board.
# Usage: python3 online.py            (SwiftShader, for headless servers; slow)
#        GPU=1 PW_CHANNEL=chrome python3 online.py   (on a Mac: the installed Chrome with the GPU)
import asyncio, json, os, pathlib, sys
from playwright.async_api import async_playwright
HERE = pathlib.Path(__file__).resolve().parent
PAGE = (HERE.parent / 'dist' / 'test.html').as_uri()
CHANNEL = os.environ.get('PW_CHANNEL')
ARGS = ['--use-angle=metal', '--ignore-gpu-blocklist'] if os.environ.get('GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
ARGS += ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
STAGE = int(os.environ.get('STAGE', '0'))
fails = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what, flush=True)
    if not ok: fails.append(what)

async def wait_menu(pg):
    for _ in range(160):
        await pg.wait_for_timeout(250)
        if await pg.evaluate('window.__rally && window.__rally.mode') == 'menu': return

async def page(b, name, car, logs, url=PAGE):
    ctx = await b.new_context(viewport={'width': 960, 'height': 540})
    pg = await ctx.new_page()
    pg.on('console', lambda m: logs.append(f'{name} {m.type}: {m.text}') if m.type in ('error', 'warning') and 'ERR_FAILED' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append(f'{name} PAGEERROR: {e}'))
    # settings only on the first load (a reload must keep what the page saved)
    await pg.add_init_script("if (!localStorage.getItem('sideways.settings')) localStorage.setItem('sideways.settings', JSON.stringify(%s))" % json.dumps({'stage': STAGE, 'car': car, 'voice': False, 'sound': False, 'ghost': False, 'shadows': True, 'cam': 0, 'name': name, 'v2': 1, 'boardSeeded': 1}))
    await pg.route('**/rest/v1/**', lambda r: r.abort())  # never touch the real leaderboard
    await pg.goto(url)
    await wait_menu(pg)
    return pg

async def until(pg, js, secs, what):
    for _ in range(int(secs * 4)):
        v = await pg.evaluate(js)
        if v: return v
        await pg.wait_for_timeout(250)
    check(False, 'timed out: ' + what)
    return None

ME = "sessionStorage.getItem('sideways.netId')"
OTHER = "(n => [...window.__rally.net.race.others.values()].find(o => o.n === n))"

async def main():
    logs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(channel=CHANNEL, args=ARGS)
        A = await page(b, 'Alpha', 1, logs)
        B = await page(b, 'Bravo', 4, logs)
        await A.click('#tabOnline'); await A.click('#netCreate')
        code = await until(A, "window.__rally.net.status === 'online' && window.__rally.net.code", 10, 'A online')
        print('room', code)
        await B.click('#tabOnline'); await B.fill('#netCode', code.lower()); await B.click('#netJoinBtn')
        # the third one comes in through the invite link
        C = await page(b, 'Charlie', 0, logs, PAGE + '#r=' + code)
        for pg in (A, B, C): await until(pg, "window.__rally.net.room && window.__rally.net.peers.size === 3", 12, 'everyone sees three drivers')
        check(await A.evaluate("window.__rally.net.room.h") == await A.evaluate(ME), 'A is the host')
        check('waiting for alpha' in (await B.inner_text('#startBtn')).lower(), 'B waits for the host')
        check('start race · 3 drivers' in (await A.inner_text('#startBtn')).lower(), 'A can start with 3: ' + await A.inner_text('#startBtn'))
        check(await C.is_visible('#netIn'), 'C landed in the room from the link')
        # the host picks reverse at night: the others' Stage tab follows
        await A.click('#tabStage'); await A.click('#optDir button[data-v="rev"]'); await wait_menu(A)
        await until(B, "window.__rally.net.room.k.endsWith('-r')", 8, 'room stage is the reverse')
        check((await B.evaluate("window.__rally.settings.rev")) is True, "B's Stage tab follows the host")
        await A.click('#tabOnline')
        await B.wait_for_timeout(2500)  # B builds the stage in the background
        await A.screenshot(path=str(HERE / 'shot_online_lobby.png'))
        for pg, nm in ((B, 'B'), (C, 'C')): print(nm, 'clock offset ms', round(await pg.evaluate('window.__rally.net.off'), 1), 'rtt', round(await pg.evaluate('window.__rally.net.rtt'), 1))
        await A.click('#startBtn')
        for pg in (A, B, C): await until(pg, "window.__rally.mode === 'countdown'", 25, 'countdown')
        for pg in (A, B, C): await pg.evaluate('window.__rally.auto(true)')
        for pg in (A, B, C): await until(pg, "window.__rally.mode === 'race'", 25, 'racing')
        g = [await pg.evaluate('window.__rally.net.race.greenL') for pg in (A, B, C)]
        print('green light spread ms', round(max(g) - min(g), 1))
        check(max(g) - min(g) < 60, 'all three start within 60 ms')
        errs = []
        for k in range(4):
            await A.wait_for_timeout(4000)
            a = await A.evaluate('[performance.timeOrigin + performance.now(), window.__rally.car.x, window.__rally.car.z, Math.hypot(window.__rally.car.vx, window.__rally.car.vz)]')
            o = await B.evaluate(f"(() => {{ const o = {OTHER}('Alpha'); return [performance.timeOrigin + performance.now(), o.pose.x, o.pose.z] }})()")
            errs.append(round(((a[1] - o[1]) ** 2 + (a[2] - o[2]) ** 2) ** 0.5 - a[3] * abs(o[0] - a[0]) / 1000, 2))
            if k == 1:
                await A.screenshot(path=str(HERE / 'shot_online_race_A.png')); await C.screenshot(path=str(HERE / 'shot_online_race_C.png'))
                print('A standings:', (await A.inner_text('#hNet')).replace('\n', ' '))
        print('B draws A this far from where A is (m):', errs)
        check(max(abs(e) for e in errs) < 6, 'remote car within 6 m of the real one')
        # B pauses: the overlay opens, the car stops on the brakes, the clock keeps running
        await B.evaluate('window.__rally.auto(false)'); await B.keyboard.press('Escape')
        t0, sp0 = await B.evaluate('window.__rally.raceT'), await B.evaluate('Math.hypot(window.__rally.car.vx, window.__rally.car.vz)')
        await B.wait_for_timeout(5000)
        t1, sp, vis = await B.evaluate('window.__rally.raceT'), await B.evaluate('Math.hypot(window.__rally.car.vx, window.__rally.car.vz)'), await B.is_visible('#pause')
        check(vis and t1 - t0 > 4.5 and sp < 1.5, f'online pause: overlay {vis}, clock ran {t1 - t0:.1f} s, speed {sp0:.1f} -> {sp:.1f} m/s')
        print('pause title:', await B.inner_text('#pTitle'), '/', await B.inner_text('#pMenu'))
        await B.keyboard.press('Escape'); await B.evaluate('window.__rally.auto(true)')
        # C gives up: Leave race from the pause menu
        await C.keyboard.press('Escape'); await C.click('#pMenu')
        await until(A, f"(() => {{ const o = {OTHER}('Charlie'); return o && o.out }})()", 8, 'A sees C retired')
        print('A standings after C retired:', (await A.inner_text('#hNet')).replace('\n', ' '))
        check(await C.evaluate("window.__rally.mode") == 'menu' and await C.is_visible('#netIn'), 'C is back in the lobby')
        for pg in (A, B): await until(pg, "window.__rally.mode === 'done'", 200, 'finished')
        await until(A, "window.__rally.net.room.ph === 'lobby' && window.__rally.net.room.last", 15, 'A closed the race')
        await until(C, "window.__rally.net.room.last", 15, 'C has the result')
        last = await C.evaluate('window.__rally.net.room.last.rows')
        print('result', [(r['n'], r['t'], r['g']) for r in last])
        check([r['g'] for r in last] == [10, 8, 0] and last[2]['n'] == 'Charlie' and last[2]['t'] is None, '10 and 8 points, Charlie DNF')
        await A.wait_for_timeout(2600)
        print('A results table:', (await A.inner_text('#rNetTable')).replace('\n', ' | '))
        check('final' in (await A.inner_text('#rNetHead')).lower(), 'results say final')
        await A.screenshot(path=str(HERE / 'shot_online_results.png'))
        for pg, nm in ((A, 'A'), (B, 'B'), (C, 'C')): print(nm, 'received', await pg.evaluate('JSON.stringify(window.__rally.net.rx)'), 'reconnects', await pg.evaluate('window.__rally.net.drops'))
        board = await B.evaluate("JSON.parse(localStorage.getItem('sideways.board') || '[]').filter(e => e.n === 'Alpha').length")
        check(board >= 1, "Alpha's time went on Bravo's board")
        await A.click('#rMenu'); await B.click('#rMenu')
        await until(A, "window.__rally.mode === 'menu'", 5, 'A back in the lobby')
        # B reloads: back in the room as the same driver, with the points
        bid = await B.evaluate(ME); bpts = await B.evaluate(f"window.__rally.net.room.pts[{ME}].p")
        await B.reload(); await wait_menu(B)
        await until(B, "window.__rally.net.room && window.__rally.net.peers.size === 3", 12, 'B back in the room after a reload')
        check(await B.evaluate(ME) == bid and await B.evaluate(f"window.__rally.net.room.pts[{ME}].p") == bpts, f'same driver, {bpts} points kept')
        await A.wait_for_timeout(600)
        await A.screenshot(path=str(HERE / 'shot_online_lobby2.png'))
        # the host leaves: the next one in (B, who joined before C) takes over
        await A.evaluate('window.__rally.netLeave()')
        await until(B, f"window.__rally.net.room && window.__rally.net.room.h === {ME}", 15, 'B took over')
        check('start race' in (await B.inner_text('#startBtn')).lower(), 'B can start now')
        check(bool(await until(C, f"window.__rally.net.room.h === '{bid}'", 5, 'C follows the new host')), 'C follows the new host')
        for pg in (B, C): await pg.evaluate('window.__rally.netLeave()')
        await b.close()
    for l in logs[:30]: print(l)
    print('FAILED: ' + ', '.join(fails) if fails else 'all passed')
    sys.exit(1 if fails else 0)
asyncio.run(main())
