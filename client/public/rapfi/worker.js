/**
 * Rapfi WASM 引擎 Worker
 *
 * 引擎本体是 Rapfi（Gomocup 世界排名第一的开源五子棋引擎）的 Emscripten 编译产物，
 * 使用 NNUE 神经网络评估。跑在 Worker 里，主线程不卡。
 *
 * ── 坐标约定（实测确定，别凭感觉改）─────────────────────────────
 * 应用内棋盘是 board[r * 15 + c]，r=行(0 在上)，c=列(0 在左)。
 * Piskvork 协议的 BOARD 行是 "x,y,who"，其中 x=列、y=行。
 * 所以：发送时 board[r][c] → "c,r,who"；引擎回复 "x,y" → row=y, col=x。
 * 这两个方向必须严格成对，只改一边就会出现「棋盘镜像」。
 *
 * ── 注意 ────────────────────────────────────────────────────
 * 胶水层用 self.location.href 推导资源基路径，所以本文件必须通过真实 URL 加载，
 * 不能用 Blob URL 包一层；同时 .data（10MB 权重）是通过 fetch 下载的，
 * 因此必须跑在 http(s) 下，file:// 会失败并由主线程侧降级。
 */
'use strict';

var SIZE = 15;

/** 引擎返回的落子，等待中的请求（同一时刻只允许一个） */
var pending = null;
var engine = null;
var ready = false;
var fatal = false;

function post(msg) {
  try { self.postMessage(msg); } catch (e) {}
}

function fail(stage, err) {
  fatal = true;
  post({ type: 'fatal', stage: stage, error: String((err && err.message) || err) });
}

/** 解析引擎 stdout：形如 "7,7" 的一行就是落子 */
function onStdout(line) {
  var s = String(line == null ? '' : line).trim();
  var score = /\bEval\s+(-?\d+)\b/.exec(s);
  if (pending && score) pending.eval = parseInt(score[1], 10);
  var m = /^(\d+)\s*,\s*(\d+)$/.exec(s);
  if (!m) {
    post({ type: 'log', line: s });
    return;
  }
  if (!pending) return;
  var w = pending;
  pending = null;
  clearTimeout(w.timer);
  w.resolve({ row: parseInt(m[2], 10), col: parseInt(m[1], 10) }, w.eval);
}

/** 把应用的扁平棋盘转成 Piskvork BOARD 指令 */
function boardCommand(board) {
  var out = ['BOARD'];
  for (var i = 0; i < board.length; i++) {
    var v = board[i];
    if (!v) continue;
    var r = (i / SIZE) | 0;
    var c = i % SIZE;
    out.push(c + ',' + r + ',' + v);
  }
  out.push('DONE');
  return out.join('\n');
}

try {
  importScripts('rapfi-single-simd128.js');
} catch (e) {
  fail('import', e);
}

if (!fatal) {
  if (typeof Rapfi !== 'function') {
    fail('import', new Error('胶水层未暴露 Rapfi 构造函数'));
  } else {
    Rapfi({
      // 资源与 worker 同目录，胶水层自己会算对基路径
      onReceiveStdout: onStdout,
      onReceiveStderr: function (l) { post({ type: 'log', line: '! ' + l }); },
      onExit: function (code) { post({ type: 'exit', code: code }); },
      // 胶水层会在下载 10MB 权重时回调，用来给用户进度反馈
      setStatus: function (s) { if (s) post({ type: 'status', text: String(s) }); },
    }).then(function (mod) {
      engine = mod;
      // ⚠️ rule 必须是 1，不能用 0。
      //
      // Rapfi 的 rule 语义与直觉相反，而且和权重文件绑定：
      //   rule 1 → standard 规则（**恰好五连，不认长连**）+ 加载 standard NNUE 权重 ✓
      //   rule 0 → freestyle 规则（长连算赢）+ 找 freestyle 权重 → 包里没有
      //            → 报 "Evaluator mix9svq disabled: no compatible weight config found"
      //            → 退回手写评估，强度明显下降 ✗
      //
      // 也就是说「规则对」和「评估强」在现有产物里二选一，只能选评估强。
      // rule 1 不认长连这一点由 app.js 里的 findForcedMove() 兜底：
      // 每步先做一次必杀/必堵检查（用本项目的 isFiveAt，5+ 算赢），
      // 有必杀或必堵就直接走，否则才交给 Rapfi。
      //
      // 详见 dev/diag-rapfi-rule.js / diag-rapfi-weights.js / diag-rapfi-overline.js。
      mod.sendCommand('INFO rule 1');
      mod.sendCommand('START 15');
      mod.sendCommand('INFO timeout_turn 2000');
      mod.sendCommand('INFO timeout_match 2147483647');
      ready = true;
      post({ type: 'ready' });
    }).catch(function (e) {
      fail('init', e);
    });
  }
}

self.onmessage = function (ev) {
  var d = ev.data || {};

  if (d.type === 'ping') {
    post({ type: 'pong', ready: ready, fatal: fatal });
    return;
  }

  // 开新局。Piskvork 协议里 START 才是「新的一局」——
  // 它会重置着法历史与置换表。不重发的话，上一局的残留状态会让引擎
  // 的时间控制失准、着法变形（实测：连打多局不重发 START，执白会明显变弱）。
  if (d.type === 'newgame') {
    if (!ready || !engine) { post({ type: 'newgame', id: d.id, ok: false }); return; }
    try {
      engine.sendCommand('INFO rule 1');   // 只有 rule 1 能加载到 NNUE 权重
      engine.sendCommand('START 15');
      engine.sendCommand('INFO timeout_turn 2000');
      post({ type: 'newgame', id: d.id, ok: true });
    } catch (e) {
      post({ type: 'newgame', id: d.id, ok: false });
    }
    return;
  }

  if (d.type !== 'move') return;

  if (!ready || !engine) {
    post({ type: 'move', id: d.id, move: null, reason: fatal ? 'fatal' : 'not-ready' });
    return;
  }

  var budget = Math.max(200, Math.min(d.budget || 2000, 15000));

  var timer = setTimeout(function () {
    if (!pending || pending.id !== d.id) return;
    pending = null;
    post({ type: 'move', id: d.id, move: null, reason: 'timeout' });
  }, budget + 500);

  pending = {
    id: d.id,
    timer: timer,
    eval: null,
    resolve: function (mv, score) { post({ type: 'move', id: d.id, move: mv, eval: score }); },
  };

  try {
    engine.sendCommand('INFO timeout_turn ' + budget);
    engine.sendCommand(boardCommand(d.board));
  } catch (e) {
    if (pending && pending.id === d.id) {
      clearTimeout(pending.timer);
      pending = null;
    }
    post({ type: 'move', id: d.id, move: null, reason: 'exception' });
    post({ type: 'fatal', stage: 'search', error: String((e && e.message) || e) });
  }
};
