// ===================== NET: live rooms over Supabase Realtime =====================
// A small client for the Phoenix channel protocol that Supabase Realtime speaks over a WebSocket, for one room at a
// time: broadcast messages (JSON, delivered to every other member, not back to the sender) and presence (who is in
// the room, dropped by the server the moment a socket closes). No library. It reconnects on its own with a backoff
// and joins again; the game asks for the room state again when it does.
// Supabase counts each broadcast once sent plus once per member that receives it, against a free-plan limit of
// 100 messages a second for the whole project, so callers keep their rates down (see the online section in game.js).
// Direct links: on top of that, each pair of members opens a WebRTC data channel between their browsers (peer to peer,
// unordered and never resent, like UDP: a late sample is no use). The server only carries the handshake: an offer and
// an answer with every ICE candidate already in them (two messages a pair), and public STUN servers tell each browser
// its address outside its router. A direct link skips the trip through the server (from Buenos Aires to São Paulo and
// back: ~55 ms median and 130-200 ms spikes over TCP, measured) and its message quota. Two networks that can't reach each
// other without a relay (both behind carrier-grade NAT, some office firewalls) keep going through the server.
const NET = (() => {
'use strict';
const P2P = typeof RTCPeerConnection === 'function';
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
const now = () => performance.now();
function room(cfg) {
  // cfg: { url, key, topic, me, meta, p2p, onMsg(event, payload, link), onPresence(members), onStatus(status), onLink(id, open) }
  // onMsg's link is the sender's id when it came over a direct link, '' through the server
  const topic = 'realtime:' + cfg.topic;
  const url = cfg.url.replace(/^http/, 'ws').replace(/\/$/, '') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(cfg.key) + '&vsn=1.0.0';
  let ws = null, ref = 0, joinRef = null, hbT = 0, hbWait = null, retry = 0, retryT = 0, closed = false, meta = cfg.meta;
  let pgT = 0, pgRef = null, pgAt = 0; // the round trip to the server, timed on a heartbeat of its own every 2 s
  let pres = {}; // presence key -> metas
  // tx: broadcasts sent, by event; lag: test hook, ms added to every direct message received; srv: round trip to the server (ms)
  const self = { status: 'connecting', joined: false, tx: {}, lag: 0, srv: 0 };
  const status = s => { if (self.status === s) return; self.status = s; if (cfg.onStatus) cfg.onStatus(s); };
  const out = (o) => { if (!ws || ws.readyState !== 1) return false; try { ws.send(JSON.stringify(o)); return true; } catch (e) { return false; } };
  const push = (event, payload) => out({ topic, event, payload, ref: String(++ref), join_ref: joinRef });
  const cast = (event, payload) => { self.tx[event] = (self.tx[event] || 0) + 1; return push('broadcast', { type: 'broadcast', event, payload }); };
  function members() {
    const list = [];
    for (const k in pres) { const m = pres[k]; if (m.length) list.push(Object.assign({}, m[m.length - 1], { key: k })); }
    return list;
  }
  function presenceChanged() { if (cfg.onPresence) cfg.onPresence(members()); }
  function applyDiff(d) {
    for (const k in d.joins || {}) {
      const have = pres[k] || [], refs = new Set(have.map(m => m.phx_ref));
      pres[k] = have.concat((d.joins[k].metas || []).filter(m => !refs.has(m.phx_ref)));
    }
    for (const k in d.leaves || {}) {
      const gone = new Set((d.leaves[k].metas || []).map(m => m.phx_ref));
      const left = (pres[k] || []).filter(m => !gone.has(m.phx_ref));
      if (left.length) pres[k] = left; else delete pres[k];
    }
  }
  function handle(m) {
    if (m.topic === 'phoenix') {
      if (m.event !== 'phx_reply') return;
      if (m.ref === hbWait) hbWait = null;
      else if (m.ref === pgRef) { const r = now() - pgAt; pgRef = null; if (r >= 0 && r < 5000) self.srv = self.srv ? self.srv + (r - self.srv) * 0.25 : r; }
      return;
    }
    if (m.topic !== topic) return;
    if (m.event === 'phx_reply' && m.ref === joinRef) {
      if (m.payload && m.payload.status === 'ok') {
        self.joined = true; retry = 0; status('online'); srvPing();
        if (meta) push('presence', { type: 'presence', event: 'track', payload: meta });
      } else { status('error'); drop(); }
      return;
    }
    if (m.event === 'broadcast' && m.payload) {
      if (m.payload.event === 'rtc') rtcMsg(m.payload.payload);
      else if (cfg.onMsg) cfg.onMsg(m.payload.event, m.payload.payload || {}, '');
      return;
    }
    if (m.event === 'presence_state') { pres = {}; for (const k in m.payload || {}) pres[k] = (m.payload[k].metas || []).slice(); presenceChanged(); return; }
    if (m.event === 'presence_diff') { applyDiff(m.payload || {}); presenceChanged(); return; }
    if (m.event === 'phx_error' || m.event === 'phx_close') { drop(); return; }
  }
  function heartbeat() {
    // no reply to the last one: the socket is dead even if the browser hasn't noticed
    if (hbWait) { drop(); return; }
    hbWait = String(++ref);
    out({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: hbWait });
  }
  // heartbeats aren't broadcasts: they don't count against the project's message quota
  function srvPing() {
    if (!self.joined || pgRef) { pgRef = null; return; } // no reply in 2 s: lost, try again next time
    pgRef = String(++ref); pgAt = now();
    out({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: pgRef });
  }
  function open() {
    if (closed) return;
    status(retry ? 'reconnecting' : 'connecting');
    try { ws = new WebSocket(url); } catch (e) { later(); return; }
    const me = ws;
    ws.onopen = () => {
      joinRef = String(++ref); hbWait = null;
      out({ topic, event: 'phx_join', payload: { config: { broadcast: { self: false, ack: false }, presence: { key: cfg.me, enabled: true }, private: false } }, ref: joinRef, join_ref: joinRef });
      clearInterval(hbT); hbT = setInterval(heartbeat, 25000);
      clearInterval(pgT); pgT = setInterval(srvPing, 2000); pgRef = null;
    };
    ws.onmessage = e => { if (ws !== me) return; let m; try { m = JSON.parse(e.data); } catch (err) { return; } handle(m); };
    ws.onclose = () => { if (ws !== me) return; ws = null; clearInterval(hbT); clearInterval(pgT); self.joined = false; if (!closed) later(); };
    ws.onerror = () => {};
  }
  function drop() { const w = ws; ws = null; clearInterval(hbT); clearInterval(pgT); self.joined = false; if (w) { try { w.close(); } catch (e) { /* closed */ } } if (!closed) later(); }
  function later() {
    if (closed || retryT) return;
    status('reconnecting'); // presence stays as it was until the server sends it again on the next join
    const wait = Math.min(10000, 800 * Math.pow(2, retry++)) * (0.8 + Math.random() * 0.4);
    retryT = setTimeout(() => { retryT = 0; open(); }, wait);
  }
  // ---- direct links ----
  // id -> { id, want, pc, dc, open, rx (last heard), rtt, n (this handshake), tries, next (retry at), until (give up at) }
  const links = new Map(), lkT = P2P && cfg.p2p ? setInterval(linkTick, 500) : 0;
  const usable = L => !!(L && L.open && L.dc.readyState === 'open' && now() - L.rx < 3000);
  const dsend = (L, s) => { try { L.dc.send(s); return true; } catch (e) { return false; } };
  function linkOf(id) {
    let L = links.get(id);
    if (!L) { L = { id, want: false, pc: null, dc: null, open: false, rx: 0, rtt: 0, n: '', tries: 0, next: 0, until: 0 }; links.set(id, L); }
    return L;
  }
  function shut(L) {
    const pc = L.pc, was = L.open;
    L.pc = L.dc = null; L.open = false;
    if (pc) { try { pc.close(); } catch (e) { /* closed */ } }
    if (was && cfg.onLink) cfg.onLink(L.id, false);
  }
  function fail(L) { shut(L); L.tries++; L.next = now() + Math.min(60000, 1000 * Math.pow(2, L.tries)); }
  function newPc(L) {
    shut(L);
    let pc, dc;
    try { pc = new RTCPeerConnection({ iceServers: ICE }); dc = pc.createDataChannel('race', { negotiated: true, id: 0, ordered: false, maxRetransmits: 0 }); }
    catch (e) { L.tries = 99; return null; } // WebRTC switched off (a policy, an extension): the server carries everything
    L.pc = pc; L.dc = dc; L.until = now() + 12000;
    dc.onopen = () => { if (L.pc !== pc) return; L.open = true; L.rx = now(); L.tries = 0; if (cfg.onLink) cfg.onLink(L.id, true); };
    dc.onclose = () => { if (L.pc === pc) fail(L); };
    dc.onmessage = e => { if (L.pc !== pc) return; L.rx = now(); if (self.lag) setTimeout(() => linkMsg(L, e.data), self.lag); else linkMsg(L, e.data); };
    pc.onconnectionstatechange = () => { if (L.pc === pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) fail(L); };
    return pc;
  }
  // every candidate goes in the offer or answer, so it waits for the gathering (a STUN answer takes ~30-100 ms)
  const gathered = pc => new Promise(res => {
    if (pc.iceGatheringState === 'complete') { res(); return; }
    const t = setTimeout(res, 2000);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
  });
  const signal = (to, o) => self.joined && cast('rtc', Object.assign({ f: cfg.me, to }, o));
  // the member with the lower id offers, so two offers never cross
  async function offer(L) {
    const pc = newPc(L), n = Math.random().toString(36).slice(2, 10);
    if (!pc) return;
    L.n = n;
    try {
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      if (L.pc === pc) signal(L.id, { k: 'o', n, d: pc.localDescription.sdp });
    } catch (e) { if (L.pc === pc) fail(L); }
  }
  async function answer(p) {
    const L = linkOf(p.f), pc = newPc(L);
    if (!pc) return;
    L.n = p.n;
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp: p.d });
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      if (L.pc === pc) signal(p.f, { k: 'a', n: p.n, d: pc.localDescription.sdp });
    } catch (e) { if (L.pc === pc) shut(L); }
  }
  function rtcMsg(p) {
    if (!lkT || closed || !p || p.to !== cfg.me || typeof p.f !== 'string' || p.f === cfg.me || typeof p.n !== 'string' || typeof p.d !== 'string' || p.d.length > 20000) return;
    if (p.k === 'o' && p.f < cfg.me) answer(p);
    else if (p.k === 'a') {
      const L = links.get(p.f);
      if (L && L.pc && L.n === p.n && L.pc.signalingState === 'have-local-offer') { const pc = L.pc; pc.setRemoteDescription({ type: 'answer', sdp: p.d }).catch(() => { if (L.pc === pc) fail(L); }); }
    }
  }
  function linkMsg(L, data) {
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (typeof m.k === 'number') { dsend(L, '{"K":' + m.k + '}'); return; } // keepalive: sent straight back
    if (typeof m.K === 'number') { const r = now() - m.K; if (r >= 0 && r < 5000) L.rtt = L.rtt ? L.rtt + (r - L.rtt) * 0.25 : r; return; }
    if (typeof m.e === 'string' && m.p && m.p.f === L.id && cfg.onMsg) cfg.onMsg(m.e, m.p, L.id);
  }
  // twice a second: keepalives (and the round trip) on open links, a link silent for 3 s is gone (a reload, a new
  // network), a handshake not done in 12 s is dropped, and the offering side tries again after 2, 4, 8 ... 60 s
  function linkTick() {
    const t = now();
    for (const L of links.values()) {
      if (L.open) { if (t - L.rx > 3000) fail(L); else dsend(L, '{"k":' + t.toFixed(1) + '}'); }
      else if (L.pc) { if (t > L.until) fail(L); }
      else if (L.want && cfg.me < L.id && self.joined && t >= L.next && L.tries < 8) offer(L);
    }
  }
  self.link = id => { if (lkT && id !== cfg.me) linkOf(id).want = true; };
  self.unlink = id => { const L = links.get(id); if (L) { shut(L); links.delete(id); } };
  self.links = () => [...links.keys()];
  self.linked = id => usable(links.get(id));
  self.anyLinked = () => { for (const L of links.values()) if (usable(L)) return true; return false; };
  self.rtt = id => { const L = links.get(id); return usable(L) ? L.rtt : 0; };
  // to one member over its direct link (false when there is none)
  self.direct = (id, event, payload) => { const L = links.get(id); return usable(L) && dsend(L, JSON.stringify({ e: event, p: payload })); };
  // to every member with a direct link
  self.fast = (event, payload) => {
    let s = null, n = 0;
    for (const L of links.values()) if (usable(L)) { if (!s) s = JSON.stringify({ e: event, p: payload }); if (dsend(L, s)) n++; }
    return n;
  };
  self.send = (event, payload) => self.joined && cast(event, payload);
  self.track = m => { meta = m; if (self.joined) push('presence', { type: 'presence', event: 'track', payload: m }); };
  self.members = members;
  self.leave = () => {
    if (closed) return; closed = true; clearTimeout(retryT); clearInterval(hbT); clearInterval(pgT); clearInterval(lkT);
    for (const L of links.values()) shut(L);
    links.clear();
    if (self.joined) push('phx_leave', {});
    const w = ws; ws = null; self.joined = false;
    if (w) setTimeout(() => { try { w.close(); } catch (e) { /* closed */ } }, 120);
    status('off');
  };
  open();
  return self;
}
return { room, p2p: P2P };
})();
if (typeof module !== 'undefined') module.exports = NET;
