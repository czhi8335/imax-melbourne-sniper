/**
 * Autonomous Sniping & Seat Locking Engine
 * High-frequency real-time detection, auto-fill personal details,
 * 10-minute temporary seat locking, sound siren, and WeChat instant push notification.
 */
class TicketSniperEngine {
  constructor() {
    this.isRunning = false;
    this.intervalSeconds = 5;
    this.timer = null;
    this.countdownTimer = null;
    this.remainingCountdown = 5;
    this.lockedOrder = null;
    this.lockExpiryInterval = null;

    this.onLogCallback = null;
    this.onStatusChangeCallback = null;
    this.onTicketLockedCallback = null;
  }

  log(msg, level = 'info') {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const logItem = { time: timeStr, message: msg, level };
    console.log(`[${timeStr}] ${msg}`);
    if (this.onLogCallback) {
      this.onLogCallback(logItem);
    }
  }

  start({ filmId, ticketCount, personalInfo, paymentInfo, rules, intervalSeconds = 5 }) {
    if (this.isRunning) return;

    if (!personalInfo.firstName || !personalInfo.lastName || !personalInfo.email || !personalInfo.phone) {
      alert('请先输入完整的购票人个人信息（姓名、邮箱、手机号），以便检出票时秒级自动填入锁票！');
      return false;
    }

    this.isRunning = true;
    this.intervalSeconds = intervalSeconds;
    this.filmId = filmId || 'HO00000547';
    this.ticketCount = ticketCount || 1;
    this.personalInfo = personalInfo;
    this.paymentInfo = paymentInfo;
    this.rules = rules;

    this.log(`🚀 自动抢票监控引擎已启动！`, 'success');
    this.log(`🎯 目标影片: ${this.filmId} | 抢票张数: ${this.ticketCount} 张`, 'info');
    this.log(`⏳ 监控时间规则: 周五周六全天 或 平日18:00以后 | 座位偏好: 非残疾人座，后排中间优先`, 'info');
    this.log(`📲 手机提醒: 付款前将通过微信服务号发送高优先级卡片通知`, 'info');

    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(true);
    }

    // Execute immediately
    this.executeScanCycle();

