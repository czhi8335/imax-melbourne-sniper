/**
 * Melbourne IMAX Dataset & Seat Layout
 * Models Melbourne IMAX's giant screen auditorium and film schedule.
 */
const IMAX_FILMS = [
  {
    id: 'HO00000547',
    title: 'THE ODYSSEY: IMAX 70MM PRESENTATION',
    format: 'IMAX 70MM',
    badge: '15/70MM 胶片限定',
    runtime: '185 分钟',
    rating: 'MA15+',
    poster: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&auto=format&fit=crop',
    synopsis: '克里斯托弗·诺兰与 IMAX 团队联合重制的史诗巨作，采用纯正 70mm 胶片放映，展现无与伦比的 1.43:1 画幅与胶片质感。',
    price: { adult: 42.0, concession: 38.0, child: 32.0, member: 35.0 },
    dates: ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']
  },
  {
    id: 'HO00000512',
    title: 'INTERSTELLAR: IMAX 70MM PRESENTATION',
    format: 'IMAX 70MM',
    badge: '15/70MM 传奇重映',
    runtime: '169 分钟',
    rating: 'M',
    poster: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=600&auto=format&fit=crop',
    synopsis: '星际穿越十周年特别放映，墨尔本全球第二大银幕完整呈现虫洞穿梭与黑洞视界震撼音效。',
    price: { adult: 40.0, concession: 36.0, child: 30.0, member: 34.0 },
    dates: ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-09', '2026-10-10']
  },
  {
    id: 'HO00000498',
    title: 'DUNE: PART TWO: THE IMAX EXPERIENCE',
    format: 'IMAX LASER',
    badge: '4K 双激光 1.43:1',
    runtime: '166 分钟',
    rating: 'M',
    poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop',
    synopsis: '沙丘2 全画幅特制，体验厄拉科斯星球沙漠浩瀚全景。',
    price: { adult: 38.0, concession: 34.0, child: 28.0, member: 32.0 },
    dates: ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']
  }
];

// Generate Showtimes for Melbourne IMAX
function generateShowtimes(filmId) {
  const film = IMAX_FILMS.find(f => f.id === filmId) || IMAX_FILMS[0];
  const showtimes = [];

  film.dates.forEach(dateStr => {
    const d = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = d.getDay(); // 0: Sun, 1: Mon, ..., 5: Fri, 6: Sat
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const isFriOrSat = dayOfWeek === 5 || dayOfWeek === 6;

    // Define schedule slots
    const slots = isFriOrSat
      ? [
          { time: '10:30', hour: 10, min: 30, tag: '上午场' },
          { time: '14:00', hour: 14, min: 0, tag: '下午场' },
          { time: '17:30', hour: 17, min: 30, tag: '傍晚场' },
          { time: '21:00', hour: 21, min: 0, tag: '黄金夜场' }
        ]
      : [
          { time: '12:30', hour: 12, min: 30, tag: '午间场' },
          { time: '15:45', hour: 15, min: 45, tag: '下午场' },
          { time: '18:30', hour: 18, min: 30, tag: '晚场' },
          { time: '21:45', hour: 21, min: 45, tag: '深夜场' }
        ];

    slots.forEach((slot, index) => {
      const showtimeId = `ST-${filmId}-${dateStr.replace(/-/g, '')}-${slot.hour}${slot.min}`;
      const passesTimeFilter = isFriOrSat || slot.hour >= 18;

      // Realistic remaining seats simulation
      let totalRemaining;
      if (film.id === 'HO00000547' && isFriOrSat) {
        // High demand: very few or initially 0, triggers refund/drop detection
        totalRemaining = (dateStr === '2026-10-02' && slot.hour === 21) ? 2 : (index % 2 === 0 ? 0 : 3);
      } else {
        totalRemaining = slot.hour >= 18 ? 4 : 12;
      }

      showtimes.push({
        id: showtimeId,
        filmId: film.id,
        filmTitle: film.title,
        date: dateStr,
        dayOfWeek: dayNames[dayOfWeek],
        dayOfWeekNumber: dayOfWeek,
        isWeekendOrFri: isFriOrSat,
        time: slot.time,
        startsAt: `${dateStr}T${slot.time}:00+10:00`,
        slotTag: slot.tag,
        screenName: 'IMAX 70MM 巨幕厅 (32m x 23m)',
        passesTimeFilter,
        totalSeats: 480,
        availableSeatsCount: totalRemaining,
        isSoldOut: totalRemaining === 0,
      });
    });
  });

  return showtimes;
}

// Full Auditorium Layout for Melbourne IMAX
// Rows from front to back: A (front row) to U (rear row)
// Best viewing row: H, J, K, L, M, N, P, Q
const ROW_CONFIG = [
  { row: 'A', seats: 26, isFront: true },
  { row: 'B', seats: 28, isFront: true },
  { row: 'C', seats: 30, isFront: true },
  { row: 'D', seats: 32, isFront: true },
  { row: 'E', seats: 34, isMidLower: true },
  { row: 'F', seats: 36, isMidLower: true },
  { row: 'G', seats: 34, isMidLower: true, hasWheelchair: true },
  { row: 'H', seats: 36, isMidPrime: true },
  { row: 'J', seats: 36, isMidPrime: true },
  { row: 'K', seats: 36, isPrime: true },
  { row: 'L', seats: 36, isPrime: true },
  { row: 'M', seats: 36, isPrime: true, isRear: true },
  { row: 'N', seats: 36, isPrime: true, isRear: true },
  { row: 'P', seats: 36, isPrime: true, isRear: true, hasWheelchair: true },
  { row: 'Q', seats: 36, isRear: true },
  { row: 'R', seats: 34, isRear: true },
  { row: 'S', seats: 32, isBack: true },
  { row: 'T', seats: 30, isBack: true },
  { row: 'U', seats: 28, isBack: true }
];

function generateSeatMapForShowtime(showtimeId, injectAvailableSeats = []) {
  const seats = [];

  ROW_CONFIG.forEach(cfg => {
    const row = cfg.row;
    const count = cfg.seats;
    const center = (count + 1) / 2;

    for (let num = 1; num <= count; num++) {
      const seatId = `${row}${num}`;
      let type = 'Normal';
      let status = 'Unavailable'; // Default sold out in popular 70mm sessions

      // Wheelchair & Companion placements
      if (cfg.hasWheelchair) {
        if (num === 1 || num === count) {
          type = 'Wheelchair';
          status = 'Available';
        } else if (num === 2 || num === count - 1) {
          type = 'Companion';
          status = 'Available';
        }
      }

      // Check if this seat is explicitly made available
      if (injectAvailableSeats.includes(seatId)) {
        status = 'Available';
        type = 'Normal';
      }

      const centerDistance = Math.abs(num - center);

      seats.push({
        id: seatId,
        row,
        number: num,
        type, // 'Normal' | 'Wheelchair' | 'Companion'
        status, // 'Available' | 'Unavailable' | 'Selected' | 'Locked'
        centerDistance,
        isRear: !!(cfg.isPrime && cfg.isRear) || cfg.isRear,
        isFront: !!cfg.isFront,
        isWheelchair: type === 'Wheelchair',
        isCompanion: type === 'Companion'
      });
    }
  });

  return seats;
}

window.IMAX_DATA = {
  films: IMAX_FILMS,
  generateShowtimes,
  generateSeatMapForShowtime,
  ROW_CONFIG
};
