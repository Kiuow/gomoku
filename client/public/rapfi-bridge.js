/**
 * Rapfi 桥接层（主线程）
 *
 * 职责：把 Rapfi WASM 引擎包成一个可控的后端，并且**永远不阻塞、永远能降级**。
 * app.js 只通过这里问「神仙档的落子」，拿不到就自己退回内置 JS 引擎。
 *
 * 状态机：idle → loading → ready；失败时先降级，再延迟重试。
 *
 * 失败是常态而非异常，必须考虑的情况：
 *   - file:// 下 Chrome 不允许 new Worker()        → 构造抛异常
 *   - .data 走 fetch，file:// 不支持                → worker 报 fatal
 *   - 网络中断 / 10MB 权重下载失败                   → worker 报 fatal
 *   - 引擎初始化卡死                                 → 启动超时
 */
(function (root) {
  'use strict';

  var BOOT_TIMEOUT = 45000;   // 10MB 权重 + NNUE 初始化，给足时间
  var REPLY_SLACK = 500;      // 超时后尽快降级，不让单步等待变成十几秒

  var SELF_SRC = (document.currentScript && document.currentScript.src) || '';

  var state = 'idle';
  var worker = null;
  var lastError = '';
  var statusText = '';
  var bootTimer = null;
  var retryTimer = null;
  var retryDelay = 15000;
  var waiters = [];           // ensure() 的等待者
  var inflight = null;        // {id, resolve, timer}
  var reqId = 0;
  var listeners = [];

  function emit() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state, statusText); } catch (e) {}
    }
  }

  function workerUrl() {
    if (!SELF_SRC) return null;
    try { return new URL('rapfi/worker.js', SELF_SRC).href; } catch (e) { return null; }
  }

  function settleWaiters(ok) {
    var w = waiters;
    waiters = [];
    for (var i = 0; i < w.length; i++) {
      try { w[i](ok); } catch (e) {}
    }
  }

  function finishRequest(result) {
    if (!inflight) return;
    var f = inflight;
    inflight = null;
    clearTimeout(f.timer);
    f.resolve(result || null);
    if (f.waiters) for (var i = 0; i < f.waiters.length; i++) f.waiters[i]();
  }

  function shutdown(err) {
    if (worker) { try { worker.terminate(); } catch (e) {} }
    worker = null;
    clearTimeout(bootTimer);
    bootTimer = null;
    state = 'failed';
    lastError = err || lastError || '未知错误';
    finishRequest(null);
    settleWaiters(false);
    emit();
    if (!retryTimer) {
      retryTimer = setTimeout(function () {
        retryTimer = null;
        if (state === 'failed') { state = 'idle'; ensure(); }
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 60000);
    }
  }

  function handleMessage(ev) {
    var d = ev.data || {};

    if (d.type === 'ready') {
      clearTimeout(bootTimer);
      bootTimer = null;
      state = 'ready';
      retryDelay = 15000;
      statusText = '';
      settleWaiters(true);
      emit();
      return;
    }

    if (d.type === 'fatal') {
      shutdown(d.stage + ': ' + d.error);
      return;
    }

    if (d.type === 'status') {
      statusText = d.text;
      emit();
      return;
    }

    if (d.type === 'move') {
      if (inflight && inflight.id === d.id) finishRequest({ move: d.move, eval: d.eval });
      if (d.reason === 'timeout') shutdown('搜索超时');
      return;
    }
  }

  /** 启动加载。幂等：重复调用返回同一个结果。 */
  function ensure() {
    if (state === 'ready') return Promise.resolve(true);
    if (state === 'failed') return Promise.resolve(false);
    if (state === 'loading') {
      return new Promise(function (res) { waiters.push(res); });
    }

    var url = workerUrl();
    if (!url) {
      shutdown('拿不到 worker 路径');
      return Promise.resolve(false);
    }

    state = 'loading';
    statusText = '正在加载引擎…';
    emit();

    return new Promise(function (res) {
      waiters.push(res);
      try {
        worker = new Worker(url);
      } catch (e) {
        shutdown('new Worker: ' + ((e && e.message) || e));
        return;
      }

      worker.onmessage = handleMessage;
      worker.onerror = function (e) {
        shutdown('worker error: ' + ((e && e.message) || '未知'));
      };

      bootTimer = setTimeout(function () {
        if (state === 'loading') shutdown('启动超时');
      }, BOOT_TIMEOUT);
    });
  }

  /**
   * 问引擎要一步棋。
   * @returns Promise<{row,col}|null>  null 表示引擎不可用，调用方应降级
   */
  function analyze(board, player, budget) {
    if (state !== 'ready' || !worker) return Promise.resolve(null);
    if (inflight) return new Promise(function (res) {
      inflight.waiters.push(function () { analyze(board, player, budget).then(res); });
    });

    var b = Math.max(200, Math.min(budget || 2000, 15000));
    var id = ++reqId;

    return new Promise(function (res) {
      inflight = {
        id: id,
        resolve: res,
        waiters: [],
        timer: setTimeout(function () { shutdown('搜索响应超时'); }, b + REPLY_SLACK),
      };
      try {
        worker.postMessage({ type: 'move', id: id, board: board, player: player, budget: b });
      } catch (e) {
        finishRequest(null);
      }
    });
  }

  root.RapfiBridge = {
    ensure: ensure,
    analyze: analyze,
    findBestMove: function (board, player, budget) {
      return analyze(board, player, budget).then(function (result) { return result && result.move || null; });
    },
    /**
     * 通知引擎「开新局」。Piskvork 协议里 START 才会重置着法历史与置换表，
     * 不重置的话连打多局会累积状态，引擎会明显变弱。
     * 发完就走，不等回执 —— 调用方不需要阻塞在开局的瞬间。
     */
    newGame: function () {
      if (state !== 'ready' || !worker) return;
      try { worker.postMessage({ type: 'newgame', id: ++reqId }); } catch (e) {}
    },
    status: function () { return state; },
    statusText: function () { return statusText; },
    lastError: function () { return lastError; },
    isReady: function () { return state === 'ready'; },
    isFailed: function () { return state === 'failed'; },
    onChange: function (fn) { listeners.push(fn); },
  };
})(window);
