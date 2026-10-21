# Online rooms: the others' engines. Two browsers race in a room on the real Supabase Realtime server (every REST call
# blocked). B drives away while A waits on the line, B stops up the road, then A drives past B. Checks that each
# hears the other on the grid, that the voice stops once the other car is out of range and starts again as it comes
# back, levels from analysers on the master (before the compressor), on your own car's bus and on each rival's bus,
# and no errors. Also renders the engine worklet offline to see what a voice costs the audio thread.
# Usage: GPU=1 PW_CHANNEL=chrome python3 netaudio.py   (on a Mac)
import asyncio, json, os, pathlib, re, sys, time
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

async def page(b, name, car, logs):
    ctx = await b.new_context(viewport={'width': 960, 'height': 540})
    pg = await ctx.new_page()
    pg.on('console', lambda m: logs.append(f'{name} {m.type}: {m.text}') if m.type in ('error', 'warning') and 'ERR_FAILED' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append(f'{name} PAGEERROR: {e}'))
    await pg.add_init_script("localStorage.setItem('sideways.settings', JSON.stringify(%s))" % json.dumps({'stage': STAGE, 'car': car, 'voice': False, 'sound': True, 'ghost': False, 'shadows': True, 'cam': 0, 'name': name, 'v2': 1, 'boardSeeded': 1}))
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

