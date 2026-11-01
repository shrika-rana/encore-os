// Web Audio playback engine: pad + bass + arpeggio + soft kick, with a
// generated reverb tail. Uses a look-ahead scheduler for tight timing.

import { Chord, midiToFreq, voiceChord } from './theory';

export interface PlaybackStep {
  sectionIndex: number;
  chordIndex: number;
  chord: Chord;
}

type StepListener = (step: PlaybackStep | null) => void;

export class SongPlayer {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private timer: number | null = null;
  private uiTimers: number[] = [];
  private steps: PlaybackStep[] = [];
  private stepIndex = 0;
  private nextBarTime = 0;
  private bpm = 90;
  private loop = true;
  private listener: StepListener = () => {};
  public isPlaying = false;

  private ensureContext(): AudioContext {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(comp).connect(ctx.destination);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(ctx, 2.8, 2.2);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb).connect(this.master);
    this.ctx = ctx;
    return ctx;
  }

  private makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  onStep(listener: StepListener) {
    this.listener = listener;
  }

  async play(steps: PlaybackStep[], bpm: number, loop = true) {
    if (steps.length === 0) return;
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') await ctx.resume();
    this.stop();
    this.steps = steps;
    this.bpm = bpm;
    this.loop = loop;
    this.stepIndex = 0;
    this.nextBarTime = ctx.currentTime + 0.08;
    this.isPlaying = true;
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.uiTimers.forEach((t) => window.clearTimeout(t));
    this.uiTimers = [];
    if (this.isPlaying && this.ctx) {
      // quick fade so voices don't click
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0, now + 0.12);
      this.master.gain.linearRampToValueAtTime(0.7, now + 0.3);
    }
    this.isPlaying = false;
    this.listener(null);
  }

  /** Strum a single chord, used when auditioning substitutions */
  async preview(chord: Chord) {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = ctx.currentTime + 0.02;
    const { bass, upper } = voiceChord(chord);
    this.pad(upper, t, 1.6, 0.11);
    this.bass(bass, t, 1.4);
    upper.forEach((n, i) => this.pluck(n + 12, t + i * 0.045, 0.9, 0.09));
  }

  private schedule() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const barLen = (60 / this.bpm) * 4;
    while (this.nextBarTime < ctx.currentTime + 0.15) {
      if (this.stepIndex >= this.steps.length) {
        if (!this.loop) {
          const endAt = this.nextBarTime;
          this.uiTimers.push(window.setTimeout(() => this.stop(), Math.max(0, (endAt - ctx.currentTime) * 1000)));
          if (this.timer !== null) window.clearInterval(this.timer);
          this.timer = null;
          return;
        }
        this.stepIndex = 0;
      }
      const step = this.steps[this.stepIndex];
      this.scheduleBar(step.chord, this.nextBarTime, barLen);
      const delay = Math.max(0, (this.nextBarTime - ctx.currentTime) * 1000);
      this.uiTimers.push(window.setTimeout(() => this.listener(step), delay));
      this.nextBarTime += barLen;
      this.stepIndex++;
    }
    // prune finished UI timers
    if (this.uiTimers.length > 64) this.uiTimers = this.uiTimers.slice(-16);
  }

  private scheduleBar(chord: Chord, t: number, barLen: number) {
    const beat = barLen / 4;
    const { bass, upper } = voiceChord(chord);
    this.pad(upper, t, barLen * 0.98, 0.07);
    this.bass(bass, t, beat * 1.8);
    this.bass(bass, t + beat * 2, beat * 1.6);
    // 8th-note arpeggio across the upper voicing, one octave up
    const arp = [...upper, upper[1] ?? upper[0], ...upper.slice().reverse()].map((n) => n + 12);
    for (let i = 0; i < 8; i++) this.pluck(arp[i % arp.length], t + i * (beat / 2), beat * 0.9, 0.05);
    this.kick(t);
    this.kick(t + beat * 2);
  }

  private pad(notes: number[], t: number, dur: number, level: number) {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.linearRampToValueAtTime(1800, t + dur * 0.5);
    filter.Q.value = 0.6;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(level, t + 0.18);
    env.gain.setValueAtTime(level, t + dur - 0.25);
    env.gain.linearRampToValueAtTime(0, t + dur);
    filter.connect(env);
    env.connect(this.master);
    env.connect(this.reverbSend);
    notes.forEach((n) => {
      [-6, 6].forEach((detune) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midiToFreq(n);
        o.detune.value = detune;
        o.connect(filter);
        o.start(t);
        o.stop(t + dur + 0.05);
      });
    });
  }

  private bass(note: number, t: number, dur: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = midiToFreq(note - 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private pluck(note: number, t: number, dur: number, level: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = midiToFreq(note);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g);
    g.connect(this.master);
    g.connect(this.reverbSend);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.42, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.32);
  }
}

export const player = new SongPlayer();
