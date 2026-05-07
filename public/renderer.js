/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  AI VIDEO RENDERER — Canvas-based cinematic video engine               ║
 * ║  Handles: animation, transitions, particle FX, typography               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

class VideoRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;

    // State
    this.scenes = [];
    this.currentSceneIdx = -1;
    this.animFrame = null;
    this.sceneStartTime = 0;
    this.globalTime = 0;
    this.phase = 'idle'; // idle | entering | displaying | exiting
    this.phaseTime = 0;

    // Particle system
    this.particles = [];
    this.initParticles();

    // Transition state
    this.transitionAlpha = 0;
    this.transitionDir = 1; // 1=fade in, -1=fade out
    this.nextSceneData = null;

    // Callbacks
    this.onSceneComplete = null;
    this.onSceneTitleShown = null;

    // Draw idle screen
    this.drawIdleScreen();
  }

  // ── Background Themes ─────────────────────────────────────────────────────
  THEMES = {
    tech: [
      { pos: 0,   color: '#0a0e1a' },
      { pos: 0.5, color: '#0f1a2e' },
      { pos: 1,   color: '#071320' },
    ],
    space: [
      { pos: 0,   color: '#05050f' },
      { pos: 0.5, color: '#0c0820' },
      { pos: 1,   color: '#07051a' },
    ],
    abstract: [
      { pos: 0,   color: '#10051f' },
      { pos: 0.5, color: '#1a0a2e' },
      { pos: 1,   color: '#0f0518' },
    ],
    nature: [
      { pos: 0,   color: '#050f0a' },
      { pos: 0.5, color: '#081a12' },
      { pos: 1,   color: '#040e08' },
    ],
    corporate: [
      { pos: 0,   color: '#0a0a14' },
      { pos: 0.5, color: '#12121e' },
      { pos: 1,   color: '#0a0a14' },
    ],
    minimal: [
      { pos: 0,   color: '#111115' },
      { pos: 0.5, color: '#18181e' },
      { pos: 1,   color: '#111115' },
    ],
  };

  ANIM_STYLES = ['slide-up', 'slide-left', 'zoom-in', 'fade-in', 'typewriter'];

  // ── Particle System ───────────────────────────────────────────────────────
  initParticles() {
    this.particles = [];
    for (let i = 0; i < 80; i++) {
      this.particles.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H,
        r: Math.random() * 1.8 + 0.3,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.4 + 0.05,
        pulse: Math.random() * Math.PI * 2,
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.pulse += dt * 1.5;
      if (p.x < 0) p.x = this.W;
      if (p.x > this.W) p.x = 0;
      if (p.y < 0) p.y = this.H;
      if (p.y > this.H) p.y = 0;
    }
  }

  drawParticles(accentColor) {
    const ctx = this.ctx;
    ctx.save();
    for (const p of this.particles) {
      const alpha = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse));
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Background ────────────────────────────────────────────────────────────
  drawBackground(theme, accentColor, t) {
    const ctx = this.ctx;
    const stops = this.THEMES[theme] || this.THEMES.minimal;

    // Animated radial gradient center
    const cx = this.W * 0.5 + Math.sin(t * 0.3) * 80;
    const cy = this.H * 0.5 + Math.cos(t * 0.2) * 40;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.H * 0.9);
    for (const s of stops) {
      grad.addColorStop(s.pos, s.color);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.H);

    // Subtle accent radial bloom
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, 420);
    bloom.addColorStop(0, accentColor + '18');
    bloom.addColorStop(1, 'transparent');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, this.W, this.H);

    // Grid lines (subtle)
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    const gridSpacing = 80;
    for (let x = 0; x < this.W; x += gridSpacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.H); ctx.stroke();
    }
    for (let y = 0; y < this.H; y += gridSpacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
    }
    ctx.restore();

    // Vignette
    const vig = ctx.createRadialGradient(this.W/2, this.H/2, 0, this.W/2, this.H/2, this.W * 0.8);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, this.W, this.H);
  }

  // ── Decorative Elements ───────────────────────────────────────────────────
  drawDecorativeLines(accentColor, alpha, t) {
    const ctx = this.ctx;
    ctx.save();

    // Center horizontal accent line
    const lineY = this.H * 0.5 + 60;
    const lineW = 280 * alpha;
    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 12;

    // Left line
    ctx.beginPath();
    ctx.moveTo(this.W/2 - lineW - 20, lineY);
    ctx.lineTo(this.W/2 - 20, lineY);
    ctx.stroke();

    // Right line
    ctx.beginPath();
    ctx.moveTo(this.W/2 + 20, lineY);
    ctx.lineTo(this.W/2 + lineW + 20, lineY);
    ctx.stroke();

    // Center dot
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(this.W/2, lineY, 3, 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();

    // Corner accents
    const cSize = 30 * alpha;
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha * 0.4;
    // top-left
    ctx.beginPath(); ctx.moveTo(40, 40 + cSize); ctx.lineTo(40, 40); ctx.lineTo(40 + cSize, 40); ctx.stroke();
    // top-right
    ctx.beginPath(); ctx.moveTo(this.W-40-cSize, 40); ctx.lineTo(this.W-40, 40); ctx.lineTo(this.W-40, 40+cSize); ctx.stroke();
    // bottom-left
    ctx.beginPath(); ctx.moveTo(40, this.H-40-cSize); ctx.lineTo(40, this.H-40); ctx.lineTo(40+cSize, this.H-40); ctx.stroke();
    // bottom-right
    ctx.beginPath(); ctx.moveTo(this.W-40-cSize, this.H-40); ctx.lineTo(this.W-40, this.H-40); ctx.lineTo(this.W-40, this.H-40-cSize); ctx.stroke();

    ctx.restore();
  }

  // ── Text Rendering ────────────────────────────────────────────────────────
  drawTitle(text, animStyle, progress, accentColor) {
    const ctx = this.ctx;
    const centerX = this.W / 2;
    const centerY = this.H / 2;

    let x = centerX, y = centerY - 20;
    let alpha = 1, scale = 1, blur = 0;
    let charProgress = 1;

    const ease = this.easeOutQuart(Math.min(progress * 1.5, 1));
    const easeIn = this.easeInQuad(Math.max(0, progress * 2 - 1));

    switch (animStyle) {
      case 'slide-up':
        y = centerY - 20 + (1 - ease) * 80;
        alpha = ease;
        break;
      case 'slide-left':
        x = centerX + (1 - ease) * 120;
        alpha = ease;
        break;
      case 'zoom-in':
        scale = 0.4 + ease * 0.6;
        alpha = ease;
        break;
      case 'fade-in':
        alpha = ease;
        blur = (1 - ease) * 8;
        break;
      case 'typewriter':
        charProgress = Math.min(progress * 3, 1);
        alpha = 1;
        break;
      default:
        alpha = ease;
        y = centerY - 20 + (1 - ease) * 60;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (blur > 0) ctx.filter = `blur(${blur}px)`;

    // Glow shadow
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 30;

    // Display text (typewriter: partial chars)
    let displayText = text;
    if (animStyle === 'typewriter' && charProgress < 1) {
      displayText = text.slice(0, Math.floor(charProgress * text.length));
    }

    // Large title font
    const fontSize = this.calcFontSize(text, 96, this.W - 160);
    ctx.font = `800 ${fontSize}px 'Space Grotesk', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '0.02em';

    // Gradient fill for text
    const textGrad = ctx.createLinearGradient(-200, -fontSize/2, 200, fontSize/2);
    textGrad.addColorStop(0, '#ffffff');
    textGrad.addColorStop(0.5, '#f0f0f5');
    textGrad.addColorStop(1, accentColor + 'cc');
    ctx.fillStyle = textGrad;
    ctx.fillText(displayText, 0, 0);

    // Typing cursor
    if (animStyle === 'typewriter' && charProgress < 1) {
      const tw = ctx.measureText(displayText).width;
      ctx.fillStyle = accentColor;
      ctx.fillRect(tw/2 + 6, -fontSize/2, 4, fontSize);
    }

    ctx.restore();
  }

  calcFontSize(text, maxSize, maxWidth) {
    let size = maxSize;
    const ctx = this.ctx;
    while (size > 32) {
      ctx.font = `800 ${size}px 'Space Grotesk', system-ui, sans-serif`;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 4;
    }
    return size;
  }

  drawSceneNumber(idx, total, accentColor, alpha) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.font = '600 14px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = accentColor;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 8;
    ctx.fillText(`${idx + 1} / ${total}`, this.W - 40, 40);
    ctx.restore();
  }

  drawProgressBar(progress, accentColor) {
    const ctx = this.ctx;
    const barH = 3;
    const barY = this.H - barH;

    ctx.save();
    // Track
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, barY, this.W, barH);

    // Fill
    const fillW = this.W * progress;
    const fillGrad = ctx.createLinearGradient(0, 0, fillW, 0);
    fillGrad.addColorStop(0, 'rgba(255,255,255,0.3)');
    fillGrad.addColorStop(1, accentColor);
    ctx.fillStyle = fillGrad;
    ctx.fillRect(0, barY, fillW, barH);

    // Glow dot at end
    if (fillW > 4) {
      ctx.beginPath();
      ctx.arc(fillW, barY + barH/2, 4, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 10;
      ctx.fill();
    }
    ctx.restore();
  }

  drawVideoTitle(title, alpha) {
    if (!title) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.font = '500 15px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, 40, 36);
    ctx.restore();
  }

  // ── Easing Functions ──────────────────────────────────────────────────────
  easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }
  easeInQuad(t) { return t * t; }
  easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }
  easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // ── Idle Screen ───────────────────────────────────────────────────────────
  drawIdleScreen() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    // Background
    const grad = ctx.createRadialGradient(this.W/2, this.H/2, 0, this.W/2, this.H/2, this.H * 0.8);
    grad.addColorStop(0, '#15161c');
    grad.addColorStop(1, '#0a0a0e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.H);

    // Grid
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = '#747689';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.W; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.H); ctx.stroke();
    }
    for (let y = 0; y < this.H; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
    }
    ctx.restore();

    // Center logo area
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.arc(this.W/2, this.H/2, 120, 0, Math.PI * 2);
    ctx.strokeStyle = '#747689';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.W/2, this.H/2, 80, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.font = '700 26px Space Grotesk, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillText('TuanDevTop', this.W/2, this.H/2);
  }

  // ── Transition Flash ──────────────────────────────────────────────────────
  drawTransitionOverlay(alpha, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.restore();
  }

  // ── Main Render Loop ──────────────────────────────────────────────────────
  setScenes(scenes) {
    this.scenes = scenes;
    this.currentSceneIdx = -1;
    this.globalTime = 0;
  }

  // Start rendering a specific scene
  renderScene(idx) {
    const scene = this.scenes[idx];
    if (!scene) return;

    this.currentSceneIdx = idx;
    this.sceneStartTime = performance.now();
    this.phase = 'entering';
    this.phaseTime = 0;

    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this._renderLoop(scene, performance.now());
  }

  _renderLoop(scene, lastTime) {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    this.globalTime += dt;
    this.phaseTime += dt;

    // Update particles
    this.updateParticles(dt);

    this._drawScene(scene, dt, now);

    this.animFrame = requestAnimationFrame(() => this._renderLoop(scene, now));
  }

  _drawScene(scene, dt, now) {
    const ctx = this.ctx;
    const theme = scene.backgroundTheme || 'tech';
    const accent = scene.accentColor || '#747689';
    const animStyle = scene.animationStyle || 'slide-up';
    const totalScenes = this.scenes.length;
    const globalProgress = (this.currentSceneIdx + Math.min(this.phaseTime / 12, 1)) / totalScenes;

    // ENTERING phase: 0.8s
    const ENTER_DURATION = 0.8;
    // EXITING phase: 0.6s (called externally via exitScene)
    // DISPLAYING: infinite until exitScene called

    let enterProgress = 1;
    let exitProgress = 0;
    let overlayAlpha = 0;

    if (this.phase === 'entering') {
      enterProgress = Math.min(this.phaseTime / ENTER_DURATION, 1);
      overlayAlpha = 1 - enterProgress;
      if (enterProgress >= 1) {
        this.phase = 'displaying';
        this.phaseTime = 0;
        if (this.onSceneTitleShown) this.onSceneTitleShown(this.currentSceneIdx);
      }
    } else if (this.phase === 'exiting') {
      const EXIT_DURATION = 0.5;
      exitProgress = Math.min(this.phaseTime / EXIT_DURATION, 1);
      overlayAlpha = this.easeInQuad(exitProgress);
      if (exitProgress >= 1) {
        this.phase = 'done';
        if (this.onSceneComplete) this.onSceneComplete(this.currentSceneIdx);
        return;
      }
    }

    // Draw
    this.drawBackground(theme, accent, this.globalTime);
    this.drawParticles(accent);
    this.drawDecorativeLines(accent, Math.min(enterProgress * 1.5, 1) * (1 - exitProgress * 2), this.globalTime);
    this.drawTitle(scene.sceneTitle, animStyle, enterProgress * (1 - exitProgress), accent);
    this.drawSceneNumber(this.currentSceneIdx, totalScenes, accent, Math.min(enterProgress * 2, 1));
    this.drawVideoTitle(this.scenes[0]?.videoTitle || '', Math.min(enterProgress * 2, 1));
    this.drawProgressBar(globalProgress, accent);

    // Overlay for transition
    if (overlayAlpha > 0) {
      this.drawTransitionOverlay(overlayAlpha, theme === 'minimal' ? '#111115' : '#05060e');
    }
  }

  // Called when speech ends — start exit animation
  exitScene() {
    if (this.phase === 'displaying' || this.phase === 'entering') {
      this.phase = 'exiting';
      this.phaseTime = 0;
    }
  }

  // Stop rendering
  stop() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    this.phase = 'idle';
  }

  // Draw completion frame (Ends abruptly as requested)
  drawCompletionFrame() {
    this.stop();
  }
}

// Export
window.VideoRenderer = VideoRenderer;