# every 0.25 s: RMS and peak over the last ~0.34 s on the master, your car's bus and each rival voice's bus, and who
# has a voice at what distance
PROBE = """(() => {
  const R = window.__rally, A = R.audio().A, ctx = A.ctx, N = 16384, buf = new Float32Array(N);
  const mk = node => { const an = ctx.createAnalyser(); an.fftSize = N; node.connect(an); return an; };
  const meas = an => { an.getFloatTimeDomainData(buf); let s = 0, pk = 0; for (let i = 0; i < N; i++) { const x = buf[i]; s += x * x; if (x > pk) pk = x; else if (-x > pk) pk = -x; } return [Math.sqrt(s / N), pk]; };
  const master = mk(A.master), own = mk(A.carPan), an = new Map(), log = [];
  const tick = () => {
    const nv = A.nv || new Map(), net = R.net, c = R.car, row = { t: R.raceT, m: R.mode, st: ctx.state, master: meas(master), own: meas(own), v: [], o: [] };
    for (const [o, v] of nv) { let a = an.get(v); if (!a) { a = mk(v.pan); an.set(v, a); } row.v.push({ n: o.n, d: v.d, g: v.gk, end: v.end > 0, lvl: meas(a), wk: !!v.en, rpm: v.rpm, thr: v.thr, lag: v.lag, dop: v.dopp }); }
    if (net.race) for (const o of net.race.others.values()) if (o.pose.x !== undefined) row.o.push({ n: o.n, d: Math.hypot(o.pose.x - c.x, o.pose.z - c.z) });
    log.push(row);
  };
  setInterval(tick, 250);
  return { log };
})()"""

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
        for pg in (A, B): await until(pg, "window.__rally.net.room && window.__rally.net.peers.size === 2", 12, 'both see two drivers')
        await B.wait_for_timeout(2500)
        await A.click('#startBtn')
        for pg in (A, B): await until(pg, "window.__rally.mode === 'countdown' && !!window.__rally.audio().A.ctx", 25, 'countdown')
        for pg in (A, B): await pg.evaluate("window.__probe = " + PROBE)
        await until(A, "window.__rally.audio().A.nv && window.__rally.audio().A.nv.size === 1", 6, 'A hears B on the grid')
        await until(B, "window.__rally.audio().A.nv && window.__rally.audio().A.nv.size === 1", 6, 'B hears A on the grid')
        print('audio context', await A.evaluate('window.__rally.audio().A.ctx.state'), await A.evaluate('window.__rally.audio().A.ctx.sampleRate'))
        await B.evaluate('window.__rally.auto(true)')  # B goes; A waits on the line
        for pg in (A, B): await until(pg, "window.__rally.mode === 'race'", 25, 'racing')
        await until(A, "(() => { const nv = window.__rally.audio().A.nv; return nv.size === 0 })()", 30, "B's voice stops on A once B is out of range")
        t_out = await A.evaluate('window.__rally.raceT')
        await B.wait_for_timeout(2500)
        await B.evaluate("window.__rally.auto(false); Object.assign(window.__rally.keys, { KeyS: true })")  # B stops up the road
        await B.wait_for_timeout(3000)
        await B.evaluate("window.__rally.keys.KeyS = false")
        gap = await A.evaluate("Math.hypot(...(o => [o.pose.x - window.__rally.car.x, o.pose.z - window.__rally.car.z])([...window.__rally.net.race.others.values()][0]))")
        print(f"B out of A's range at {t_out:.1f} s; B parked {gap:.0f} m up the road")
        await A.evaluate('window.__rally.auto(true)')  # A drives up to B and past
        await until(A, "window.__rally.audio().A.nv.size === 1", 40, 'A hears B again as it comes up to it')
        await until(B, "window.__rally.audio().A.nv.size === 1", 10, 'B hears A coming')
        await until(A, "(() => { const o = [...window.__rally.net.race.others.values()][0], c = window.__rally.car; return Math.hypot(o.pose.x - c.x, o.pose.z - c.z) < 15 })()", 40, 'A reaches B')
        await A.screenshot(path=str(HERE / 'shot_netaudio_pass.png'))
        await until(B, "window.__rally.audio().A.nv.size === 0", 40, "A's voice stops on B once A is gone")
        await until(A, "window.__rally.audio().A.nv.size === 0", 10, "B's voice stops on A behind it")
        logA = await A.evaluate('window.__probe.log'); logB = await B.evaluate('window.__probe.log')
        # worklet nodes that were let go must have ended (none left running unheard)
        # cost: render 10 s of the engine + crunch worklets offline, 1 and 3 voices
        src = re.search(r'const AUDIO_WORKLET = `([\s\S]*?)`;', (HERE.parent / 'src' / 'game.js').read_text()).group(1)
        cost = await A.evaluate("""async src => {
          const url = 'data:application/javascript;base64,' + btoa(src), out = {};  // a blob URL can't load from file://
          for (const n of [0, 1, 3]) {
            const ctx = new OfflineAudioContext(1, 48000 * 10, 48000); await ctx.audioWorklet.addModule(url);
            for (let k = 0; k < n; k++) {
              const en = new AudioWorkletNode(ctx, 'engine', { numberOfInputs: 0, outputChannelCount: [1], processorOptions: { cyl: 4 } }), cr = new AudioWorkletNode(ctx, 'crunch', { numberOfInputs: 0, outputChannelCount: [1] });
              en.parameters.get('rpm').value = 6500; en.parameters.get('load').value = 1; cr.parameters.get('rate').value = 800;
              const g = ctx.createGain(); g.gain.value = 0.1; en.connect(g); cr.connect(g); g.connect(ctx.destination);
            }
            const t0 = performance.now(); await ctx.startRendering(); out[n] = performance.now() - t0;
          }
          return out;
        }""", src)
        await b.close()

    def summary(log, who):
        racing = [r for r in log if r['m'] in ('countdown', 'race')]
        mpk = max(r['master'][1] for r in racing); mrms = max(r['master'][0] for r in racing)
        own = [r['own'][0] for r in racing]
        riv = [(r['v'][0]['d'], r['v'][0]['lvl'][0], r['v'][0]['lvl'][1], r['own'][0]) for r in racing if r['v'] and not r['v'][0]['end']]
        print(f'{who}: master peak {mpk:.3f}, master RMS max {mrms:.3f}, own car RMS median {sorted(own)[len(own) // 2]:.3f}')
        for lo, hi in ((0, 10), (10, 30), (30, 60), (60, 120), (120, 140)):
            sel = [x for x in riv if lo <= x[0] < hi]
            if sel: print(f'   rival at {lo:>3}-{hi:<3} m: RMS {max(x[1] for x in sel):.4f} max / {sorted(x[1] for x in sel)[len(sel) // 2]:.4f} median, peak {max(x[2] for x in sel):.3f}  (own car RMS then {sorted(x[3] for x in sel)[len(sel) // 2]:.3f})  n={len(sel)}')
        # the voice follows the distance: on whenever the other is close, off whenever it's far
        bad_on = [r['t'] for r in racing if r['o'] and r['o'][0]['d'] > 160 and r['v'] and not r['v'][0]['end']]
        bad_off = [r['t'] for r in racing if r['o'] and r['o'][0]['d'] < 100 and not r['v']]
        check(not bad_on, f'{who}: no voice while the other is over 160 m away ({len(bad_on)} samples)')
        check(len(bad_off) <= 2, f'{who}: a voice whenever the other is under 100 m ({len(bad_off)} samples without)')
        check(mpk < 1, f'{who}: no clipping on the master (peak {mpk:.3f})')
        # a rival flat out next to your idling car can be louder for a moment (as it would be); over each distance band
        # it sits under your car
        med = lambda xs: sorted(xs)[len(xs) // 2]
        bands = [[x for x in riv if lo <= x[0] < hi] for lo, hi in ((0, 10), (10, 30), (30, 60), (60, 140))]
        check(all(med([x[1] for x in sel]) < med([x[3] for x in sel]) for sel in bands if sel), f'{who}: rival quieter than your own car (median per distance band)')
        check(all(v['wk'] for r in racing for v in r['v']), f'{who}: rival voices use the engine worklet')
        return riv
    summary(logA, 'A'); summary(logB, 'B')
    # B's ears while A comes up from behind and drives past: distance, rpm and throttle heard, how far behind the
    # samples the engine plays, Doppler, bus gain
    pas = [r for r in logB if r['m'] == 'race' and r['v'] and not r['v'][0]['end']]
    print('B hears A go by (t, m, rpm, thr, lag s, doppler, gain):')
    for r in pas[-40::2]:
        v = r['v'][0]; print(f"   {r['t']:6.2f} {v['d']:6.1f} {v['rpm']:6.0f} {v['thr']:.2f} {v['lag']:.2f} {v['dop']:.3f} {v['g']:.3f}")
    print('offline render of 10 s (ms): ' + ', '.join(f'{k} voices {v:.0f}' for k, v in cost.items()), f'-> one voice ~{(cost["3"] - cost["0"]) / 3 / 100:.2f} % of one core')
    for l in logs[:30]: print(l)
    check(not any('PAGEERROR' in l or ' error:' in l for l in logs), 'no errors')
    print('FAILED: ' + ', '.join(fails) if fails else 'all passed')
    sys.exit(1 if fails else 0)
asyncio.run(main())