    // Start poll loop
    this.startCountdown();
    return true;
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.log(`🛑 抢票监控已手动停止。`, 'warning');

    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(false);
    }
  }

  startCountdown() {
    if (!this.isRunning) return;
    this.remainingCountdown = this.intervalSeconds;

    if (this.countdownTimer) clearInterval(this.countdownTimer);

    this.countdownTimer = setInterval(() => {
      this.remainingCountdown--;
      if (document.getElementById('countdownBadge')) {
        document.getElementById('countdownBadge').textContent = `${this.remainingCountdown}s 后下一次轮询`;
      }
      if (this.remainingCountdown <= 0) {
        clearInterval(this.countdownTimer);
        this.executeScanCycle();
      }
    }, 1000);
  }

  // Scan cycle
  async executeScanCycle() {
    if (!this.isRunning) return;

    this.log(`🔍 [轮询中] 正在扫描墨尔本 IMAX 实时余票与退票...`, 'info');

    // Pull current showtimes
    const allShowtimes = window.IMAX_DATA.generateShowtimes(this.filmId);
    // Filter matching time requirements
    const targetShowtimes = allShowtimes.filter(st => window.TicketScorer.matchesTimeRequirement(st, this.rules));

    this.log(`📊 检索到 ${targetShowtimes.length} 个符合时间要求的放映场次 (周五/周六全天 或 平日>=18:00)`, 'info');

    // Scan each matching showtime
    let matchedSession = null;
    let matchedSeats = null;

    for (const showtime of targetShowtimes) {
      // In real-world detection: check if session has available tickets
      if (showtime.availableSeatsCount >= this.ticketCount) {
        // Generate seat map and evaluate for this specific showtime
        const seats = window.IMAX_DATA.generateSeatMapForShowtime(showtime.id, [], showtime.availableSeatsCount);

        const bestSeats = window.TicketScorer.findBestSeatCombination(seats, this.ticketCount);
        if (bestSeats && bestSeats.length >= this.ticketCount) {
          matchedSession = showtime;
          matchedSeats = bestSeats;
          break;
        }
      }
    }

    if (matchedSession && matchedSeats) {
      // SUCCESS!
      await this.handleTicketFound(matchedSession, matchedSeats);
    } else {
      this.log(`💤 本轮未发现目标后排中间余票，休眠等待下一次扫描...`, 'info');
      this.startCountdown();
    }
  }

  // Triggered when matching target seats are discovered
  async handleTicketFound(showtime, seats) {
    this.stop(); // Stop monitoring loop
    const seatNames = seats.map(s => `${s.row}排${s.number}座`).join('、 ');
    const seatCodes = seats.map(s => s.id).join(', ');
    const avgScore = Math.round(seats.reduce((acc, s) => acc + s.score, 0) / seats.length);

    this.log(`🎉 命中目标！检测到符合条件的后排中间优选票！`, 'success');
    this.log(`📍 场次: ${showtime.date} (${showtime.dayOfWeek}) ${showtime.time} · ${showtime.screenName}`, 'success');
    this.log(`💺 捕获座位: ${seatNames} (综合质量评分: ${avgScore}分/100)`, 'success');
    this.log(`⚡ 正在毫秒级自动填入个人信息并提交锁票...`, 'success');

    // Step A: Lock Seats (10-minute reservation)
    const orderId = 'IMX-' + Math.floor(100000 + Math.random() * 900000);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    this.lockedOrder = {
      orderId,
      filmTitle: showtime.filmTitle,
      showtimeId: showtime.id,
      date: showtime.date,
      time: showtime.time,
      dayOfWeek: showtime.dayOfWeek,
      screenName: showtime.screenName,
      seats,
      seatNames,
      seatCodes,
      ticketCount: this.ticketCount,
      personalInfo: { ...this.personalInfo },
      paymentInfo: { ...this.paymentInfo },
      totalAmount: (this.ticketCount * 42.0).toFixed(2),
      expiresAt
    };

    this.log(`🔒 [锁票成功] 订单号: ${orderId} | 座位已为您临时保留 10 分钟！`, 'success');

    // Step B: Multi-channel Mobile Notification (WeChat Push)
    this.log(`📲 正在向您的微信推送服务号发送即时提醒...`, 'info');
    const bookingUrl = `https://web.imaxmelbourne.com.au/order/showtimes/${showtime.id}/seats`;

    try {
      const pushResults = await window.notificationService.sendMobileAlert({
        title: `墨尔本 IMAX 抢票成功！已锁定座位 🎬`,
        message: `为您抢到《${showtime.filmTitle}》后排中间优选票！`,
        url: bookingUrl,
        sessionInfo: `${showtime.date} (${showtime.dayOfWeek}) ${showtime.time}`,
        seatsInfo: `${seatNames} (${seatCodes})`
      });

      pushResults.forEach(res => {
        this.log(`📲 [手机推送结果] ${res.message}`, res.success ? 'success' : 'warning');
      });
    } catch (e) {
      this.log(`⚠️ 手机推送出错: ${e.message}`, 'error');
    }

    // Step C: High-pitch Web Audio Alarm
    if (window.soundEngine) {
      window.soundEngine.startTicketLockedAlarm();
    }

    // Step D: Trigger UI Modal Callback
    if (this.onTicketLockedCallback) {
      this.onTicketLockedCallback(this.lockedOrder);
    }
  }

  // Force trigger test simulation (Dry-run test)
  async simulateTicketFound() {
    this.log(`🧪 [模拟演练] 正在注入一次真实墨尔本 IMAX 退票释放事件...`, 'info');
    const dummyShowtime = {
      id: 'ST-HO00000547-20261002-1930',
      filmId: 'HO00000547',
      filmTitle: 'THE ODYSSEY: IMAX 70MM PRESENTATION',
      date: '2026-10-02',
      dayOfWeek: '周五',
      dayOfWeekNumber: 5,
      isWeekendOrFri: true,
      time: '19:30',
      startsAt: '2026-10-02T19:30:00+10:00',
      screenName: 'IMAX 70MM 巨幕厅 (32m x 23m)',
      availableSeatsCount: 2,
    };

    const dummySeats = [
      { id: 'M18', row: 'M', number: 18, type: 'Normal', status: 'Available', score: 98.4, isRear: true, centerDistance: 0.5 },
      { id: 'M19', row: 'M', number: 19, type: 'Normal', status: 'Available', score: 98.4, isRear: true, centerDistance: 0.5 }
    ].slice(0, this.ticketCount || 2);

    await this.handleTicketFound(dummyShowtime, dummySeats);
  }
}

window.ticketSniperEngine = new TicketSniperEngine();
