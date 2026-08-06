/**
 * Синтезований звуковий рушій маркетингових сторінок.
 *
 * Жодного .mp3 у репозиторії: усі звуки будуються осциляторами Web Audio
 * просто в браузері. Причини дві — нема бінарних ассетів у git і нема
 * мережевого запиту перед першим звуком; дизеля на 40 Гц усе одно
 * не стиснути краще, ніж описати трьома осциляторами.
 *
 * Політика автовідтворення: AudioContext у всіх сучасних браузерах
 * створюється у стані `suspended`, і `resume()` спрацює лише всередині
 * жесту користувача. Тому рушій НІКОЛИ не обіцяє, що звук уже грає, —
 * він тримає бажаний стан і доганяє його, щойно жест стався (див.
 * `unlock()` у SoundContext).
 */

export type SoundName =
  | 'arrive'    // секція доїхала у в'юпорт
  | 'tick'      // дрібна засічка (лічильник, крок таймлайна)
  | 'whoosh'    // перехід між секціями
  | 'rev'       // акцент на великій цифрі
  | 'hover'     // наведення на інтерактив
  | 'confirm';  // підтвердження дії

/*
  Палітра навмисно НЕ музична.

  Дзвіночки й висхідні синуси читаються як сповіщення застосунку — «пік»,
  «свист», — і на сторінці про тягачі звучать чужорідно. Тут усе будується
  з трьох матеріалів, які реально чути біля вантажівки: глухий удар маси,
  клац реле й пневматичний випуск повітря.

  Основний прийом — швидке падіння висоти плюс шумовий транзієнт на атаці:
  саме так вухо впізнає «щось важке село на місце», а не «прилад пікнув».
*/

