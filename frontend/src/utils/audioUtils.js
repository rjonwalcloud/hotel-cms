/**
 * Plays a notification chime using the Web Audio API.
 * This avoids the need for external audio assets.
 */
export const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    const playNote = (frequency, startTime, duration) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startTime);

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    // Play a "ding-dong" chime
    const now = audioContext.currentTime;
    playNote(880, now, 0.5); // A5
    playNote(659.25, now + 0.15, 0.5); // E5
    
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
};
