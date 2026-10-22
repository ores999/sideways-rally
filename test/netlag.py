# Online rooms: how far from where they really are the others are drawn. Two browsers race in a room on the real
# Supabase Realtime server (every REST call blocked), the AI drives both, and each page records every frame (net.trace):
# the wall clock, its own car and where it draws the other. Both pages run on this machine, so they share the wall
# clock and the true position of each car at any instant is known: the error is exact, not estimated.
# Reports the error (median, p90, p99, max), how old the newest sample was when it was drawn, how the link went
# (direct or through the server), the clock offset and how far apart the green lights were, and the messages sent
# through the server.
# Usage: GPU=1 PW_CHANNEL=chrome python3 netlag.py
#   P2P=0     everything through the Supabase server (as before direct links)
#   LAG=20    adds 20 ms each way to the direct link (two homes in the same city are ~5-25 ms apart; here it's ~0)
#   SECS=30   how long to record
#   CONTACT=1 lets the cars hit each other (both AIs take the same line and bump; by default both are ghosts, so the
#             numbers are the network and the prediction alone)
import asyncio, json, math, os, pathlib, sys
from playwright.async_api import async_playwright
HERE = pathlib.Path(__file__).resolve().parent
PAGE = (HERE.parent / 'dist' / 'test.html').as_uri()
CHANNEL = os.environ.get('PW_CHANNEL')
ARGS = ['--use-angle=metal', '--ignore-gpu-blocklist'] if os.environ.get('GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
ARGS += ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
STAGE = int(os.environ.get('STAGE', '0'))
P2P = os.environ.get('P2P', '1') != '0'
LAG = float(os.environ.get('LAG', '0'))
SECS = float(os.environ.get('SECS', '30'))
CONTACT = os.environ.get('CONTACT') == '1'
fails = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what, flush=True)
    if not ok: fails.append(what)

async def wait_menu(pg):
    for _ in range(160):
        await pg.wait_for_timeout(250)
        if await pg.evaluate('window.__rally && window.__rally.mode') == 'menu': return

async def page(b, name, car, logs):
    ctx = await b.new_context(viewport={'width': 960, 'height': 540})
    pg = await ctx.new_page()
    pg.on('console', lambda m: logs.append(f'{name} {m.type}: {m.text}') if m.type in ('error', 'warning') and 'ERR_FAILED' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append(f'{name} PAGEERROR: {e}'))
    await pg.add_init_script("localStorage.setItem('sideways.settings', JSON.stringify(%s))" % json.dumps({'stage': STAGE, 'car': car, 'voice': False, 'sound': False, 'ghost': False, 'shadows': True, 'cam': 0, 'name': name, 'v2': 1, 'boardSeeded': 1}))
    if not P2P: await pg.add_init_script('window.__noP2P = true')
    await pg.route('**/rest/v1/**', lambda r: r.abort())  # never touch the real leaderboard
    await pg.goto(PAGE)
    await wait_menu(pg)
    return pg

async def until(pg, js, secs, what):
    for _ in range(int(secs * 4)):
        v = await pg.evaluate(js)
        if v: return v
        await pg.wait_for_timeout(250)
    check(False, 'timed out: ' + what)
    return None

def q(a, p): a = sorted(a); return a[min(len(a) - 1, int(p * len(a)))]
def stats(a, unit, f=2): return f"p50 {q(a, .5):.{f}f}  p90 {q(a, .9):.{f}f}  p99 {q(a, .99):.{f}f}  max {max(a):.{f}f} {unit}  (n {len(a)})"

# where the car on trace T (rows [t, x, z, ...]) was at wall time t
def at(T, t, i):
    lo, hi = 0, len(T) - 1
    if t < T[0][0] or t > T[-1][0]: return None
    while hi - lo > 1:
        m = (lo + hi) // 2
        if T[m][0] <= t: lo = m
        else: hi = m
    a, b = T[lo], T[hi]; u = 0 if b[0] == a[0] else (t - a[0]) / (b[0] - a[0])
    return (a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u)

