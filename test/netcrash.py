# Online rooms: the cars hit each other. Two browsers race in a room on the real Supabase Realtime server (every REST
# call blocked). Both start on the AI side by side (the AIs merge onto the same line), then B parks in the road and A
# comes through flat out and hits it. Each browser records its own car (the truth) every frame on the shared race clock;
# carhit_true.js lines the two traces up and measures how deep and how long the real cars overlapped, and what each
# side felt (impulses, 'hit' messages). Screenshots at the moment of the crash.
# Usage: GPU=1 PW_CHANNEL=chrome python3 netcrash.py
import asyncio, json, os, pathlib, subprocess, sys
from playwright.async_api import async_playwright
HERE = pathlib.Path(__file__).resolve().parent
PAGE = (HERE.parent / 'dist' / 'test.html').as_uri()
CHANNEL = os.environ.get('PW_CHANNEL')
ARGS = ['--use-angle=metal', '--ignore-gpu-blocklist'] if os.environ.get('GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
ARGS += ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
STAGE = int(os.environ.get('STAGE', '0'))
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

# every frame: the own car on the race clock, what this frame's contact did, and how the other is seen
TRACE = """(() => {
  const R = window.__rally, log = [], net = R.net;
  const f = () => {
    const nr = net.race, c = R.car;
    if (nr && nr.greenL && R.mode === 'race') {
      const o = [...nr.others.values()][0], e = R.dbg.evt, wt = (performance.timeOrigin + performance.now() - nr.greenL) / 1000;
      log.push([wt, c.x, c.z, c.h, Math.hypot(c.vx, c.vz), c.w, e.kind === 'car' ? e.hit : 0, o ? (o.kick ? 1 : 0) | (o.thru ? 2 : 0) | (o.soft ? 4 : 0) : 0, o && o.pose.x != null ? Math.hypot(o.pose.x - c.x, o.pose.z - c.z) : -1]);
    }
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
  return { log };
})()"""

async def main():
    logs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(channel=CHANNEL, args=ARGS)
        A = await page(b, 'Alpha', 0, logs)
        B = await page(b, 'Bravo', 2, logs)
        for pg in (A, B):  # count 'hit' messages sent
            # (through the server or over the direct link)
            await pg.evaluate("(() => { const n = window.__rally.net; window.__hits = []; const iv = setInterval(() => { if (n.ch && !n.ch.__w) { const s = n.ch.send.bind(n.ch), d = n.ch.direct.bind(n.ch); n.ch.send = (ev, p) => { if (ev === 'hit') window.__hits.push(p); return s(ev, p); }; n.ch.direct = (id, ev, p) => { const ok = d(id, ev, p); if (ok && ev === 'hit') window.__hits.push(p); return ok; }; n.ch.__w = 1; } }, 100); })()")
        await A.click('#tabOnline'); await A.click('#netCreate')
        code = await until(A, "window.__rally.net.status === 'online' && window.__rally.net.code", 10, 'A online')
        print('room', code)
        await B.click('#tabOnline'); await B.fill('#netCode', code.lower()); await B.click('#netJoinBtn')
        for pg in (A, B): await until(pg, "window.__rally.net.room && window.__rally.net.peers.size === 2", 12, 'both see two drivers')
        await B.wait_for_timeout(2500)
        await A.click('#startBtn')
        for pg in (A, B): await until(pg, "window.__rally.mode === 'countdown'", 25, 'countdown')
        for pg in (A, B): await pg.evaluate("window.__tr = " + TRACE)
        # part 1: side by side off the line, both on the AI (it doesn't see the other car: they merge onto the same line)
        for pg in (A, B): await pg.evaluate('window.__rally.auto(true)')
        for pg in (A, B): await until(pg, "window.__rally.mode === 'race'", 25, 'racing')
        await A.wait_for_timeout(9000)
        # part 2: A stops while B gets away, then B parks square across A's AI line, where A will come through flat out
        STOP = "(() => { const R = window.__rally; R.auto(false); R.keys.KeyS = true; const iv = setInterval(() => { if (Math.hypot(R.car.vx, R.car.vz) < 1) { R.keys.KeyS = false; R.keys.Space = true; clearInterval(iv); } }, 30); })()"
        await A.evaluate(STOP)
        far = "(() => { const o = [...window.__rally.net.race.others.values()][0], c = window.__rally.car; return o.pose.x != null && Math.hypot(o.pose.x - c.x, o.pose.z - c.z) > %s })()"
        await until(A, far % 160, 30, 'B gets away')
        moved = await B.evaluate("""(() => {
          const R = window.__rally, C = RallyCore, c = R.car, W = R.W, off = C.prepAI(W, C.CARS[%d], 0.86).off;
          R.auto(false); R.keys.Space = true;
          C.locate(W.T, c); const d = off[c.idx] - c.lat; c.x += c.rd.rx * d; c.z += c.rd.rz * d; c.h = C.sampleAt(W.T, c.s).h + 0.5; c.vx = c.vz = c.w = 0;
          C.locate(W.T, c); return [off[c.idx], c.lat];
        })()""" % 0)
        print("B parked on A's line (target lat, lat):", moved)
        await B.wait_for_timeout(1500)
        await A.evaluate("window.__rally.keys.Space = false")
        gap = await A.evaluate("Math.hypot(...(o => [o.pose.x - window.__rally.car.x, o.pose.z - window.__rally.car.z])([...window.__rally.net.race.others.values()][0]))")
        print(f'B parked {gap:.0f} m up the road')
        await A.evaluate('window.__rally.auto(true)')
        near = "(() => { const o = [...window.__rally.net.race.others.values()][0], c = window.__rally.car; return Math.hypot(o.pose.x - c.x, o.pose.z - c.z) < %s })()"
        await until(A, near % 9, 60, 'A reaches B')
        await A.wait_for_timeout(120)
        await A.screenshot(path=str(HERE / 'shot_netcrash_A.png')); await B.screenshot(path=str(HERE / 'shot_netcrash_B.png'))
        await A.wait_for_timeout(4000)
        await A.screenshot(path=str(HERE / 'shot_netcrash_A2.png'))
        trA = await A.evaluate('window.__tr.log'); trB = await B.evaluate('window.__tr.log')
        hitsA = await A.evaluate('window.__hits'); hitsB = await B.evaluate('window.__hits')
        cars = [await pg.evaluate("window.__rally.settings.car") for pg in (A, B)]
        await b.close()
    out = HERE / 'netcrash_trace.json'
    out.write_text(json.dumps({ 'cars': cars, 'A': trA, 'B': trB }))
    print(f'traces: A {len(trA)} frames, B {len(trB)} frames; hit messages sent A {len(hitsA)}, B {len(hitsB)}')
    res = json.loads(subprocess.run(['node', str(HERE / 'carhit_true.js'), str(out)], capture_output=True, text=True, check=True).stdout)
    for k, v in res.items(): print(f'   {k}: {v}')
    check(res['contacts'] > 0, 'the cars touched')
    check(res['felt'][0] > 0 and res['felt'][1] > 0, 'both sides felt it')
    check(res['overlapMax'] < 0.9, f"real overlap stays under 0.9 m (max {res['overlapMax']:.2f})")
    check(res['overlapLong'] < 0.5, f"never more than 0.1 m in for half a second (longest {res['overlapLong']:.2f} s)")
    check(max(res['hardest']) > 6, f"a real hit: the parked car was hit at {max(res['hardest']):.1f} m/s")
    check(res['yawMax'] < 9, f"no wild spins (max yaw {res['yawMax']:.1f} rad/s)")
    for l in logs[:30]: print(l)
    check(not any('PAGEERROR' in l or ' error:' in l for l in logs), 'no errors')
    print('FAILED: ' + ', '.join(fails) if fails else 'all passed')
    sys.exit(1 if fails else 0)
asyncio.run(main())