/** Базові частоти ударів для послідовних секцій — донизу сторінки глухіше. */
const THUD_TONES = [150, 138, 128, 120, 112, 104];

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineBus: GainNode | null = null;
  private engineNodes: { stop: () => void } | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private volume = 0.5;
  private muted = true;
  /** Скільки разів поспіль звучала 'arrive' — щоб підіймати тон по секціях. */
  private arriveStep = 0;

  // ── Життєвий цикл ────────────────────────────────────────────────────────

  /** Створює контекст. Безпечно викликати багато разів. */
  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;

    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;

    const ctx = new Ctor();
    this.ctx = ctx;

    // Компресор тримає пікові звуки в межах: без нього 'rev' поверх гулу
    // двигуна кліпував на повній гучності.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : this.volume;
    master.connect(comp);
    comp.connect(ctx.destination);
    this.master = master;

    const engineBus = ctx.createGain();
    engineBus.gain.value = 0;
    engineBus.connect(master);
    this.engineBus = engineBus;

    this.noiseBuffer = this.buildNoise(ctx);
    return ctx;
  }

  /**
   * Має викликатись із обробника жесту користувача. Повертає true, якщо
   * контекст справді запустився.
   */
  async unlock(): Promise<boolean> {
    const ctx = this.ensure();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    return ctx.state === 'running';
  }

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  // ── Гучність ─────────────────────────────────────────────────────────────

  setVolume(value: number) {
    this.volume = Math.min(1, Math.max(0, value));
    this.applyMaster();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyMaster();
  }

  private applyMaster() {
    if (!this.ctx || !this.master) return;
    const target = this.muted ? 0 : this.volume;
    // Рампа, а не стрибок: миттєва зміна gain дає чутний клац.
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  // ── Шумовий буфер ────────────────────────────────────────────────────────

  /**
   * Коричневий шум (інтегрований білий): у нього спадний спектр, тому він
   * читається як «повітря/гравій», а не як телевізійна крупа.
   */
  private buildNoise(ctx: AudioContext): AudioBuffer {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buf;
  }

  private noiseSource(ctx: AudioContext): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    return src;
  }

  // ── Гул двигуна ──────────────────────────────────────────────────────────

  /**
   * Холостий хід дизеля: дві розстроєні пилки дають биття (те саме
   * «туркотіння»), квадрат згори додає гармоніку, шум — фактуру повітря.
   * LFO злегка водить фільтр і гучність, інакше петля звучить як синтезатор,
   * а не як залізо.
   */
  startEngine() {
    const ctx = this.ensure();
    if (!ctx || !this.engineBus || this.engineNodes) return;

    const now = ctx.currentTime;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 170;
    lp.Q.value = 3;
    lp.connect(this.engineBus);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 47;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 48.6; // ~1.6 Гц биття

    const osc3 = ctx.createOscillator();
    osc3.type = 'square';
    osc3.frequency.value = 94;

    const g1 = ctx.createGain(); g1.gain.value = 0.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.42;
    const g3 = ctx.createGain(); g3.gain.value = 0.1;

    osc1.connect(g1); g1.connect(lp);
    osc2.connect(g2); g2.connect(lp);
    osc3.connect(g3); g3.connect(lp);

    const noise = this.noiseSource(ctx);
    const noiseLp = ctx.createBiquadFilter();
    noiseLp.type = 'lowpass';
    noiseLp.frequency.value = 420;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.055;
    noise.connect(noiseLp); noiseLp.connect(noiseGain); noiseGain.connect(this.engineBus);

    // Повільне «дихання» холостого ходу
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1.15;
    const lfoFilter = ctx.createGain();
    lfoFilter.gain.value = 28;
    lfo.connect(lfoFilter);
    lfoFilter.connect(lp.frequency);

    osc1.start(now); osc2.start(now); osc3.start(now);
    noise.start(now); lfo.start(now);

    // Довгий фейд-ін: різкий старт гулу лякає.
    this.engineBus.gain.cancelScheduledValues(now);
    this.engineBus.gain.setValueAtTime(0.0001, now);
    this.engineBus.gain.exponentialRampToValueAtTime(0.16, now + 2.6);

    this.engineNodes = {
      stop: () => {
        const t = ctx.currentTime;
        this.engineBus?.gain.cancelScheduledValues(t);
        this.engineBus?.gain.setValueAtTime(this.engineBus.gain.value || 0.0001, t);
        this.engineBus?.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        const kill = t + 0.8;
        [osc1, osc2, osc3, lfo].forEach(o => { try { o.stop(kill); } catch {} });
        try { noise.stop(kill); } catch {}
      },
    };
  }

  stopEngine() {
    this.engineNodes?.stop();
    this.engineNodes = null;
  }

  get engineRunning(): boolean {
    return this.engineNodes !== null;
  }

  /** Короткий підгаз — акцент на великій цифрі. */
  private rev(ctx: AudioContext, out: AudioNode) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    const g = ctx.createGain();

    osc.frequency.setValueAtTime(52, now);
    osc.frequency.exponentialRampToValueAtTime(128, now + 0.22);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.75);

    lp.frequency.setValueAtTime(200, now);
    lp.frequency.exponentialRampToValueAtTime(900, now + 0.22);
    lp.frequency.exponentialRampToValueAtTime(240, now + 0.75);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.22, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    osc.connect(lp); lp.connect(g); g.connect(out);
    osc.start(now); osc.stop(now + 0.85);
  }

  // ── Разові звуки ─────────────────────────────────────────────────────────

  play(name: SoundName) {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted || ctx.state !== 'running') return;

    switch (name) {
      case 'arrive':   return this.arrive(ctx, this.master);
      case 'tick':     return this.tick(ctx, this.master);
      case 'whoosh':   return this.whoosh(ctx, this.master);
      case 'rev':      return this.rev(ctx, this.master);
      case 'hover':    return this.hover(ctx, this.master);
      case 'confirm':  return this.confirm(ctx, this.master);
    }
  }

  /** Скидає висоту 'arrive' на початок гами (при вході на нову сторінку). */
  resetSequence() {
    this.arriveStep = 0;
  }

  /**
   * Короткий шумовий транзієнт — «матеріал» удару.
   *
   * Сам синус звучить як тон, а не як предмет. Вухо впізнає масу саме за
   * шумовим сплеском на атаці, тож кожен удар склеєний із двох шарів.
   */
  private transient(
    ctx: AudioContext, out: AudioNode,
    { at, freq, q, gain, dur, type = 'lowpass' as BiquadFilterType },
  ) {
    const src = this.noiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter); filter.connect(g); g.connect(out);
    src.start(at); src.stop(at + dur + 0.02);
  }

  /**
   * Глухий удар — щось важке стало на місце.
   *
   * Висота падає майже вдвічі за чверть секунди: без цього падіння це просто
   * низький тон, з ним — удар. Кожна наступна секція звучить глухіше, тож
   * прокрутка вниз відчувається як рух углиб, а не як повтор того самого.
   */
  private arrive(ctx: AudioContext, out: AudioNode) {
    const now = ctx.currentTime;
    const base = THUD_TONES[this.arriveStep % THUD_TONES.length];
    this.arriveStep++;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 0.52, now + 0.26);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.24, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);

    osc.connect(g); g.connect(out);
    osc.start(now); osc.stop(now + 0.68);

    this.transient(ctx, out, { at: now, freq: 520, q: 0.7, gain: 0.1, dur: 0.07 });
  }

  /** Клац реле: сухий, короткий, без дзвону. */
  private tick(ctx: AudioContext, out: AudioNode) {
    const now = ctx.currentTime;
    this.transient(ctx, out, {
      at: now, freq: 900, q: 11, gain: 0.075, dur: 0.02, type: 'bandpass',
    });

    // Невелике тіло під клацом — інакше він звучить як статичний тріск.
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.055, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    osc.connect(g); g.connect(out);
    osc.start(now); osc.stop(now + 0.07);
  }

  /**
   * Випуск повітря з гальмівної системи.
   *
   * Смуга їде згори вниз, а не знизу вгору: висхідний свіп читається як
   * «запуск» чи свист, спадний — саме як стравлювання тиску.
   */
  private whoosh(ctx: AudioContext, out: AudioNode) {
    const now = ctx.currentTime;
    const src = this.noiseSource(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(1900, now);
    bp.frequency.exponentialRampToValueAtTime(280, now + 0.5);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.085, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    src.connect(bp); bp.connect(g); g.connect(out);
    src.start(now); src.stop(now + 0.65);
  }

  /** Ледь чутний дотик — на ховері будь-що гучніше швидко набридає. */
  private hover(ctx: AudioContext, out: AudioNode) {
    this.transient(ctx, out, {
      at: ctx.currentTime, freq: 1500, q: 6, gain: 0.022, dur: 0.014, type: 'bandpass',
    });
  }

  /** Клацання засувки: два удари, важчий другий. */
  private confirm(ctx: AudioContext, out: AudioNode) {
    const now = ctx.currentTime;
    [
      { at: now,         f: 210, gain: 0.1,  dur: 0.09 },
      { at: now + 0.075, f: 105, gain: 0.16, dur: 0.34 },
    ].forEach(({ at, f, gain, dur }) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, at);
      osc.frequency.exponentialRampToValueAtTime(f * 0.6, at + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(gain, at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(g); g.connect(out);
      osc.start(at); osc.stop(at + dur + 0.03);
    });

    this.transient(ctx, out, { at: now + 0.075, freq: 700, q: 0.8, gain: 0.07, dur: 0.05 });
  }

  /** Повне вимкнення — при розмонтуванні провайдера. */
  dispose() {
    this.stopEngine();
    try { void this.ctx?.close(); } catch {}
    this.ctx = null;
    this.master = null;
    this.engineBus = null;
  }
}
