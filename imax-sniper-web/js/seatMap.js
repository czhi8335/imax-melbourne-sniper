/**
 * Interactive Seat Map Component for Melbourne IMAX
 * Renders the accurate geometry of Melbourne IMAX (A to U rows, screen at top)
 */
class SeatMapRenderer {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = options;
    this.currentShowtime = null;
    this.seats = [];
    this.selectedSeatIds = new Set();
    this.onSeatSelectedCallback = options.onSeatSelected || null;
  }

  render(showtime, availableSeatIds = []) {
    this.currentShowtime = showtime;
    this.seats = window.IMAX_DATA.generateSeatMapForShowtime(showtime.id, availableSeatIds);
    this.selectedSeatIds.clear();

    if (!this.container) return;

    this.container.innerHTML = `
      <div class="seat-map-wrapper">
        <!-- Giant Screen Banner -->
        <div class="screen-container">
          <div class="screen-curve"></div>
          <div class="screen-label">
            <span class="screen-title">IMAX 70MM GIANT SCREEN</span>
            <span class="screen-dimensions">32 米宽 × 23 米高 · 全球第二大银幕</span>
          </div>
        </div>

        <!-- Seat Map Legend -->
        <div class="seat-legend">
          <div class="legend-item">
            <span class="seat-sample seat-available"></span>
            <span>可选普通座</span>
          </div>
          <div class="legend-item">
            <span class="seat-sample seat-top-prime"></span>
            <span>🌟 优选后排中间座</span>
          </div>
          <div class="legend-item">
            <span class="seat-sample seat-selected"></span>
            <span>🔵 选中/已锁定</span>
          </div>
          <div class="legend-item">
            <span class="seat-sample seat-soldout"></span>
            <span>🔴 已售罄</span>
          </div>
          <div class="legend-item">
            <span class="seat-sample seat-wheelchair"></span>
            <span>♿ 轮椅位 (自动排除)</span>
          </div>
          <div class="legend-item">
            <span class="seat-sample seat-companion"></span>
            <span>👥 陪同位 (自动排除)</span>
          </div>
        </div>

        <!-- Seats Grid -->
        <div class="seat-grid-scroll">
          <div class="seat-grid" id="seatGridInner"></div>
        </div>

        <!-- Hover / Selected Info Tooltip -->
        <div class="seat-info-bar" id="seatInfoBar">
          <span class="info-icon">💡</span>
          <span id="seatInfoText">鼠标悬停查看座位详情，点击可手动选座或点击“一键推荐最佳后排中间座”</span>
        </div>
      </div>
    `;

    const gridInner = document.getElementById('seatGridInner');
    const seatsByRow = {};
    this.seats.forEach(s => {
      if (!seatsByRow[s.row]) seatsByRow[s.row] = [];
      seatsByRow[s.row].push(s);
    });

    // Score all available seats
    const scoredSeats = window.TicketScorer ? window.TicketScorer.evaluateSeats(this.seats) : [];
    const topPrimeSeatIds = new Set(scoredSeats.filter(s => s.isTopPrime).map(s => s.id));

    // Render each row from front (A) to rear (U)
    window.IMAX_DATA.ROW_CONFIG.forEach(cfg => {
      const row = cfg.row;
      const rowSeats = seatsByRow[row] || [];
      const rowEl = document.createElement('div');
      rowEl.className = 'seat-row';
      rowEl.dataset.row = row;

      // Left Row Label
      const leftLabel = document.createElement('div');
      leftLabel.className = 'row-label';
      leftLabel.textContent = row;
      rowEl.appendChild(leftLabel);

      // Seats in row
      const seatsContainer = document.createElement('div');
      seatsContainer.className = 'seats-in-row';

      rowSeats.forEach(seat => {
        const seatBtn = document.createElement('button');
        seatBtn.className = `seat-btn seat-${seat.status.toLowerCase()}`;
        seatBtn.dataset.seatId = seat.id;
        seatBtn.dataset.row = seat.row;
        seatBtn.dataset.number = seat.number;
        seatBtn.dataset.type = seat.type;

        if (seat.type === 'Wheelchair') {
          seatBtn.classList.add('seat-wheelchair');
          seatBtn.innerHTML = '♿';
        } else if (seat.type === 'Companion') {
          seatBtn.classList.add('seat-companion');
          seatBtn.innerHTML = '👥';
        } else if (seat.status === 'Available') {
          if (topPrimeSeatIds.has(seat.id)) {
            seatBtn.classList.add('seat-top-prime');
            seatBtn.innerHTML = '★';
          } else {
            seatBtn.innerHTML = seat.number;
          }
        } else {
          seatBtn.innerHTML = '';
        }

        // Mouse hover event
        seatBtn.addEventListener('mouseenter', () => {
          this.updateSeatInfoText(seat);
        });

        // Click event
        seatBtn.addEventListener('click', () => {
          if (seat.status !== 'Available') return;
          if (seat.type === 'Wheelchair' || seat.type === 'Companion') {
            alert('系统已为您自动排除轮椅位与陪同位，请选择普通观影座位。');
            return;
          }
          this.toggleSeatSelection(seat);
        });

        seatsContainer.appendChild(seatBtn);
      });

      rowEl.appendChild(seatsContainer);

      // Right Row Label
      const rightLabel = document.createElement('div');
      rightLabel.className = 'row-label';
      rightLabel.textContent = row;
      rowEl.appendChild(rightLabel);

      gridInner.appendChild(rowEl);
    });
  }

  updateSeatInfoText(seat) {
    const infoText = document.getElementById('seatInfoText');
    if (!infoText) return;

    let typeText = '普通座';
    if (seat.type === 'Wheelchair') typeText = '轮椅位 (不可选)';
    if (seat.type === 'Companion') typeText = '陪同座 (不可选)';

    let statusText = seat.status === 'Available' ? '<span class="text-green-400 font-bold">空闲可选</span>' : '<span class="text-red-400">已售罄</span>';
    let primeTag = seat.isRear ? '<span class="badge-prime">🌟 后排黄金位</span>' : (seat.isFront ? '<span class="badge-front">前排近幕</span>' : '');

    infoText.innerHTML = `<strong>${seat.row} 排 ${seat.number} 座</strong> · 类型: ${typeText} · 状态: ${statusText} ${primeTag}`;
  }

  toggleSeatSelection(seat) {
    if (this.selectedSeatIds.has(seat.id)) {
      this.selectedSeatIds.delete(seat.id);
    } else {
      this.selectedSeatIds.add(seat.id);
    }
    this.refreshSelectionStyles();

    if (this.onSeatSelectedCallback) {
      this.onSeatSelectedCallback(Array.from(this.selectedSeatIds));
    }
  }

  selectSeats(seatIds) {
    this.selectedSeatIds = new Set(seatIds);
    this.refreshSelectionStyles();
    if (this.onSeatSelectedCallback) {
      this.onSeatSelectedCallback(Array.from(this.selectedSeatIds));
    }
  }

  refreshSelectionStyles() {
    const allBtns = this.container.querySelectorAll('.seat-btn');
    allBtns.forEach(btn => {
      const id = btn.dataset.seatId;
      if (this.selectedSeatIds.has(id)) {
        btn.classList.add('seat-selected');
      } else {
        btn.classList.remove('seat-selected');
      }
    });

    const infoText = document.getElementById('seatInfoText');
    if (infoText && this.selectedSeatIds.size > 0) {
      const seatsArr = Array.from(this.selectedSeatIds).join(', ');
      infoText.innerHTML = `🎯 <strong>已选座位 (${this.selectedSeatIds.size} 张):</strong> <span class="text-cyan-300 font-mono font-bold">${seatsArr}</span>`;
    }
  }

  // One-click select best rear-center seats
  autoSelectBestSeats(ticketCount = 1) {
    if (!window.TicketScorer) return [];
    const bestSeats = window.TicketScorer.findBestSeatCombination(this.seats, ticketCount);
    if (bestSeats && bestSeats.length > 0) {
      const ids = bestSeats.map(s => s.id);
      this.selectSeats(ids);
      return bestSeats;
    }
    return [];
  }
}

window.SeatMapRenderer = SeatMapRenderer;
