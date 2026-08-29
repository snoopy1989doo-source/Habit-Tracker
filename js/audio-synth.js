/**
 * PIXEL QUEST - AUDIO SYNTHESIZER
 * Web Audio API Retro Chiptune Sound Generator (Zero External Assets)
 */

window.PixelAudio = (function () {
  let audioCtx = null;

  function getContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, type, duration, delay = 0, gainVal = 0.1) {
    const ctx = getContext();
    if (!ctx) return;

    setTimeout(() => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(gainVal, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {
        // Ignore audio playback context errors
      }
    }, delay * 1000);
  }

  function playCheckSound() {
    playTone(523.25, 'square', 0.08, 0, 0.15); // C5
    playTone(659.25, 'square', 0.12, 0.08, 0.15); // E5
    playTone(1046.50, 'triangle', 0.2, 0.18, 0.2); // C6
  }

  function playUncheckSound() {
    playTone(440, 'sawtooth', 0.1, 0, 0.12);
    playTone(330, 'square', 0.15, 0.08, 0.12);
  }

  function playClickSound() {
    playTone(800, 'square', 0.03, 0, 0.05);
  }

  function playLevelUpSound() {
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, idx) => {
      playTone(freq, 'triangle', 0.15, idx * 0.07, 0.15);
    });
  }

  function playFocusCompleteSound() {
    const arpeggio = [523.25, 659.25, 783.99, 1046.50, 1046.50, 1318.51, 1567.98];
    arpeggio.forEach((freq, idx) => {
      playTone(freq, idx > 4 ? 'square' : 'triangle', 0.2, idx * 0.1, 0.18);
    });
  }

  return {
    playCheckSound,
    playUncheckSound,
    playClickSound,
    playLevelUpSound,
    playFocusCompleteSound
  };
})();
