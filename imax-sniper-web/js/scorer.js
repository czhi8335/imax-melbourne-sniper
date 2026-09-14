/**
 * Ticket Scorer & Showtime Evaluator
 * Enforces the user's specific rules:
 *  1. Time filter: Friday & Saturday (all day) OR other 5 days after 18:00 (>= 18:00).
 *  2. Non-wheelchair / non-companion seats only.
 *  3. Rear rows & middle columns prioritized.
 *  4. Adjacent seat pairing for multiple tickets.
 */

// Row weights for Melbourne IMAX: A (front) to U (rear)
const ROW_WEIGHTS = {
  'M': 10.0, // Absolute Prime Rear Center
  'L': 9.8,
  'N': 9.8,
  'K': 9.5,
  'P': 9.3,
  'J': 9.0,
  'Q': 8.7,
  'H': 8.5,
  'R': 8.0,
  'G': 7.0,
  'S': 6.8,
  'F': 6.0,
  'T': 5.8,
  'E': 5.0,
  'U': 4.8,
  'D': 3.5,
  'C': 2.5,
  'B': 1.5,
  'A': 1.0
};

class TicketScorer {
  /**
   * Check if a showtime matches the user's time requirements:
   *  - Friday (day 5) or Saturday (day 6): any time
   *  - Sunday, Monday, Tuesday, Wednesday, Thursday: starts at or after 18:00
   */
  static matchesTimeRequirement(showtime, customRules = {}) {
    const d = new Date(showtime.startsAt);
    const dayOfWeek = d.getDay(); // 0: Sun, 1: Mon, ..., 5: Fri, 6: Sat
    const hour = d.getHours();
    const minute = d.getMinutes();

    const isFridayOrSaturday = dayOfWeek === 5 || dayOfWeek === 6;

    // Rule 1: Friday or Saturday all day
    if (isFridayOrSaturday) {
      return true;
    }

    // Rule 2: Other 5 days after 18:00 (6:00 PM)
    if (hour > 18 || (hour === 18 && minute >= 0)) {
      return true;
    }

    return false;
  }

  /**
   * Filter and score individual seats.
   * Returns only valid normal seats sorted by score descending.
   */
  static evaluateSeats(seats) {
    const validSeats = seats.filter(s => {
      // 1. Must be Available
      if (s.status !== 'Available') return false;

      // 2. Must NOT be Wheelchair or Companion
      if (s.type === 'Wheelchair' || s.isWheelchair) return false;
      if (s.type === 'Companion' || s.isCompanion) return false;

      return true;
    });

    // Calculate score for each seat
    const scoredSeats = validSeats.map(seat => {
      const rowWeight = ROW_WEIGHTS[seat.row] || 5.0;
      // Center penalty: distance to row center
      const centerPenalty = seat.centerDistance * 1.6;
      // Raw score between 0 and 100
      const score = Math.max(0, Math.min(100, Math.round((rowWeight * 10 - centerPenalty) * 10) / 10));

      return {
        ...seat,
        score,
        isTopPrime: rowWeight >= 9.0 && seat.centerDistance <= 4
      };
    });

    // Sort highest score first
    return scoredSeats.sort((a, b) => b.score - a.score);
  }

  /**
   * Find best seat combination for N tickets.
   * If ticketCount > 1, strongly prioritizes adjacent seats in the same row!
   */
  static findBestSeatCombination(seats, ticketCount = 1) {
    const scoredSeats = this.evaluateSeats(seats);
    if (scoredSeats.length < ticketCount) {
      return null;
    }

    if (ticketCount === 1) {
      return [scoredSeats[0]];
    }

    // For multi-tickets: search for adjacent seats in the same row
    const seatsByRow = {};
    scoredSeats.forEach(s => {
      if (!seatsByRow[s.row]) seatsByRow[s.row] = [];
      seatsByRow[s.row].push(s);
    });

    let bestGroup = null;
    let bestAvgScore = -1;

    // 1. Check contiguous blocks in each row
    for (const row in seatsByRow) {
      const rowSeats = seatsByRow[row].sort((a, b) => a.number - b.number);
      for (let i = 0; i <= rowSeats.length - ticketCount; i++) {
        const candidateGroup = rowSeats.slice(i, i + ticketCount);
        // Check if contiguous (e.g. 18, 19, 20)
        let isContiguous = true;
        for (let j = 0; j < candidateGroup.length - 1; j++) {
          if (candidateGroup[j + 1].number !== candidateGroup[j].number + 1) {
            isContiguous = false;
            break;
          }
        }

        if (isContiguous) {
          const avgScore = candidateGroup.reduce((sum, s) => sum + s.score, 0) / ticketCount;
          // Contiguous bonus +15 pts
          const totalEffectiveScore = avgScore + 15;
          if (totalEffectiveScore > bestAvgScore) {
            bestAvgScore = totalEffectiveScore;
            bestGroup = candidateGroup;
          }
        }
      }
    }

    // 2. Fallback: if no contiguous seats found, take top N highest individual scored seats
    if (!bestGroup) {
      bestGroup = scoredSeats.slice(0, ticketCount);
    }

    return bestGroup;
  }
}

window.TicketScorer = TicketScorer;
