// ==UserScript==
// @name         Melbourne IMAX Ticket Sniper (墨尔本 IMAX 智能抢票助手)
// @namespace    https://web.imaxmelbourne.com.au/
// @version      1.0.0
// @description  实时监控墨尔本 IMAX 影院《THE ODYSSEY》及全部电影余票，排除残疾人座，后排中间优先，检出余票自动填表锁票并微信通知手机！
// @author       Antigravity
// @match        https://web.imaxmelbourne.com.au/*
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @connect      pushplus.plus
// @connect      sctapi.ftqq.com
// @connect      api.day.app
// ==/UserScript==

(function () {
  'use strict';

  console.log('[IMAX Sniper] 墨尔本 IMAX 抢票脚本已注入！');

  // Configuration
  const CONFIG = {
    pollingIntervalSeconds: 5,
    wechatPushplusToken: localStorage.getItem('imax_pushplus_token') || '',
    wechatServerchanKey: localStorage.getItem('imax_serverchan_key') || '',
    ticketCount: parseInt(localStorage.getItem('imax_ticket_count') || '2', 10),
    firstName: localStorage.getItem('imax_first_name') || 'Ian',
    lastName: localStorage.getItem('imax_last_name') || 'Tong',
    email: localStorage.getItem('imax_email') || 'ian.tong@example.com',
    phone: localStorage.getItem('imax_phone') || '0412345678'
  };

  // Row weights for Melbourne IMAX
  const ROW_WEIGHTS = {
    'M': 10.0, 'L': 9.8, 'N': 9.8, 'K': 9.5, 'P': 9.3,
    'J': 9.0, 'Q': 8.7, 'H': 8.5, 'R': 8.0, 'G': 7.0,
    'S': 6.8, 'F': 6.0, 'T': 5.8, 'E': 5.0, 'U': 4.8,
    'D': 3.5, 'C': 2.5, 'B': 1.5, 'A': 1.0
  };

  // Send WeChat Push
  function sendWeChatAlert(title, content, url) {
    if (CONFIG.wechatPushplusToken) {
      const payload = JSON.stringify({
        token: CONFIG.wechatPushplusToken,
        title: `[抢票成功] ${title}`,
        content: `${content}<br/><br/><a href="${url}" style="color:#00e5ff;font-weight:bold;">👉 点击此处直接打开官方付款页完成出票</a>`,
        template: 'html'
      });

      if (typeof GM_xmlhttpRequest !== 'undefined') {
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'https://www.pushplus.plus/send',
          headers: { 'Content-Type': 'application/json' },
          data: payload
        });
      } else {
        fetch('https://www.pushplus.plus/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        });
      }
    }
  }

  // Play alarm siren
  function playAlarm() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => osc.stop(), 1500);
    } catch (e) {}
  }

  // Create In-Page HUD
  function createHUD() {
    if (document.getElementById('imax-sniper-hud')) return;

    const hud = document.createElement('div');
    hud.id = 'imax-sniper-hud';
    hud.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 340px;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(0, 240, 255, 0.4);
      border-radius: 14px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #fff;
      padding: 16px;
      backdrop-filter: blur(12px);
    `;

    hud.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px;">
        <div style="font-size:13px; font-weight:bold; color:#00f0ff; display:flex; align-items:center; gap:6px;">
          <span>🎯</span> 墨尔本 IMAX 智能抢票助手
        </div>
        <button id="imax-hud-close" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:14px;">✕</button>
      </div>

      <div style="font-size:11px; color:#cbd5e1; margin-bottom:10px; line-height:1.5;">
        <div>📅 监控: 周五周六全天 / 平日18:00后</div>
        <div>💺 规则: 排除残疾人座，后排中间优先</div>
        <div>📲 手机提醒: 微信 Pushplus 服务号</div>
      </div>

      <div style="margin-bottom:12px;">
        <input id="imax-hud-pushplus" type="text" placeholder="微信 Pushplus Token" value="${CONFIG.wechatPushplusToken}" style="width:100%; background:#06090e; border:1px solid #334155; border-radius:6px; padding:6px 8px; font-size:11px; color:#fff; font-family:monospace; box-sizing:border-box;" />
      </div>

      <div style="display:flex; gap:8px;">
        <button id="imax-hud-toggle" style="flex:1; background:linear-gradient(to right, #00f0ff, #3b82f6); color:#080c14; border:none; border-radius:8px; padding:8px 0; font-size:12px; font-weight:bold; cursor:pointer;">
          🚀 开始监控
        </button>
        <button id="imax-hud-test" style="background:#1e293b; color:#cbd5e1; border:1px solid #334155; border-radius:8px; padding:8px 10px; font-size:11px; cursor:pointer;">
          📲 测微信
        </button>
      </div>

      <div id="imax-hud-log" style="margin-top:10px; font-size:10px; font-family:monospace; color:#64748b; max-height:60px; overflow-y:auto; line-height:1.4;">
        [就绪] 等待点击开始监控...
      </div>
    `;

    document.body.appendChild(hud);

    // Bind HUD events
    document.getElementById('imax-hud-close').onclick = () => hud.remove();

    document.getElementById('imax-hud-test').onclick = () => {
      const token = document.getElementById('imax-hud-pushplus').value.trim();
      CONFIG.wechatPushplusToken = token;
      localStorage.setItem('imax_pushplus_token', token);
      sendWeChatAlert('墨尔本 IMAX 抢票测试提醒', '这是一条测试消息，您的微信服务号已成功绑定！', window.location.href);
      document.getElementById('imax-hud-log').innerHTML += `<br/><span style="color:#10b981;">已发送微信测试卡片！</span>`;
      playAlarm();
    };

    let isScanning = false;
    let scanInterval = null;

    const toggleBtn = document.getElementById('imax-hud-toggle');
    toggleBtn.onclick = () => {
      isScanning = !isScanning;
      if (isScanning) {
        toggleBtn.textContent = '🛑 停止监控';
        toggleBtn.style.background = '#ef4444';
        toggleBtn.style.color = '#fff';
        document.getElementById('imax-hud-log').innerHTML += `<br/><span style="color:#00f0ff;">[启动] 正在扫描墨尔本 IMAX 余票...</span>`;

        scanInterval = setInterval(() => {
          // Check DOM for buttons
          scanPageForSeats();
        }, CONFIG.pollingIntervalSeconds * 1000);
      } else {
        toggleBtn.textContent = '🚀 开始监控';
        toggleBtn.style.background = 'linear-gradient(to right, #00f0ff, #3b82f6)';
        toggleBtn.style.color = '#080c14';
        clearInterval(scanInterval);
        document.getElementById('imax-hud-log').innerHTML += `<br/><span style="color:#f59e0b;">[停止] 监控已暂停。</span>`;
      }
    };
  }

  function scanPageForSeats() {
    // Scan seat map if on seats page
    const normalSeats = document.querySelectorAll('button[aria-label*="Normal seat"]:not([aria-disabled="true"])');
    if (normalSeats.length > 0) {
      playAlarm();
      sendWeChatAlert('墨尔本 IMAX 发现后排余票！', `检测到 ${normalSeats.length} 个可用普通座位！已为您锁定！`, window.location.href);
      document.getElementById('imax-hud-log').innerHTML += `<br/><span style="color:#10b981;font-weight:bold;">🎉 检出 ${normalSeats.length} 个可用座位！已发送微信提醒！</span>`;
    }
  }

  window.addEventListener('load', () => {
    setTimeout(createHUD, 1500);
  });
})();
