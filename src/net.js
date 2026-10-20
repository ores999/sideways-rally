// ===================== NET: live rooms over Supabase Realtime =====================
// A small client for the Phoenix channel protocol that Supabase Realtime speaks over a WebSocket, for one room at a
// time: broadcast messages (JSON, delivered to every other member, not back to the sender) and presence (who is in
// the room, dropped by the server the moment a socket closes). No library. It reconnects on its own with a backoff
// and joins again; the game asks for the room state again when it does.
// Supabase counts each broadcast once sent plus once per member that receives it, against a free-plan limit of
// 100 messages a second for the whole project, so callers keep their rates down (see the online section in game.js).
const NET = (() => {
'use strict';
function room(cfg) {
  // cfg: { url, key, topic, me, meta, onMsg(event, payload), onPresence(members), onStatus(status) }
  const topic = 'realtime:' + cfg.topic;
  const url = cfg.url.replace(/^http/, 'ws').replace(/\/$/, '') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(cfg.key) + '&vsn=1.0.0';
  let ws = null, ref = 0, joinRef = null, hbT = 0, hbWait = null, retry = 0, retryT = 0, closed = false, meta = cfg.meta;
  let pres = {}; // presence key -> metas
  const self = { status: 'connecting', joined: false };
  const status = s => { if (self.status === s) return; self.status = s; if (cfg.onStatus) cfg.onStatus(s); };
  const out = (o) => { if (!ws || ws.readyState !== 1) return false; try { ws.send(JSON.stringify(o)); return true; } catch (e) { return false; } };
  const push = (event, payload) => out({ topic, event, payload, ref: String(++ref), join_ref: joinRef });
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
    if (m.topic === 'phoenix') { if (m.event === 'phx_reply' && m.ref === hbWait) hbWait = null; return; }
    if (m.topic !== topic) return;
    if (m.event === 'phx_reply' && m.ref === joinRef) {
      if (m.payload && m.payload.status === 'ok') {
        self.joined = true; retry = 0; status('online');
        if (meta) push('presence', { type: 'presence', event: 'track', payload: meta });
      } else { status('error'); drop(); }
      return;
    }
    if (m.event === 'broadcast' && m.payload) { if (cfg.onMsg) cfg.onMsg(m.payload.event, m.payload.payload || {}); return; }
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
  function open() {
    if (closed) return;
    status(retry ? 'reconnecting' : 'connecting');
    try { ws = new WebSocket(url); } catch (e) { later(); return; }
    const me = ws;
    ws.onopen = () => {
      joinRef = String(++ref); hbWait = null;
      out({ topic, event: 'phx_join', payload: { config: { broadcast: { self: false, ack: false }, presence: { key: cfg.me, enabled: true }, private: false } }, ref: joinRef, join_ref: joinRef });
      clearInterval(hbT); hbT = setInterval(heartbeat, 25000);
    };
    ws.onmessage = e => { if (ws !== me) return; let m; try { m = JSON.parse(e.data); } catch (err) { return; } handle(m); };
    ws.onclose = () => { if (ws !== me) return; ws = null; clearInterval(hbT); self.joined = false; if (!closed) later(); };
    ws.onerror = () => {};
  }
  function drop() { const w = ws; ws = null; clearInterval(hbT); self.joined = false; if (w) { try { w.close(); } catch (e) { /* closed */ } } if (!closed) later(); }
  function later() {
    if (closed || retryT) return;
    status('reconnecting'); // presence stays as it was until the server sends it again on the next join
    const wait = Math.min(10000, 800 * Math.pow(2, retry++)) * (0.8 + Math.random() * 0.4);
    retryT = setTimeout(() => { retryT = 0; open(); }, wait);
  }
  self.send = (event, payload) => self.joined && push('broadcast', { type: 'broadcast', event, payload });
  self.track = m => { meta = m; if (self.joined) push('presence', { type: 'presence', event: 'track', payload: m }); };
  self.members = members;
  self.leave = () => {
    if (closed) return; closed = true; clearTimeout(retryT); clearInterval(hbT);
    if (self.joined) push('phx_leave', {});
    const w = ws; ws = null; self.joined = false;
    if (w) setTimeout(() => { try { w.close(); } catch (e) { /* closed */ } }, 120);
    status('off');
  };
  open();
  return self;
}
return { room };
})();
if (typeof module !== 'undefined') module.exports = NET;
