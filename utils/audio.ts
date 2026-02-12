// Retro ses sentezleyicisi
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private musicInterval: number | null = null;
  private tempo: number = 200; // ms per beat
  private noteIndex: number = 0;
  private isMuted: boolean = false;

  constructor() {
    // Tarayıcı uyumluluğu için
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3; // Genel ses seviyesi
      this.masterGain.connect(this.ctx.destination);
    }
  }

  public async init() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.startEngineSound();
  }

  public setMute(mute: boolean) {
    this.isMuted = mute;
    if (this.masterGain) {
      this.masterGain.gain.value = mute ? 0 : 0.3;
    }
  }

  // --- Motor Sesi ---
  private startEngineSound() {
    if (!this.ctx || !this.masterGain) return;
    
    // Eğer zaten varsa durdurma, sadece parametreleri güncelle
    if (this.engineOsc) return;

    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60; // Rölanti
    
    // Motor sesi çok düşük olmalı
    this.engineGain.gain.value = 0.05;
    
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    this.engineOsc.start();
  }

  public updateEnginePitch(speed: number, isMovingHorizontally: boolean) {
    if (!this.engineOsc || !this.ctx) return;
    
    const baseFreq = 60 + (speed * 5);
    const targetFreq = isMovingHorizontally ? baseFreq + 20 : baseFreq;
    
    // Yumuşak geçiş
    this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
  }

  public stopEngine() {
    if (this.engineOsc) {
      this.engineOsc.stop();
      this.engineOsc.disconnect();
      this.engineOsc = null;
    }
  }

  // --- Efektler ---
  
  public playShoot() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Lazer/Ateş sesi: Yüksek frekanstan düşüğe hızlı geçiş
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  public playCollect() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.1); // A6
    
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // Yakıt dolum sesi
  public playRefuel() {
      if (!this.ctx || !this.masterGain || this.isMuted) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime); // A3
      
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
  }

  // Can kazanma sesi (Mario 1-up benzeri bir arpej)
  public playOneUp() {
      if (!this.ctx || !this.masterGain || this.isMuted) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.1); // G5
      osc.frequency.setValueAtTime(1318.51, now + 0.2); // E6
      osc.frequency.setValueAtTime(1567.98, now + 0.3); // G6
      osc.frequency.setValueAtTime(2093.00, now + 0.4); // C7
      osc.frequency.setValueAtTime(2637.02, now + 0.5); // E7

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.5);
      gain.gain.linearRampToValueAtTime(0, now + 0.6);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(now + 0.6);
  }

  public playExplosion() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    
    const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 saniye
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    
    noise.connect(gain);
    gain.connect(this.masterGain);
    noise.start();
  }

  public playSludge() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  public playGameOver() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, this.ctx.currentTime + 1.5);
    
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 1.5);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 1.5);
  }

  // --- Müzik ---
  
  public startMusic() {
    if (this.musicInterval) return;
    this.noteIndex = 0;
    this.scheduleNote();
  }

  public stopMusic() {
    if (this.musicInterval) {
      window.clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }
    this.stopEngine();
  }

  public setMusicIntensity(gameSpeed: number) {
    const newTempo = Math.max(80, 240 - (gameSpeed * 15));
    this.tempo = newTempo;
  }

  private scheduleNote() {
    if (!this.ctx || !this.masterGain || this.isMuted) {
        this.musicInterval = window.setTimeout(() => this.scheduleNote(), this.tempo);
        return;
    }

    const notes = [65.41, 65.41, 87.31, 98.00]; 
    const freq = notes[this.noteIndex % notes.length];
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.value = freq;
    
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);

    this.noteIndex++;
    this.musicInterval = window.setTimeout(() => this.scheduleNote(), this.tempo);
  }
}

export const soundManager = new SoundEngine();