/**
 * Notification Service for IMAX Ticket Sniper
 * Supports:
 *  - iOS Bark App (instant ringing & vibration on iPhone with direct booking link)
 *  - WeChat via Pushplus (微信模板消息)
 *  - WeChat via Server酱 (方糖服务号)
 *  - Telegram Bot
 *  - Discord Webhook
 *  - Custom Webhook / Apple Shortcuts
 *  - Browser Desktop Notification (Web Notifications API)
 */
class NotificationService {
  constructor() {
    this.storageKey = 'imax_sniper_notify_config';
    this.config = this.loadConfig();
  }

  loadConfig() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      channel: 'bark', // 'bark' | 'pushplus' | 'serverchan' | 'telegram' | 'discord' | 'custom'
      barkKey: '', // e.g., "https://api.day.app/your_key/" or "your_key"
      pushplusToken: '',
      serverchanKey: '',
      telegramBotToken: '',
      telegramChatId: '',
      discordWebhookUrl: '',
      customWebhookUrl: '',
      customMethod: 'POST',
      desktopNotificationEnabled: true,
      soundAlarmEnabled: true,
    };
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem(this.storageKey, JSON.stringify(this.config));
  }

  // Request browser permission for desktop notifications
  async requestBrowserPermission() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    if (Notification.permission === 'granted') {
      return 'granted';
    }
    return await Notification.requestPermission();
  }

  // Show desktop notification
  showDesktopNotification(title, body, url = null) {
    if (!this.config.desktopNotificationEnabled) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      const n = new Notification(title, {
        body,
        icon: 'https://web.imaxmelbourne.com.au/favicon.ico',
        requireInteraction: true,
        tag: 'imax-ticket-alert'
      });
      if (url) {
        n.onclick = () => {
          window.focus();
          window.open(url, '_blank');
        };
      }
    } catch (e) {
      console.warn('Desktop notification error:', e);
    }
  }

  // Send notification to mobile phone before payment
  async sendMobileAlert({ title, message, url, sessionInfo, seatsInfo }) {
    const results = [];
    const fullBody = `${message}\n场次: ${sessionInfo || '未指定'}\n已锁座位: ${seatsInfo || '未指定'}\n请在10分钟内完成付款！`;

    // 1. Browser desktop notification
    this.showDesktopNotification(title, fullBody, url);

    // 2. Mobile channel dispatch
    switch (this.config.channel) {
      case 'bark':
        results.push(await this.sendBark(title, fullBody, url));
        break;
      case 'pushplus':
        results.push(await this.sendPushplus(title, fullBody, url));
        break;
      case 'serverchan':
        results.push(await this.sendServerChan(title, fullBody, url));
        break;
      case 'telegram':
        results.push(await this.sendTelegram(title, fullBody, url));
        break;
      case 'discord':
        results.push(await this.sendDiscord(title, fullBody, url));
        break;
      case 'custom':
        results.push(await this.sendCustomWebhook(title, fullBody, url));
        break;
      default:
        results.push({ success: false, message: '未配置手机提醒通道' });
    }

    return results;
  }

  // Channel 1: iOS Bark
  async sendBark(title, body, url) {
    let key = (this.config.barkKey || '').trim();
    if (!key) return { success: false, message: 'Bark 设备 Key 为空' };

    let endpoint = key;
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      endpoint = `https://api.day.app/${key}`;
    }
    endpoint = endpoint.replace(/\/+$/, '');

    // Urgent push: sound=alarm.caf, level=timeSensitive, badge=1
    const requestUrl = `${endpoint}/${encodeURIComponent(title)}/${encodeURIComponent(body)}?sound=alarm.caf&level=timeSensitive&group=IMAX&url=${encodeURIComponent(url || '')}`;

    try {
      const res = await fetch(requestUrl, { method: 'GET', mode: 'no-cors' });
      return { success: true, message: '已发送至 iPhone Bark (已触发高优先级铃声)' };
    } catch (e) {
      return { success: false, message: `Bark 发送失败: ${e.message}` };
    }
  }

  // Channel 2: 微信 Pushplus
  async sendPushplus(title, body, url) {
    const token = (this.config.pushplusToken || '').trim();
    if (!token) return { success: false, message: 'Pushplus Token 为空' };

    try {
      const content = `${body.replace(/\n/g, '<br/>')}<br/><br/><a href="${url}" style="color:#00e5ff;font-weight:bold;">👉 点击此处直接打开官方付款页面</a>`;
      const res = await fetch('https://www.pushplus.plus/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          title: `[抢票成功] ${title}`,
          content,
          template: 'html'
        })
      });
      const data = await res.json();
      return { success: data.code === 200, message: data.code === 200 ? '已通过微信 Pushplus 推送' : (data.msg || '推送失败') };
    } catch (e) {
      return { success: false, message: `Pushplus 失败: ${e.message}` };
    }
  }

  // Channel 3: 微信 Server酱
  async sendServerChan(title, body, url) {
    const key = (this.config.serverchanKey || '').trim();
    if (!key) return { success: false, message: 'Server酱 SendKey 为空' };

    const endpoint = `https://sctapi.ftqq.com/${key}.send`;
    try {
      const desp = `${body}\n\n[点击直达官方付款页](${url})`;
      const params = new URLSearchParams({ title: `[IMAX抢票] ${title}`, desp });
      const res = await fetch(`${endpoint}?${params.toString()}`, { method: 'GET', mode: 'no-cors' });
      return { success: true, message: '已发送至微信 Server酱' };
    } catch (e) {
      return { success: false, message: `Server酱 失败: ${e.message}` };
    }
  }

  // Channel 4: Telegram Bot
  async sendTelegram(title, body, url) {
    const token = (this.config.telegramBotToken || '').trim();
    const chatId = (this.config.telegramChatId || '').trim();
    if (!token || !chatId) return { success: false, message: 'Telegram Bot Token 或 Chat ID 为空' };

    const text = `🚨 *${title}*\n\n${body}\n\n🔗 [立即打开官方付款链接](${url || ''})`;
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown'
        })
      });
      const data = await res.json();
      return { success: data.ok, message: data.ok ? '已发送至 Telegram' : data.description };
    } catch (e) {
      return { success: false, message: `Telegram 失败: ${e.message}` };
    }
  }

  // Channel 5: Discord Webhook
  async sendDiscord(title, body, url) {
    const webhookUrl = (this.config.discordWebhookUrl || '').trim();
    if (!webhookUrl) return { success: false, message: 'Discord Webhook URL 为空' };

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🚨 **${title}**\n${body}\n付款直达: ${url || ''}`
        })
      });
      return { success: res.ok, message: res.ok ? '已推送至 Discord' : `Discord 状态: ${res.status}` };
    } catch (e) {
      return { success: false, message: `Discord 失败: ${e.message}` };
    }
  }

  // Channel 6: Custom Webhook
  async sendCustomWebhook(title, body, url) {
    const webhook = (this.config.customWebhookUrl || '').trim();
    if (!webhook) return { success: false, message: '自定义 Webhook 为空' };

    try {
      let finalUrl = webhook
        .replace('{title}', encodeURIComponent(title))
        .replace('{body}', encodeURIComponent(body))
        .replace('{url}', encodeURIComponent(url || ''));

      if (this.config.customMethod === 'GET') {
        await fetch(finalUrl, { method: 'GET', mode: 'no-cors' });
      } else {
        await fetch(finalUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, url, timestamp: Date.now() }),
          mode: 'no-cors'
        });
      }
      return { success: true, message: '自定义 Webhook 已触发' };
    } catch (e) {
      return { success: false, message: `Webhook 失败: ${e.message}` };
    }
  }

  // Test current phone notification setup
  async testNotification() {
    return await this.sendMobileAlert({
      title: 'IMAX 抢票测试提醒 🎬',
      message: '这是一条测试通知。当自动抢票系统为您锁定电影票时，将立即在此收到提醒并进入付款！',
      url: 'https://web.imaxmelbourne.com.au/films/THE-ODYSSEY-IMAX-70MM-PRESENTATION/HO00000547#showtimes',
      sessionInfo: '2026-10-02 (周五) 19:30 IMAX 70MM',
      seatsInfo: 'Row M 18, Row M 19 (后排中间优选座)'
    });
  }
}

window.notificationService = new NotificationService();