def compare(own, other, name):
    err, age = [], []
    for r in other:
        for o in r[3]:
            if o[0] != name: continue
            p = at(own, r[0], 1)
            if p is None: continue
            err.append(math.hypot(o[1] - p[0], o[2] - p[1])); age.append(o[3] * 1000)
    return err, age

async def main():
    logs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(channel=CHANNEL, args=ARGS)
        A = await page(b, 'Alpha', 1, logs)
        B = await page(b, 'Bravo', 4, logs)
        await A.click('#tabOnline'); await A.click('#netCreate')
        code = await until(A, "window.__rally.net.status === 'online' && window.__rally.net.code", 10, 'A online')
        await B.click('#tabOnline'); await B.fill('#netCode', code.lower()); await B.click('#netJoinBtn')
        for pg in (A, B): await until(pg, "window.__rally.net.room && window.__rally.net.peers.size === 2", 12, 'both see two drivers')
        if P2P:
            ok = await until(B, "window.__rally.net.ch.linked && [...window.__rally.net.peers.keys()].some(i => window.__rally.net.ch.linked(i))", 15, 'direct link')
            check(bool(ok), 'direct link between the two browsers')
            if LAG: await B.evaluate(f'window.__rally.net.ch.lag = {LAG}'); await A.evaluate(f'window.__rally.net.ch.lag = {LAG}')
        await B.wait_for_timeout(2500)  # B builds the stage in the background
        await A.click('#startBtn')
        for pg in (A, B): await until(pg, "window.__rally.mode === 'countdown'", 25, 'countdown')
        for pg in (A, B): await pg.evaluate('window.__rally.auto(true)')
        for pg in (A, B): await until(pg, "window.__rally.mode === 'race'", 25, 'racing')
        if not CONTACT:
            for pg in (A, B): await pg.evaluate('window.__rally.car.ghostT = 1e9')
        g = [await pg.evaluate('window.__rally.net.race.greenL') for pg in (A, B)]
        print(f"green lights {abs(g[0] - g[1]):.1f} ms apart; B's clock: offset {await B.evaluate('window.__rally.net.off'):.1f} ms, round trip {await B.evaluate('window.__rally.net.rtt'):.1f} ms")
        rx0 = [await pg.evaluate('JSON.stringify(window.__rally.net.rx)') for pg in (A, B)]
        await A.wait_for_timeout(3000)  # off the line
        for pg in (A, B): await pg.evaluate('window.__rally.net.trace = []')
        await A.wait_for_timeout(SECS * 1000)
        TA, TB = [await pg.evaluate('(() => { const t = window.__rally.net.trace; window.__rally.net.trace = null; return t })()') for pg in (A, B)]
        rx = [await pg.evaluate('JSON.stringify(window.__rally.net.rx)') for pg in (A, B)]
        ws = [await pg.evaluate('JSON.stringify(window.__rally.net.ch.tx || {})') for pg in (A, B)]
        if os.environ.get('DUMP'): json.dump({'A': TA, 'B': TB}, open(os.environ['DUMP'], 'w'))
        eB, aB = compare(TA, TB, 'Alpha')
        eA, aA = compare(TB, TA, 'Bravo')
        mode = ('' if CONTACT else 'ghosts, ') + ('direct' + (f' +{LAG:.0f} ms each way' if LAG else '')) if P2P else 'through the server'
        print(f'--- {mode}, {SECS:.0f} s, AI driving ---')
        print('B draws A off by   ', stats(eB, 'm'))
        print('A draws B off by   ', stats(eA, 'm'))
        print('newest sample age  ', stats(aB + aA, 'ms', 0))
        print('frames per second   A %.0f  B %.0f' % (len(TA) / SECS, len(TB) / SECS))
        print('received A', rx[0], '\n         B', rx[1])
        print('sent through the server A', ws[0], ' B', ws[1])
        check(len(eA) > SECS * 20 and len(eB) > SECS * 20, 'enough frames compared')
        check(q(eA + eB, .99) < 6, 'p99 error under 6 m')
        for pg in (A, B): await pg.evaluate('window.__rally.netLeave()')
        await b.close()
    for l in logs[:30]: print(l)
    print('FAILED: ' + ', '.join(fails) if fails else 'all passed')
    sys.exit(1 if fails else 0)
asyncio.run(main())
