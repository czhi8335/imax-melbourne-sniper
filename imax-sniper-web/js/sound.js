/**
 * Web Audio API Sound Generator for IMAX Ticket Sniper
 * Generates custom synthesized sounds without external audio assets.
 */
class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;
    this.alarmInterval = null;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (muted && this.alarmInterval) {
      this.stopAlarm();
    }
  }

  // Play a quick test sound
  playTestBeep() {
    if (this.isMuted) return;
    this.init();
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Play success chime (chord)
  playSuccessChime() {
    if (this.isMuted) return;
    this.init();
    const now = this.audioCtx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    freqs.forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.25, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.6);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.6);
    });
  }

  // Play high-urgency ticket lock alarm (repeating alert)
  startTicketLockedAlarm() {
    if (this.isMuted) return;
    this.stopAlarm();
    this.init();

    const triggerBurst = () => {
      if (this.isMuted) return;
      const now = this.audioCtx.currentTime;

      // Two-tone high-pitch urgent siren
      const tones = [987.77, 1318.51, 987.77, 1318.51]; // B5, E6, B5, E6
      tones.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0.3, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.12 + 0.11);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.12);
      });
    };

    triggerBurst();
    this.alarmInterval = setInterval(triggerBurst, 1000);
  }

  stopAlarm() {
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }
}

window.soundEngine = new SoundEngine();
