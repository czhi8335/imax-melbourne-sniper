/**
 * IMAX Melbourne Ticket Sniper - Main App Controller
 * Connects all UI components, seat maps, forms, WeChat notifications, and snipe engine.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    selectedFilmId: 'HO00000547', // The Odyssey IMAX 70mm
    selectedShowtimeId: null,
    selectedFormatFilter: 'ALL',
    ticketCount: 2,
    ticketType: 'adult',
    activeDate: null,
    soundMuted: false,
    personalInfo: {
      firstName: '',
      lastName: '',
      email: '',
      phone: ''
    },
    paymentInfo: {
      cardholder: '',
      cardNumber: '',
      cardExpiry: '',
      cardCvv: ''
    }
  };

  // Seat Map Instance
  let seatMap = null;

  // DOM Elements
  const filmCardsContainer = document.getElementById('filmCardsContainer');
  const dateTabsContainer = document.getElementById('dateTabsContainer');
  const sessionCardsContainer = document.getElementById('sessionCardsContainer');
  const terminalLogsContainer = document.getElementById('terminalLogsContainer');
  const engineStatusPill = document.getElementById('engineStatusPill');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  // Load saved form data from localStorage
  loadSavedForms();

  // Initialize Seat Map
  seatMap = new window.SeatMapRenderer('seatMapContainer', {
    onSeatSelected: (selectedIds) => {
      // Keep track of manual selections if needed
    }
  });

  // Render initial movies & showtimes
  renderFilmCards();
  loadFilmShowtimes(state.selectedFilmId);

  // Initialize Notification & Sound State
  initNotificationAndSoundUI();

  // ================= EVENT LISTENERS =================

  // Format Filter Tabs
  document.querySelectorAll('.format-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.format-pill').forEach(b => {
        b.classList.remove('bg-cyan-500/20', 'text-cyan-300', 'border-cyan-500/40', 'active');
        b.classList.add('bg-slate-800/80', 'text-slate-300', 'border-slate-700');
      });
      btn.classList.add('bg-cyan-500/20', 'text-cyan-300', 'border-cyan-500/40', 'active');
      btn.classList.remove('bg-slate-800/80', 'text-slate-300', 'border-slate-700');

      state.selectedFormatFilter = btn.dataset.format;
      renderFilmCards();
    });
  });

  // "一键显示所有电影余票" Button
  const btnFetchAll = document.getElementById('btnFetchAllShowtimes');
  if (btnFetchAll) {
    btnFetchAll.addEventListener('click', () => {
      btnFetchAll.innerHTML = '<span class="animate-spin">🔄</span> <span>正在刷新全部余票...</span>';
      setTimeout(() => {
        btnFetchAll.innerHTML = '<span>⚡</span> <span>一键显示所有电影余票</span>';
        renderFilmCards();
        loadFilmShowtimes(state.selectedFilmId);
        window.ticketSniperEngine.log('📊 已成功刷新墨尔本 IMAX 当前全部电影、场次与座位余票数据！', 'success');
        if (window.soundEngine) window.soundEngine.playSuccessChime();
      }, 500);
    });
  }

  // "一键推荐最佳后排中间座" Button
  const btnAutoRecommend = document.getElementById('btnAutoRecommendSeats');
  if (btnAutoRecommend) {
    btnAutoRecommend.addEventListener('click', () => {
      if (!seatMap) return;
      const count = parseInt(document.getElementById('selectTicketCount').value, 10) || 1;
      const bestSeats = seatMap.autoSelectBestSeats(count);

      if (bestSeats && bestSeats.length > 0) {
        const names = bestSeats.map(s => `${s.row}排${s.number}座`).join(', ');
        window.ticketSniperEngine.log(`✨ 已一键推荐并选中最佳后排中间座 (${bestSeats.length} 张): ${names}`, 'success');
        if (window.soundEngine) window.soundEngine.playTestBeep();
      } else {
        alert('当前场次暂无可推荐的后排中间空位，建议启动自动监控以捕获退票！');
      }
    });
  }

  // Ticket Count and Type Selectors
  document.getElementById('selectTicketCount').addEventListener('change', (e) => {
    state.ticketCount = parseInt(e.target.value, 10);
    saveFormsToStorage();
  });

  document.getElementById('selectTicketType').addEventListener('change', (e) => {
    state.ticketType = e.target.value;
    saveFormsToStorage();
  });

  // Personal Info Inputs
  ['inputFirstName', 'inputLastName', 'inputEmail', 'inputPhone'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        state.personalInfo.firstName = document.getElementById('inputFirstName').value.trim();
        state.personalInfo.lastName = document.getElementById('inputLastName').value.trim();
        state.personalInfo.email = document.getElementById('inputEmail').value.trim();
        state.personalInfo.phone = document.getElementById('inputPhone').value.trim();
        saveFormsToStorage();
      });
    }
  });

  // Payment Inputs
  ['inputCardholder', 'inputCardNumber', 'inputCardExpiry', 'inputCardCvv'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        state.paymentInfo.cardholder = document.getElementById('inputCardholder').value.trim();
        state.paymentInfo.cardNumber = document.getElementById('inputCardNumber').value.trim();
        state.paymentInfo.cardExpiry = document.getElementById('inputCardExpiry').value.trim();
        state.paymentInfo.cardCvv = document.getElementById('inputCardCvv').value.trim();
        saveFormsToStorage();
      });
    }
  });

  // "一键填入演示数据" Helper Button
  document.getElementById('btnFillDemoData').addEventListener('click', () => {
    document.getElementById('inputFirstName').value = 'Ian';
    document.getElementById('inputLastName').value = 'Tong';
    document.getElementById('inputEmail').value = 'ian.tong@example.com';
    document.getElementById('inputPhone').value = '0412 345 678';

    document.getElementById('inputCardholder').value = 'IAN TONG';
    document.getElementById('inputCardNumber').value = '4532 8901 2345 6789';
    document.getElementById('inputCardExpiry').value = '12/28';
    document.getElementById('inputCardCvv').value = '888';

    state.personalInfo = {
      firstName: 'Ian',
      lastName: 'Tong',
      email: 'ian.tong@example.com',
      phone: '0412 345 678'
    };
    state.paymentInfo = {
      cardholder: 'IAN TONG',
      cardNumber: '4532 8901 2345 6789',
      cardExpiry: '12/28',
      cardCvv: '888'
    };
    saveFormsToStorage();
    window.ticketSniperEngine.log('📝 已快速填充测试购票人信息与付款凭证。', 'info');
  });

  // WeChat Modal Toggle
  const wechatModal = document.getElementById('wechatModal');
  document.getElementById('btnOpenWechatModal').addEventListener('click', () => {
    const cfg = window.notificationService.config;
    document.getElementById('inputPushplusToken').value = cfg.pushplusToken || '';
    document.getElementById('inputServerchanKey').value = cfg.serverchanKey || '';
    document.getElementById('inputBarkKey').value = cfg.barkKey || '';
    wechatModal.classList.remove('hidden');
  });

  document.getElementById('btnCloseWechatModal').addEventListener('click', () => {
    wechatModal.classList.add('hidden');
  });

  // Save WeChat Push Config
  document.getElementById('btnSaveWechatConfig').addEventListener('click', () => {
    const pushplusToken = document.getElementById('inputPushplusToken').value.trim();
    const serverchanKey = document.getElementById('inputServerchanKey').value.trim();
    const barkKey = document.getElementById('inputBarkKey').value.trim();

    let channel = 'pushplus';
    if (!pushplusToken && serverchanKey) channel = 'serverchan';
    if (!pushplusToken && !serverchanKey && barkKey) channel = 'bark';

    window.notificationService.saveConfig({
      channel,
      pushplusToken,
      serverchanKey,
      barkKey
    });

    updateWechatBadge();
    wechatModal.classList.add('hidden');
    window.ticketSniperEngine.log('💾 微信服务号即时提醒配置已保存！', 'success');
  });

  // Test WeChat Push Button
  document.getElementById('btnTestWechatPush').addEventListener('click', async () => {
    const btn = document.getElementById('btnTestWechatPush');
    const feedback = document.getElementById('wechatTestFeedback');
    feedback.classList.remove('hidden', 'bg-emerald-950', 'bg-red-950', 'text-emerald-300', 'text-red-300');

    // Save temporary state first
    const pushplusToken = document.getElementById('inputPushplusToken').value.trim();
    const serverchanKey = document.getElementById('inputServerchanKey').value.trim();
    const barkKey = document.getElementById('inputBarkKey').value.trim();

    let channel = 'pushplus';
    if (!pushplusToken && serverchanKey) channel = 'serverchan';
    if (!pushplusToken && !serverchanKey && barkKey) channel = 'bark';

    window.notificationService.saveConfig({ channel, pushplusToken, serverchanKey, barkKey });

    btn.innerHTML = '<span class="animate-spin">🔄</span> <span>正在发送测试提醒...</span>';

    const results = await window.notificationService.testNotification();
    btn.innerHTML = '<span>📲</span> <span>发送微信测试消息</span>';

    const firstRes = results[0] || { success: false, message: '未配置通道' };
    if (firstRes.success) {
      feedback.classList.add('bg-emerald-950', 'text-emerald-300', 'border', 'border-emerald-700');
      feedback.innerHTML = `✅ <strong>发送成功:</strong> ${firstRes.message}。请查看您的手机微信是否已收到测试卡片！`;
      updateWechatBadge();
    } else {
      feedback.classList.add('bg-red-950', 'text-red-300', 'border', 'border-red-700');
      feedback.innerHTML = `❌ <strong>发送失败:</strong> ${firstRes.message}。请检查 Token 是否填写正确。`;
    }
  });

  // Sound Alarm Toggle
  document.getElementById('btnToggleSound').addEventListener('click', () => {
    state.soundMuted = !state.soundMuted;
    window.soundEngine.setMuted(state.soundMuted);
    const icon = document.getElementById('soundIcon');
    const text = document.getElementById('soundText');
    if (state.soundMuted) {
      icon.textContent = '🔇';
      text.textContent = '报警音已静音';
    } else {
      icon.textContent = '🔊';
      text.textContent = '警报音已开启';
      window.soundEngine.playTestBeep();
    }
  });

  // Browser Desktop Notification Permission
  document.getElementById('btnBrowserNotify').addEventListener('click', async () => {
    const res = await window.notificationService.requestBrowserPermission();
    const text = document.getElementById('browserNotifyText');
    if (res === 'granted') {
      text.textContent = '桌面通知已授权';
      window.notificationService.showDesktopNotification('IMAX 抢票通知已就绪', '当为您抢到电影票时将自动弹出桌面通知！');
    } else {
      text.textContent = '桌面通知已拒绝';
    }
  });

  // ================= SNIPER ENGINE ACTIONS =================

  const btnStart = document.getElementById('btnStartSniper');
  const btnStop = document.getElementById('btnStopSniper');
  const btnSimulate = document.getElementById('btnSimulateDrop');

  // Start Sniper
  btnStart.addEventListener('click', () => {
    const interval = parseInt(document.getElementById('selectPollingInterval').value, 10) || 5;
    const count = parseInt(document.getElementById('selectTicketCount').value, 10) || 1;

    const success = window.ticketSniperEngine.start({
      filmId: state.selectedFilmId,
      ticketCount: count,
      personalInfo: state.personalInfo,
      paymentInfo: state.paymentInfo,
      rules: {
        fridaySaturdayAllDay: true,
        otherDaysAfter18: true,
        excludeDisabledSeats: true,
        rearRowsPriority: true,
        middlePriority: true
      },
      intervalSeconds: interval
    });

    if (success) {
      btnStart.classList.add('hidden');
      btnStop.classList.remove('hidden');
    }
  });

  // Stop Sniper
  btnStop.addEventListener('click', () => {
    window.ticketSniperEngine.stop();
    btnStop.classList.add('hidden');
    btnStart.classList.remove('hidden');
  });

  // Simulate Refund Drop & Lock
  btnSimulate.addEventListener('click', () => {
    const count = parseInt(document.getElementById('selectTicketCount').value, 10) || 2;
    window.ticketSniperEngine.ticketCount = count;
    window.ticketSniperEngine.personalInfo = state.personalInfo;
    window.ticketSniperEngine.paymentInfo = state.paymentInfo;
    window.ticketSniperEngine.simulateTicketFound();
  });

  // Clear Logs
  document.getElementById('btnClearLogs').addEventListener('click', () => {
    terminalLogsContainer.innerHTML = '';
  });

  // Engine Callbacks
  window.ticketSniperEngine.onLogCallback = (logItem) => {
    const line = document.createElement('div');
    line.className = 'terminal-line';
    line.innerHTML = `
      <span class="terminal-time">[${logItem.time}]</span>
      <span class="terminal-text-${logItem.level}">${logItem.message}</span>
    `;
    terminalLogsContainer.appendChild(line);
    terminalLogsContainer.scrollTop = terminalLogsContainer.scrollHeight;
  };

  window.ticketSniperEngine.onStatusChangeCallback = (isRunning) => {
    if (isRunning) {
      statusDot.className = 'w-2.5 h-2.5 rounded-full bg-cyan-400 pulse-dot';
      statusText.textContent = '实时监控中 (高频扫描)';
      statusText.className = 'font-bold text-cyan-300';
    } else {
      statusDot.className = 'w-2.5 h-2.5 rounded-full bg-slate-500';
      statusText.textContent = '已暂停';
      statusText.className = 'font-medium text-slate-400';
      btnStop.classList.add('hidden');
      btnStart.classList.remove('hidden');
    }
  };

  window.ticketSniperEngine.onTicketLockedCallback = (order) => {
    openLockedTicketModal(order);
  };

  // Close Locked Modal & Stop Alarm
  document.getElementById('btnCloseLockedModal').addEventListener('click', () => {
    document.getElementById('lockedTicketModal').classList.add('hidden');
    if (window.soundEngine) window.soundEngine.stopAlarm();
  });

  document.getElementById('btnProceedPayment').addEventListener('click', () => {
    alert('🎉 订单支付成功！出票确认短信与电子门票已发送至您的邮箱：' + (state.personalInfo.email || 'your_email@example.com'));
    document.getElementById('lockedTicketModal').classList.add('hidden');
    if (window.soundEngine) window.soundEngine.stopAlarm();
  });

  // ================= HELPER FUNCTIONS =================

  function renderFilmCards() {
    filmCardsContainer.innerHTML = '';
    const filteredFilms = window.IMAX_DATA.films.filter(f => {
      if (state.selectedFormatFilter === 'ALL') return true;
      return f.format === state.selectedFormatFilter;
    });

    filteredFilms.forEach(film => {
      const isSelected = film.id === state.selectedFilmId;
      const card = document.createElement('div');
      card.className = `p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
        isSelected
          ? 'bg-slate-900 border-cyan-400 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400'
          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
      }`;

      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              ${film.badge}
            </span>
            <span class="text-xs text-slate-400 font-mono">${film.runtime}</span>
          </div>
          <h4 class="font-extrabold text-sm text-white tracking-wide line-clamp-1 mb-1">${film.title}</h4>
          <p class="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">${film.synopsis}</p>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
          <span class="text-amber-400 font-mono font-bold">$${film.price.adult.toFixed(2)} 起</span>
          <span class="text-cyan-400 font-bold flex items-center gap-1">
            ${isSelected ? '● 正在监控该片' : '点击选择 &rarr;'}
          </span>
        </div>
      `;

      card.addEventListener('click', () => {
        state.selectedFilmId = film.id;
        renderFilmCards();
        loadFilmShowtimes(film.id);
      });

      filmCardsContainer.appendChild(card);
    });
  }

  function loadFilmShowtimes(filmId) {
    const showtimes = window.IMAX_DATA.generateShowtimes(filmId);
    if (!showtimes || showtimes.length === 0) return;

    // Distinct dates
    const dates = Array.from(new Set(showtimes.map(s => s.date))).sort();
    if (!state.activeDate || !dates.includes(state.activeDate)) {
      state.activeDate = dates[0];
    }

    renderDateTabs(dates, showtimes);
    renderSessionCards(showtimes);
  }

  function renderDateTabs(dates, allShowtimes) {
    dateTabsContainer.innerHTML = '';
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    dates.forEach(dStr => {
      const d = new Date(dStr + 'T00:00:00');
      const dayOfWeek = d.getDay();
      const isFriOrSat = dayOfWeek === 5 || dayOfWeek === 6;
      const isActive = dStr === state.activeDate;

      const tab = document.createElement('button');
      tab.className = `px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition flex items-center space-x-1.5 ${
        isActive
          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
      }`;

      const weekendPill = isFriOrSat
        ? '<span class="w-2 h-2 rounded-full bg-amber-400" title="周五/周六全天监控"></span>'
        : '<span class="w-2 h-2 rounded-full bg-cyan-400" title="平日18:00后监控"></span>';

      tab.innerHTML = `
        ${weekendPill}
        <span class="font-bold">${dStr.slice(5)}</span>
        <span>(${dayNames[dayOfWeek]})</span>
      `;

      tab.addEventListener('click', () => {
        state.activeDate = dStr;
        renderDateTabs(dates, allShowtimes);
        renderSessionCards(allShowtimes);
      });

      dateTabsContainer.appendChild(tab);
    });
  }

  function renderSessionCards(allShowtimes) {
    sessionCardsContainer.innerHTML = '';
    const daySessions = allShowtimes.filter(s => s.date === state.activeDate);

    if (daySessions.length === 0) {
      sessionCardsContainer.innerHTML = '<div class="col-span-4 text-xs text-slate-500 py-4 text-center">当前日期无排片</div>';
      return;
    }

    daySessions.forEach(session => {
      const isSelected = session.id === state.selectedShowtimeId;
      const card = document.createElement('div');
      card.className = `p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
        isSelected
          ? 'bg-slate-900 border-cyan-400 ring-1 ring-cyan-400'
          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
      }`;

      const targetBadge = session.passesTimeFilter
        ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">🎯 目标时段</span>'
        : '<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">非目标时段</span>';

      const seatsBarPercent = Math.min(100, Math.round((session.availableSeatsCount / 20) * 100));

      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-sm font-extrabold text-white font-mono">${session.time}</span>
            ${targetBadge}
          </div>
          <div class="text-[11px] text-slate-400 mb-2">${session.slotTag} · ${session.screenName.split(' ')[0]}</div>
        </div>

        <div>
          <div class="flex items-center justify-between text-[11px] mb-1">
            <span class="text-slate-400">可用座位:</span>
            <span class="${session.availableSeatsCount > 0 ? 'text-emerald-400 font-bold' : 'text-red-400'} font-mono">
              ${session.availableSeatsCount > 0 ? `${session.availableSeatsCount} 个座位` : '已售罄 (待退票)'}
            </span>
          </div>
          <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full ${session.availableSeatsCount > 0 ? 'bg-emerald-400' : 'bg-red-500'}" style="width: ${session.availableSeatsCount > 0 ? seatsBarPercent : 0}%"></div>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        state.selectedShowtimeId = session.id;
        renderSessionCards(allShowtimes);
        // Load interactive seat map for this session
        const injectSeats = (session.availableSeatsCount > 0) ? ['M18', 'M19', 'N17', 'N18', 'L19', 'L20'] : [];
        seatMap.render(session, injectSeats);
      });

      sessionCardsContainer.appendChild(card);
    });

    // Auto-select first session if none selected
    if (!state.selectedShowtimeId && daySessions.length > 0) {
      state.selectedShowtimeId = daySessions[0].id;
      const injectSeats = (daySessions[0].availableSeatsCount > 0) ? ['M18', 'M19', 'N17', 'N18', 'L19', 'L20'] : [];
      seatMap.render(daySessions[0], injectSeats);
    }
  }

  function openLockedTicketModal(order) {
    const modal = document.getElementById('lockedTicketModal');
    document.getElementById('modalOrderId').textContent = order.orderId;
    document.getElementById('modalFilmTitle').textContent = order.filmTitle;
    document.getElementById('modalShowtimeInfo').textContent = `${order.date} (${order.dayOfWeek}) ${order.time} · ${order.screenName}`;
    document.getElementById('modalSeatsInfo').textContent = `${order.seatNames} (${order.seatCodes})`;
    document.getElementById('modalCustomerInfo').textContent = `${order.personalInfo.firstName} ${order.personalInfo.lastName} · ${order.personalInfo.phone}`;
    document.getElementById('modalTotalAmount').textContent = `$${order.totalAmount} AUD`;

    // 10:00 live countdown
    const countdownEl = document.getElementById('modalCountdownDisplay');
    let remainingMs = 10 * 60 * 1000;

    const timer = setInterval(() => {
      remainingMs -= 1000;
      if (remainingMs <= 0) {
        clearInterval(timer);
        countdownEl.textContent = '00:00 (锁票已超时)';
        return;
      }
      const mins = Math.floor(remainingMs / 60000);
      const secs = Math.floor((remainingMs % 60000) / 1000);
      countdownEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 1000);

    modal.classList.remove('hidden');
  }

  function initNotificationAndSoundUI() {
    updateWechatBadge();
    if ('Notification' in window && Notification.permission === 'granted') {
      document.getElementById('browserNotifyText').textContent = '桌面通知已就绪';
    }
  }

  function updateWechatBadge() {
    const cfg = window.notificationService.config;
    const badge = document.getElementById('wechatConfiguredBadge');
    if (cfg.pushplusToken || cfg.serverchanKey || cfg.barkKey) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function loadSavedForms() {
    const saved = localStorage.getItem('imax_sniper_user_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.personalInfo) {
          state.personalInfo = data.personalInfo;
          document.getElementById('inputFirstName').value = data.personalInfo.firstName || '';
          document.getElementById('inputLastName').value = data.personalInfo.lastName || '';
          document.getElementById('inputEmail').value = data.personalInfo.email || '';
          document.getElementById('inputPhone').value = data.personalInfo.phone || '';
        }
        if (data.paymentInfo) {
          state.paymentInfo = data.paymentInfo;
          document.getElementById('inputCardholder').value = data.paymentInfo.cardholder || '';
          document.getElementById('inputCardNumber').value = data.paymentInfo.cardNumber || '';
          document.getElementById('inputCardExpiry').value = data.paymentInfo.cardExpiry || '';
          document.getElementById('inputCardCvv').value = data.paymentInfo.cardCvv || '';
        }
        if (data.ticketCount) {
          state.ticketCount = data.ticketCount;
          document.getElementById('selectTicketCount').value = data.ticketCount;
        }
      } catch (e) {}
    }
  }

  function saveFormsToStorage() {
    localStorage.setItem('imax_sniper_user_data', JSON.stringify({
      personalInfo: state.personalInfo,
      paymentInfo: state.paymentInfo,
      ticketCount: state.ticketCount,
      ticketType: state.ticketType
    }));
  }
});
