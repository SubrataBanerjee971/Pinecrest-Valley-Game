class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private fireGain: GainNode | null = null;
  private muted = false;
  private initialized = false;

  public init(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.45;
      this.masterGain.connect(this.ctx.destination);

      // Shared pink/brown-like noise buffer (3 seconds)
      const bufferSize = this.ctx.sampleRate * 3;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.14;
      }

      // Wind loop
      const windSrc = this.ctx.createBufferSource();
      windSrc.buffer = noiseBuffer;
      windSrc.loop = true;
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 260;
      this.windFilter.Q.value = 1.4;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.04;
      windSrc.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.masterGain);
      windSrc.start();

      // Rain loop
      const rainSrc = this.ctx.createBufferSource();
      rainSrc.buffer = noiseBuffer;
      rainSrc.loop = true;
      this.rainFilter = this.ctx.createBiquadFilter();
      this.rainFilter.type = 'highpass';
      this.rainFilter.frequency.value = 1100;
      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = 0;
      rainSrc.connect(this.rainFilter);
      this.rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.masterGain);
      rainSrc.start();

      // Hearth fire crackle loop
      const fireSrc = this.ctx.createBufferSource();
      fireSrc.buffer = noiseBuffer;
      fireSrc.loop = true;
      const fireFilter = this.ctx.createBiquadFilter();
      fireFilter.type = 'lowpass';
      fireFilter.frequency.value = 620;
      this.fireGain = this.ctx.createGain();
      this.fireGain.gain.value = 0;
      fireSrc.connect(fireFilter);
      fireFilter.connect(this.fireGain);
      this.fireGain.connect(this.masterGain);
      fireSrc.start();

      this.initialized = true;
    } catch {
      // Audio unavailable
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.45, this.ctx.currentTime, 0.08);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public updateAmbience(
    windSpeedMs: number,
    rainIntensity: number,
    isSnow: boolean,
    isSheltered: boolean,
    nearFire: boolean,
  ): void {
    if (!this.ctx || !this.windGain || !this.windFilter || !this.rainGain || !this.fireGain) return;
    const now = this.ctx.currentTime;
    const shelterDamp = isSheltered ? 0.32 : 1.0;

    const windVol = Math.min(0.28, (0.015 + windSpeedMs * 0.012) * shelterDamp);
    const windFreq = 180 + Math.min(600, windSpeedMs * 24) * (isSheltered ? 0.65 : 1);
    this.windGain.gain.setTargetAtTime(windVol, now, 0.4);
    this.windFilter.frequency.setTargetAtTime(windFreq, now, 0.4);

    const rainVol = isSnow ? 0 : Math.min(0.32, rainIntensity * 0.28 * shelterDamp);
    this.rainGain.gain.setTargetAtTime(rainVol, now, 0.35);

    const fireVol = nearFire ? 0.14 : 0;
    this.fireGain.gain.setTargetAtTime(fireVol, now, 0.25);
  }

  public playThunder(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(68, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 1.8);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160, now);
    filter.frequency.exponentialRampToValueAtTime(55, now + 1.9);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.38, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 2.3);
  }

  public playFootstep(surface: 'grass' | 'wood' | 'water' | 'snow'): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (surface === 'wood') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(145 + Math.random() * 25, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.08);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    } else if (surface === 'water') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320 + Math.random() * 140, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.14);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    } else if (surface === 'snow') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(210 + Math.random() * 40, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.09);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(105 + Math.random() * 20, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.08);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playChop(kind: 'wood' | 'stone' | 'gather'): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (kind === 'stone') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620 + Math.random() * 110, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.11);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    } else if (kind === 'wood') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190 + Math.random() * 35, now);
      osc.frequency.exponentialRampToValueAtTime(68, now + 0.14);
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.08);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playBuild(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(160, now);
    osc1.frequency.exponentialRampToValueAtTime(75, now + 0.14);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(320, now + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(480, now + 0.14);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);
    osc1.start(now);
    osc2.start(now + 0.04);
    osc1.stop(now + 0.19);
    osc2.stop(now + 0.19);
  }

  public playCoinSale(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [880, 1174.66, 1396.91];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playUiTone(freq = 520): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.07);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }
}

export const soundEngine = new ProceduralSoundEngine();
