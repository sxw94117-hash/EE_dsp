/* 谱线 · 交互实验室   纯 Canvas 实现，无外部依赖。 */

const LABS = [
  {
    id: "sampling",
    title: "采样与混叠",
    short: "改变信号频率与采样率，亲眼看到 7 Hz 如何伪装成 3 Hz。",
    desc: "拖动频率与采样率，观察连续波形、采样点与混叠后的重建波形。理解奈奎斯特频率为什么是 fs/2。",
    icon: "sampling",
    color: "#0891b2",
    tags: ["时域", "奈奎斯特"],
    chapter: "sampling",
    formula: String.raw`f_{\text{alias}}=\left|f-kf_s\right|,\qquad k=\operatorname{round}\!\left(\frac{f}{f_s}\right)`,
    points: [
      "采样点同时落在原始信号与混叠信号上，仅凭样本无法区分二者。",
      "当 f < fs/2 时不会混叠；超过后频率会“折叠”回 0～fs/2。",
      "工程上通常让采样率高于最高频率的 2.5～4 倍，给抗混叠滤波器留过渡带。",
    ],
    render() {
      return demoShell(
        "sampling",
        "时域波形",
        "连续信号 vs 采样点（0.5 s 窗口）",
        `<span><i style="--c:var(--primary)"></i>原始信号</span>
         <span><i class="dashed" style="--c:var(--red)"></i>混叠波形</span>
         <span><i class="dot" style="--c:var(--red)"></i>采样点</span>`,
        `
        ${rangeControl("sampling-f", "信号频率 f", 1, 12, 0.1, 7, " Hz")}
        ${rangeControl("sampling-fs", "采样率 fs", 2, 30, 0.5, 10, " Hz")}
        <div class="status-line" id="sampling-status"></div>`,
        `
        <div class="readout"><span>奈奎斯特频率</span><strong id="sampling-nyq">5.0 Hz</strong></div>
        <div class="readout"><span>观测到的频率</span><strong id="sampling-alias">3.0 Hz</strong></div>
        <div class="readout"><span>0.5 s 内样本数</span><strong id="sampling-count">5</strong></div>
        <div class="readout"><span>状态</span><strong id="sampling-state">混叠</strong></div>`
      );
    },
    init(root) {
      const fEl = root.querySelector("#sampling-f");
      const fsEl = root.querySelector("#sampling-fs");
      const { canvas, ctx, setDraw, repaint, destroy } = mountCanvas(root, 380);
      const status = root.querySelector("#sampling-status");
      const nyqEl = root.querySelector("#sampling-nyq");
      const aliasEl = root.querySelector("#sampling-alias");
      const countEl = root.querySelector("#sampling-count");
      const stateEl = root.querySelector("#sampling-state");

      function draw() {
        const c = ctx();
        if (!c) return;
        const { g, w, h } = c;
        const f = +fEl.value;
        const fs = +fsEl.value;
        const k = Math.round(f / fs);
        const alias = Math.abs(f - k * fs);
        const aliased = f > fs / 2 + 1e-9;
        const box = plotBox(w, h);
        const colors = themeColors();
        clear(g, w, h);
        drawGrid(g, box, 5, 4, colors);
        drawAxis(g, box, colors);
        drawXAxisLabels(g, box, 0, 0.5, 5, (v) => v.toFixed(1) + " s", colors);
        drawYAxisLabels(g, box, -1.2, 1.2, 4, colors);

        const N = 600;
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const t = (i / N) * 0.5;
          pts.push([t, Math.cos(2 * Math.PI * f * t)]);
        }
        drawPolyline(g, pts, box, 0, 0.5, -1.2, 1.2, colors.primary, 2.2);

        if (aliased) {
          const aliasPts = [];
          for (let i = 0; i <= N; i++) {
            const t = (i / N) * 0.5;
            aliasPts.push([t, Math.cos(2 * Math.PI * alias * t)]);
          }
          drawPolyline(g, aliasPts, box, 0, 0.5, -1.2, 1.2, colors.red, 1.8, [6, 5]);
        }

        const samples = [];
        for (let n = 0; n * (1 / fs) <= 0.5 + 1e-9; n++) {
          const t = n / fs;
          samples.push([t, Math.cos(2 * Math.PI * f * t)]);
        }
        samples.forEach(([t, y]) => {
          const x = mapX(t, 0, 0.5, box);
          const y0 = mapY(0, -1.2, 1.2, box);
          const y1 = mapY(y, -1.2, 1.2, box);
          g.strokeStyle = colors.red;
          g.globalAlpha = 0.5;
          g.beginPath();
          g.moveTo(x, y0);
          g.lineTo(x, y1);
          g.stroke();
          g.globalAlpha = 1;
          g.fillStyle = colors.red;
          g.beginPath();
          g.arc(x, y1, 3.2, 0, Math.PI * 2);
          g.fill();
        });

        // 标注当前参数
        g.fillStyle = colors.muted;
        g.font = "11px " + FONT_MONO;
        g.textAlign = "left";
        g.fillText(`f = ${f.toFixed(1)} Hz   fs = ${fs.toFixed(1)} Hz`, box.l + 4, box.t + 13);

        nyqEl.textContent = (fs / 2).toFixed(1) + " Hz";
        aliasEl.textContent = (aliased && alias > 0.01 ? alias : f).toFixed(1) + " Hz";
        countEl.textContent = String(samples.length);
        if (aliased) {
          stateEl.textContent = "混叠";
          stateEl.className = "bad";
          status.className = "status-line bad";
          status.innerHTML = `<strong>发生混叠：</strong>${f.toFixed(1)} Hz 被采样后看起来像 ${alias.toFixed(1)} Hz。原始信号与混叠信号的样本完全重合，数字域无法区分。`;
        } else {
          stateEl.textContent = "正常";
          stateEl.className = "good";
          status.className = "status-line good";
          status.innerHTML = `<strong>满足奈奎斯特准则：</strong>fs/2 = ${(fs / 2).toFixed(1)} Hz ≥ f = ${f.toFixed(1)} Hz，频谱副本不重叠，可无失真恢复。`;
        }
        repaint();
      }

      function update() {
        paintRange(fEl);
        paintRange(fsEl);
        draw();
      }
      fEl.addEventListener("input", update);
      fsEl.addEventListener("input", update);
      setDraw(draw);
      update();
      return destroy;
    },
  },

  {
    id: "dft",
    title: "DFT 与频谱泄漏",
    short: "改变窗函数和频率位置，看主瓣、旁瓣与泄漏如何变化。",
    desc: "对一个双音信号做 N 点 DFT，比较矩形窗、Hann、Hamming、Blackman 的频谱差异，理解分辨率与泄漏的取舍。",
    icon: "spectrum",
    color: "#0f9f74",
    tags: ["频域", "窗函数"],
    chapter: "fourier",
    formula: String.raw`X[k]=\sum_{n=0}^{N-1}x[n]w[n]\,e^{-j2\pi kn/N}`,
    points: [
      "频率未落在 bin 上时，矩形窗会把能量泄漏到很远的旁瓣。",
      "Hann / Hamming 用更宽的主瓣换取更低的旁瓣。",
      "补零只会让谱线更密，不会降低泄漏或提高真实分辨率。",
    ],
    render() {
      return demoShell(
        "dft",
        "时域与幅度谱",
        "上：加窗后的时域样本　下：单边幅度谱（dB）",
        `<span><i style="--c:var(--primary)"></i>加窗信号 / 幅度谱</span>
         <span><i class="dashed" style="--c:var(--cyan)"></i>窗函数包络</span>
         <span><i class="dot" style="--c:var(--red)"></i>峰值 bin</span>`,
        `
        <div class="control">
          <div class="control-head"><span>FFT 点数 N</span><output id="dft-n-out">256</output></div>
          <select class="input-select" id="dft-n">
            <option value="64">64</option>
            <option value="128">128</option>
            <option value="256" selected>256</option>
            <option value="512">512</option>
            <option value="1024">1024</option>
          </select>
        </div>
        <div class="control">
          <div class="control-head"><span>窗函数</span></div>
          <div class="seg" data-seg="dft-window">
            <button type="button" data-value="rect" class="active">矩形</button>
            <button type="button" data-value="hann">Hann</button>
            <button type="button" data-value="hamming">Hamming</button>
            <button type="button" data-value="blackman">Blackman</button>
          </div>
        </div>
        ${rangeControl("dft-f1", "主频位置", 0.06, 0.42, 0.001, 0.132, " ×fs")}
        ${rangeControl("dft-a2", "第二音幅度", 0, 1, 0.05, 0.5, "")}
        <div class="status-line" id="dft-status"></div>`,
        `
        <div class="readout"><span>频率间隔</span><strong id="dft-df">1/256</strong></div>
        <div class="readout"><span>峰值位置</span><strong id="dft-peak">0.133</strong></div>
        <div class="readout"><span>估算主瓣</span><strong id="dft-lobe">4 bin</strong></div>
        <div class="readout"><span>最高旁瓣</span><strong id="dft-side">−13 dB</strong></div>`
      );
    },
    init(root) {
      const nEl = root.querySelector("#dft-n");
      const f1El = root.querySelector("#dft-f1");
      const a2El = root.querySelector("#dft-a2");
      const seg = root.querySelector('[data-seg="dft-window"]');
      const { canvas, ctx, setDraw, repaint, destroy } = mountCanvas(root, 430);
      const status = root.querySelector("#dft-status");
      const dfEl = root.querySelector("#dft-df");
      const peakEl = root.querySelector("#dft-peak");
      const lobeEl = root.querySelector("#dft-lobe");
      const sideEl = root.querySelector("#dft-side");
      let windowType = "rect";

      const sideSpec = { rect: -13, hann: -31, hamming: -43, blackman: -58 };
      const lobeSpec = { rect: 2, hann: 4, hamming: 4, blackman: 6 };

      seg.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        seg.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
        windowType = btn.dataset.value;
        draw();
      });

      function draw() {
        const c = ctx();
        if (!c) return;
        const { g, w, h } = c;
        const colors = themeColors();
        clear(g, w, h);

        const N = +nEl.value;
        const f1 = +f1El.value;
        const a2 = +a2El.value;
        const f2 = Math.min(0.46, f1 + 0.13);
        const win = makeWindow(windowType, N);
        const wsum = win.reduce((a, b) => a + b, 0);

        const x = new Array(N);
        const xw = new Array(N);
        for (let n = 0; n < N; n++) {
          x[n] = Math.cos(2 * Math.PI * f1 * n) + a2 * Math.cos(2 * Math.PI * f2 * n);
          xw[n] = x[n] * win[n];
        }

        // 时域（前 160 点）
        const boxTop = { l: 48, r: w - 16, t: 18, b: h * 0.38 };
        drawGrid(g, boxTop, 5, 2, colors);
        drawAxis(g, boxTop, colors);
        drawXAxisLabels(g, boxTop, 0, 160, 4, (v) => "n=" + Math.round(v), colors);
        drawYAxisLabels(g, boxTop, -2.1, 2.1, 2, colors);
        const show = Math.min(160, N);
        const pts = [];
        for (let n = 0; n < show; n++) pts.push([n, xw[n]]);
        drawPolyline(g, pts, boxTop, 0, 160, -2.1, 2.1, colors.primary, 1.4);
        // 窗包络
        const envTop = [];
        const envBot = [];
        for (let n = 0; n < show; n++) {
          envTop.push([n, 2.0 * win[n]]);
          envBot.push([n, -2.0 * win[n]]);
        }
        drawPolyline(g, envTop, boxTop, 0, 160, -2.1, 2.1, colors.cyan, 1, [4, 4]);
        drawPolyline(g, envBot, boxTop, 0, 160, -2.1, 2.1, colors.cyan, 1, [4, 4]);
        g.fillStyle = colors.muted;
        g.font = "11px " + FONT_MONO;
        g.textAlign = "left";
        g.fillText(`N = ${N}   window = ${windowType}`, boxTop.l + 4, boxTop.t + 12);

        // 频谱
        const boxBot = { l: 48, r: w - 16, t: h * 0.48, b: h - 34 };
        drawGrid(g, boxBot, 5, 5, colors);
        drawAxis(g, boxBot, colors);
        drawXAxisLabels(g, boxBot, 0, 0.5, 5, (v) => v.toFixed(1) + " fs", colors);
        drawDbLabels(g, boxBot, -100, 5, colors);

        const re = new Array(N);
        const im = new Array(N);
        for (let n = 0; n < N; n++) {
          re[n] = xw[n];
          im[n] = 0;
        }
        fft(re, im);
        const half = N / 2;
        const mag = new Array(half + 1);
        let peak = -Infinity;
        let peakK = 0;
        for (let k = 0; k <= half; k++) {
          let m = Math.hypot(re[k], im[k]) / wsum;
          if (k > 0 && k < half) m *= 2;
          mag[k] = 20 * Math.log10(Math.max(m, 1e-9));
          if (mag[k] > peak) {
            peak = mag[k];
            peakK = k;
          }
        }
        const specPts = mag.map((db, k) => [k / N, Math.max(-100, db)]);
        // 填充
        g.save();
        g.beginPath();
        g.moveTo(mapX(0, 0, 0.5, boxBot), mapY(-100, -100, 5, boxBot));
        specPts.forEach(([xx, yy]) => g.lineTo(mapX(xx, 0, 0.5, boxBot), mapY(Math.max(-100, yy), -100, 5, boxBot)));
        g.lineTo(mapX(0.5, 0, 0.5, boxBot), mapY(-100, -100, 5, boxBot));
        g.closePath();
        g.fillStyle = colors.primarySoft;
        g.globalAlpha = 0.5;
        g.fill();
        g.restore();
        drawPolyline(g, specPts, boxBot, 0, 0.5, -100, 5, colors.primary, 1.4);

        // 峰值标记
        const px = mapX(peakK / N, 0, 0.5, boxBot);
        const py = mapY(Math.max(-100, mag[peakK]), -100, 5, boxBot);
        g.strokeStyle = colors.red;
        g.globalAlpha = 0.5;
        g.setLineDash([3, 4]);
        g.beginPath();
        g.moveTo(px, boxBot.b);
        g.lineTo(px, py);
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 1;
        g.fillStyle = colors.red;
        g.beginPath();
        g.arc(px, py, 3.5, 0, Math.PI * 2);
        g.fill();

        // 标注 -3 dB 线
        g.strokeStyle = colors.faint;
        g.globalAlpha = 0.35;
        g.setLineDash([2, 4]);
        g.beginPath();
        g.moveTo(boxBot.l, mapY(-3, -100, 5, boxBot));
        g.lineTo(boxBot.r, mapY(-3, -100, 5, boxBot));
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 1;

        dfEl.textContent = "1/" + N;
        peakEl.textContent = (peakK / N).toFixed(3) + " fs";
        lobeEl.textContent = lobeSpec[windowType] + " bin";
        sideEl.textContent = "−" + Math.abs(sideSpec[windowType]) + " dB";

        const onBin = Math.abs(f1 * N - Math.round(f1 * N)) < 0.02;
        if (onBin) {
          status.className = "status-line good";
          status.innerHTML = `<strong>接近整周期采样：</strong>主频几乎落在 bin 上，泄漏很小。换成 0.132 ×fs 这类非整数 bin 频率，就能看到旁瓣扩散。`;
        } else {
          status.className = "status-line bad";
          status.innerHTML = `<strong>发生频谱泄漏：</strong>主频未落在 bin 上，能量扩散到相邻频点。${windowType === "rect" ? "矩形窗旁瓣高，远处的弱信号容易被淹没。" : "当前窗的旁瓣更低，但主瓣更宽。"}`;
        }
        repaint();
      }

      function update() {
        paintRange(f1El);
        paintRange(a2El);
        root.querySelector("#dft-n-out").textContent = nEl.value;
        draw();
      }
      nEl.addEventListener("change", update);
      f1El.addEventListener("input", update);
      a2El.addEventListener("input", update);
      setDraw(draw);
      update();
      return destroy;
    },
  },

  {
    id: "fir",
    title: "FIR 低通设计",
    short: "调阶数、截止频率与窗，观察冲激响应与幅频响应如何联动。",
    desc: "用窗函数法现场设计一个线性相位 FIR 低通滤波器，比较不同窗的过渡带宽度与阻带衰减。",
    icon: "filter",
    color: "#b45309",
    tags: ["FIR", "窗函数法"],
    chapter: "filters",
    formula: String.raw`h[n]=2f_c\,\operatorname{sinc}\!\left(2f_c(n-\alpha)\right)w[n],\qquad \alpha=\frac{M}{2}`,
    points: [
      "阶数越高，过渡带越窄，但群延迟 M/2 也越大。",
      "Hann / Hamming 降低旁瓣，代价是主瓣变宽。",
      "线性相位来自 h[n] 的对称性，所有频率共享同一个延迟。",
    ],
    render() {
      return demoShell(
        "fir",
        "冲激响应与幅频响应",
        "上：h[n]（对称）　下：归一化幅度响应（dB）",
        `<span><i style="--c:var(--primary)"></i>h[n] / |H|</span>
         <span><i class="dashed" style="--c:var(--red)"></i>截止频率</span>
         <span><i class="dashed" style="--c:var(--faint)"></i>−3 dB</span>`,
        `
        ${rangeControl("fir-m", "阶数 M（长度 M+1）", 10, 120, 2, 60, "")}
        ${rangeControl("fir-fc", "归一化截止频率", 0.05, 0.45, 0.005, 0.2, " ×fs")}
        <div class="control">
          <div class="control-head"><span>窗函数</span></div>
          <select class="input-select" id="fir-window">
            <option value="rect">矩形窗（21 dB）</option>
            <option value="hann">Hann（44 dB）</option>
            <option value="hamming" selected>Hamming（53 dB）</option>
            <option value="blackman">Blackman（74 dB）</option>
            <option value="kaiser">Kaiser β=8（≈80 dB）</option>
          </select>
        </div>
        <div class="status-line" id="fir-status"></div>`,
        `
        <div class="readout"><span>滤波器长度</span><strong id="fir-len">61</strong></div>
        <div class="readout"><span>群延迟</span><strong id="fir-delay">30 samples</strong></div>
        <div class="readout"><span>过渡带估计</span><strong id="fir-trans">0.13 ×fs</strong></div>
        <div class="readout"><span>阻带衰减</span><strong id="fir-stop">53 dB</strong></div>`
      );
    },
    init(root) {
      const mEl = root.querySelector("#fir-m");
      const fcEl = root.querySelector("#fir-fc");
      const winEl = root.querySelector("#fir-window");
      const { canvas, ctx, setDraw, repaint, destroy } = mountCanvas(root, 460);
      const status = root.querySelector("#fir-status");
      const lenEl = root.querySelector("#fir-len");
      const delayEl = root.querySelector("#fir-delay");
      const transEl = root.querySelector("#fir-trans");
      const stopEl = root.querySelector("#fir-stop");

      const winSpec = {
        rect: { stop: 21, trans: 1.8, label: "矩形窗" },
        hann: { stop: 44, trans: 3.1, label: "Hann" },
        hamming: { stop: 53, trans: 3.3, label: "Hamming" },
        blackman: { stop: 74, trans: 5.5, label: "Blackman" },
        kaiser: { stop: 80, trans: 6.4, label: "Kaiser β=8" },
      };

      function draw() {
        const c = ctx();
        if (!c) return;
        const { g, w, h } = c;
        const colors = themeColors();
        clear(g, w, h);

        const M = +mEl.value;
        const fc = +fcEl.value;
        const type = winEl.value;
        const N = M + 1;
        const alpha = M / 2;
        const win = makeWindow(type === "kaiser" ? "kaiser8" : type, N);
        const hcoef = new Array(N);
        for (let n = 0; n < N; n++) {
          const x = n - alpha;
          hcoef[n] = 2 * fc * sinc(2 * fc * x) * win[n];
        }

        // 冲激响应
        const boxTop = { l: 48, r: w - 16, t: 18, b: h * 0.36 };
        drawGrid(g, boxTop, 5, 2, colors);
        drawAxis(g, boxTop, colors);
        drawXAxisLabels(g, boxTop, 0, M, 5, (v) => "n=" + Math.round(v), colors);
        const hmax = Math.max(0.05, ...hcoef.map(Math.abs));
        drawYAxisLabels(g, boxTop, -hmax * 1.15, hmax * 1.15, 2, colors, (v) => v.toFixed(2));
        const midY = mapY(0, -hmax * 1.15, hmax * 1.15, boxTop);
        hcoef.forEach((v, n) => {
          const x = mapX(n, 0, M, boxTop);
          const y = mapY(v, -hmax * 1.15, hmax * 1.15, boxTop);
          g.strokeStyle = colors.primary;
          g.globalAlpha = 0.45;
          g.lineWidth = 1.2;
          g.beginPath();
          g.moveTo(x, midY);
          g.lineTo(x, y);
          g.stroke();
          g.globalAlpha = 1;
          g.fillStyle = colors.primary;
          g.beginPath();
          g.arc(x, y, Math.max(1.4, Math.min(2.6, 60 / M)), 0, Math.PI * 2);
          g.fill();
        });
        g.fillStyle = colors.muted;
        g.font = "11px " + FONT_MONO;
        g.textAlign = "left";
        g.fillText(`M = ${M},  length = ${N},  fc = ${fc.toFixed(3)} fs`, boxTop.l + 4, boxTop.t + 12);

        // 幅频响应
        const boxBot = { l: 48, r: w - 16, t: h * 0.46, b: h - 34 };
        drawGrid(g, boxBot, 5, 5, colors);
        drawAxis(g, boxBot, colors);
        drawXAxisLabels(g, boxBot, 0, 0.5, 5, (v) => v.toFixed(1) + " fs", colors);
        drawDbLabels(g, boxBot, -100, 10, colors);

        const K = 600;
        const resp = [];
        let peak = 0;
        for (let i = 0; i <= K; i++) {
          const f = (i / K) * 0.5;
          const omega = 2 * Math.PI * f;
          let re = 0;
          let im = 0;
          for (let n = 0; n < N; n++) {
            re += hcoef[n] * Math.cos(-omega * n);
            im += hcoef[n] * Math.sin(-omega * n);
          }
          const mag = Math.hypot(re, im);
          peak = Math.max(peak, mag);
          resp.push(mag);
        }
        const dbPts = resp.map((m, i) => [(i / K) * 0.5, 20 * Math.log10(Math.max(m / peak, 1e-6))]);
        g.save();
        g.beginPath();
        g.moveTo(mapX(0, 0, 0.5, boxBot), mapY(-100, -100, 10, boxBot));
        dbPts.forEach(([x, y]) => g.lineTo(mapX(x, 0, 0.5, boxBot), mapY(Math.max(-100, y), -100, 10, boxBot)));
        g.lineTo(mapX(0.5, 0, 0.5, boxBot), mapY(-100, -100, 10, boxBot));
        g.closePath();
        g.fillStyle = colors.primarySoft;
        g.globalAlpha = 0.45;
        g.fill();
        g.restore();
        drawPolyline(g, dbPts, boxBot, 0, 0.5, -100, 10, colors.primary, 1.5);

        // 截止频率与 -3 dB 线
        const fcX = mapX(fc, 0, 0.5, boxBot);
        g.strokeStyle = colors.red;
        g.globalAlpha = 0.6;
        g.setLineDash([5, 4]);
        g.beginPath();
        g.moveTo(fcX, boxBot.t);
        g.lineTo(fcX, boxBot.b);
        g.stroke();
        g.setLineDash([2, 4]);
        g.strokeStyle = colors.faint;
        g.beginPath();
        g.moveTo(boxBot.l, mapY(-3, -100, 10, boxBot));
        g.lineTo(boxBot.r, mapY(-3, -100, 10, boxBot));
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 1;

        const spec = winSpec[type];
        lenEl.textContent = String(N);
        delayEl.textContent = (M / 2).toFixed(1) + " samples";
        const trans = (spec.trans / M).toFixed(3) + " ×fs";
        transEl.textContent = trans;
        stopEl.textContent = "≥" + spec.stop + " dB";

        status.className = "status-line";
        status.innerHTML = `<strong>${spec.label}：</strong>过渡带约 ${trans}，理论阻带衰减 ${spec.stop} dB，群延迟 ${(M / 2).toFixed(1)} 个样本。${M > 90 ? "阶数较高，注意延迟与算力预算。" : "可继续增大阶数观察过渡带收窄。"}`;
        repaint();
      }

      function update() {
        paintRange(mEl);
        paintRange(fcEl);
        draw();
      }
      mEl.addEventListener("input", update);
      fcEl.addEventListener("input", update);
      winEl.addEventListener("change", update);
      setDraw(draw);
      update();
      return destroy;
    },
  },

  {
    id: "convolution",
    title: "卷积滑动演示",
    short: "拖动 n，观察 h[n−k] 如何滑过 x[k]，并逐步累积出 y[n]。",
    desc: "选择输入序列与系统冲激响应，拖动时间索引，看翻转、移位、相乘、求和四个步骤如何发生。",
    icon: "wave",
    color: "#2563eb",
    tags: ["时域", "卷积"],
    chapter: "basics",
    formula: String.raw`y[n_0]=\sum_{k}x[k]\,h[n_0-k]`,
    points: [
      "中间图的 h[n₀−k] 是翻转后再右移 n₀ 的结果。",
      "只有 x[k] 与 h[n₀−k] 同时非零的 k 才会贡献 y[n₀]。",
      "有限长序列卷积长度为 L+M−1，超出范围的点自然为零。",
    ],
    render() {
      return demoShell(
        "conv",
        "卷积的图解法",
        "上：x[k]　中：翻转并移位的 h[n₀−k]　下：完整输出 y[n]",
        `<span><i style="--c:var(--primary)"></i>x[k] / y[n]</span>
         <span><i style="--c:var(--amber)"></i>h[n₀−k]</span>
         <span><i class="dot" style="--c:var(--red)"></i>当前 n₀</span>`,
        `
        <div class="control">
          <div class="control-head"><span>输入序列 x[n]</span></div>
          <select class="input-select" id="conv-x">
            <option value="pulse" selected>矩形脉冲（长度 5）</option>
            <option value="decay">指数衰减 0.7ⁿ</option>
            <option value="double">双脉冲</option>
          </select>
        </div>
        <div class="control">
          <div class="control-head"><span>系统冲激响应 h[n]</span></div>
          <select class="input-select" id="conv-h">
            <option value="average" selected>5 点滑动平均</option>
            <option value="exp">指数衰减</option>
            <option value="diff">一阶差分 [1, −1]</option>
          </select>
        </div>
        ${rangeControl("conv-n", "当前索引 n₀", 0, 14, 1, 7, "")}
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn-soft btn-sm" id="conv-play" type="button" style="flex:1">播放</button>
          <button class="btn btn-ghost btn-sm" id="conv-reset" type="button" style="flex:1">重置</button>
        </div>
        <div class="status-line" id="conv-status"></div>`,
        `
        <div class="readout"><span>当前输出</span><strong id="conv-val">—</strong></div>
        <div class="readout"><span>重叠点数</span><strong id="conv-overlap">—</strong></div>
        <div class="readout"><span>输出长度</span><strong id="conv-len">—</strong></div>
        <div class="readout"><span>n₀</span><strong id="conv-n0">0</strong></div>`
      );
    },
    init(root) {
      const xEl = root.querySelector("#conv-x");
      const hEl = root.querySelector("#conv-h");
      const nEl = root.querySelector("#conv-n");
      const playBtn = root.querySelector("#conv-play");
      const resetBtn = root.querySelector("#conv-reset");
      const { canvas, ctx, setDraw, repaint, destroy } = mountCanvas(root, 470);
      const status = root.querySelector("#conv-status");
      const valEl = root.querySelector("#conv-val");
      const overlapEl = root.querySelector("#conv-overlap");
      const lenEl = root.querySelector("#conv-len");
      const n0El = root.querySelector("#conv-n0");
      let timer = null;

      const X_PRESETS = {
        pulse: [1, 1, 1, 1, 1],
        decay: Array.from({ length: 10 }, (_, i) => Math.pow(0.7, i)),
        double: [0, 0, 1, 1, 1, 0, 1, 1, 0, 0],
      };
      const H_PRESETS = {
        average: [0.2, 0.2, 0.2, 0.2, 0.2],
        exp: [1, 0.65, 0.42, 0.27, 0.18, 0.11],
        diff: [1, -1],
      };

      function series() {
        const x = X_PRESETS[xEl.value];
        const h = H_PRESETS[hEl.value];
        const y = new Array(x.length + h.length - 1).fill(0);
        for (let i = 0; i < x.length; i++) {
          for (let j = 0; j < h.length; j++) y[i + j] += x[i] * h[j];
        }
        return { x, h, y };
      }

      function setRange() {
        const { y } = series();
        nEl.max = String(y.length - 1);
        if (+nEl.value > y.length - 1) nEl.value = String(y.length - 1);
        n0El.textContent = nEl.value;
        lenEl.textContent = String(y.length);
      }

      function draw() {
        const c = ctx();
        if (!c) return;
        const { g, w, h } = c;
        const colors = themeColors();
        clear(g, w, h);

        const { x, h: hh, y } = series();
        const n0 = +nEl.value;
        const K = Math.max(x.length, hh.length, y.length);
        const hmax = Math.max(1, ...x.map(Math.abs), ...hh.map(Math.abs));
        const ymax = Math.max(0.5, ...y.map(Math.abs));

        // x[k]
        const boxX = { l: 48, r: w - 16, t: 14, b: h * 0.3 };
        drawGrid(g, boxX, 5, 2, colors);
        drawAxis(g, boxX, colors);
        drawXAxisLabels(g, boxX, 0, K - 1, 5, (v) => "k=" + Math.round(v), colors);
        drawYAxisLabels(g, boxX, -hmax * 1.15, hmax * 1.15, 2, colors, (v) => v.toFixed(1));
        drawStems(g, x, 0, boxX, 0, K - 1, -hmax * 1.15, hmax * 1.15, colors.primary);
        panelLabel(g, boxX, "x[k]", colors);

        // h[n0-k]
        const boxH = { l: 48, r: w - 16, t: h * 0.35, b: h * 0.61 };
        drawGrid(g, boxH, 5, 2, colors);
        drawAxis(g, boxH, colors);
        drawXAxisLabels(g, boxH, 0, K - 1, 5, (v) => "k=" + Math.round(v), colors);
        drawYAxisLabels(g, boxH, -hmax * 1.15, hmax * 1.15, 2, colors, (v) => v.toFixed(1));
        const flipped = [];
        for (let k = 0; k <= n0; k++) {
          const idx = n0 - k;
          if (idx >= 0 && idx < hh.length) flipped.push([k, hh[idx]]);
        }
        drawStemsPairs(g, flipped, boxH, 0, K - 1, -hmax * 1.15, hmax * 1.15, colors.amber);
        // 重叠区域
        const lo = Math.max(0, n0 - (hh.length - 1));
        const hi = Math.min(n0, x.length - 1);
        if (lo <= hi) {
          const x1 = mapX(lo, 0, K - 1, boxX);
          const x2 = mapX(hi, 0, K - 1, boxX);
          [boxX, boxH].forEach((box) => {
            g.fillStyle = colors.primary;
            g.globalAlpha = 0.08;
            g.fillRect(x1, box.t, Math.max(2, x2 - x1), box.b - box.t);
            g.globalAlpha = 1;
          });
        }
        panelLabel(g, boxH, `h[${n0}−k]`, colors);

        // y[n]
        const boxY = { l: 48, r: w - 16, t: h * 0.67, b: h - 34 };
        drawGrid(g, boxY, 5, 2, colors);
        drawAxis(g, boxY, colors);
        drawXAxisLabels(g, boxY, 0, y.length - 1, 5, (v) => "n=" + Math.round(v), colors);
        drawYAxisLabels(g, boxY, -ymax * 1.15, ymax * 1.15, 2, colors, (v) => v.toFixed(1));
        drawStems(g, y, 0, boxY, 0, y.length - 1, -ymax * 1.15, ymax * 1.15, colors.primary);
        // 当前 n0 高亮
        const nx = mapX(n0, 0, y.length - 1, boxY);
        g.fillStyle = colors.red;
        g.globalAlpha = 0.1;
        g.fillRect(nx - 9, boxY.t, 18, boxY.b - boxY.t);
        g.globalAlpha = 1;
        const ny = mapY(y[n0], -ymax * 1.15, ymax * 1.15, boxY);
        g.fillStyle = colors.red;
        g.beginPath();
        g.arc(nx, ny, 4.5, 0, Math.PI * 2);
        g.fill();
        panelLabel(g, boxY, "y[n]", colors);

        const overlap = Math.max(0, hi - lo + 1);
        overlapEl.textContent = String(overlap);
        valEl.textContent = y[n0].toFixed(3);
        n0El.textContent = String(n0);
        status.className = "status-line";
        const terms = [];
        for (let k = lo; k <= hi; k++) terms.push(`${x[k].toFixed(2)}×${hh[n0 - k].toFixed(2)}`);
        status.innerHTML = `<strong>y[${n0}] = ${y[n0].toFixed(3)}</strong>　= ${terms.length ? terms.join(" + ") : "0（无重叠）"}`;
        repaint();
      }

      function update() {
        paintRange(nEl);
        setRange();
        draw();
      }

      xEl.addEventListener("change", () => {
        setRange();
        update();
      });
      hEl.addEventListener("change", () => {
        setRange();
        update();
      });
      nEl.addEventListener("input", update);

      playBtn.addEventListener("click", () => {
        if (timer) {
          clearInterval(timer);
          timer = null;
          playBtn.textContent = "播放";
          return;
        }
        if (+nEl.value >= +nEl.max) nEl.value = "0";
        playBtn.textContent = "暂停";
        timer = setInterval(() => {
          const next = +nEl.value + 1;
          if (next > +nEl.max) {
            clearInterval(timer);
            timer = null;
            playBtn.textContent = "播放";
            return;
          }
          nEl.value = String(next);
          update();
        }, 520);
        update();
      });

      resetBtn.addEventListener("click", () => {
        if (timer) {
          clearInterval(timer);
          timer = null;
          playBtn.textContent = "播放";
        }
        nEl.value = "0";
        update();
      });

      setRange();
      nEl.value = String(Math.min(+nEl.max, Math.round(+nEl.max / 2)));
      setDraw(draw);
      update();

      return () => {
        if (timer) clearInterval(timer);
        destroy();
      };
    },
  },

  {
    id: "quantize",
    title: "量化与 SQNR",
    short: "减少位数，观察阶梯误差与信噪比如何恶化。",
    desc: "把连续正弦量化为有限个电平，直观看到量化台阶、误差波形，以及 6.02b + 1.76 dB 的来源。",
    icon: "chip",
    color: "#be123c",
    tags: ["量化", "ADC"],
    chapter: "sampling",
    formula: String.raw`SQNR=6.02b+1.76\ \text{dB}\quad(\text{满量程正弦})`,
    points: [
      "量化步长 Δ = 2/2^b（满量程 ±1），误差在 ±Δ/2 内。",
      "每增加 1 bit，理论信噪比约提高 6 dB。",
      "输入幅度太小会浪费有效位数，太大则会削顶。",
    ],
    render() {
      return demoShell(
        "quant",
        "量化波形与误差",
        "上：连续信号 vs 量化输出　下：量化误差",
        `<span><i style="--c:var(--primary)"></i>连续信号</span>
         <span><i style="--c:var(--cyan)"></i>量化输出</span>
         <span><i style="--c:var(--red)"></i>量化误差</span>`,
        `
        ${rangeControl("quant-bits", "量化位数", 2, 12, 1, 4, " bit")}
        ${rangeControl("quant-amp", "输入幅度", 0.1, 1, 0.05, 0.9, " FS")}
        <div class="status-line" id="quant-status"></div>`,
        `
        <div class="readout"><span>量化电平数</span><strong id="quant-levels">16</strong></div>
        <div class="readout"><span>量化步长 Δ</span><strong id="quant-step">0.125</strong></div>
        <div class="readout"><span>理论 SQNR</span><strong id="quant-sqnr">25.8 dB</strong></div>
        <div class="readout"><span>实测 SNR</span><strong id="quant-snr">—</strong></div>`
      );
    },
    init(root) {
      const bitsEl = root.querySelector("#quant-bits");
      const ampEl = root.querySelector("#quant-amp");
      const { canvas, ctx, setDraw, repaint, destroy } = mountCanvas(root, 420);
      const status = root.querySelector("#quant-status");
      const levelsEl = root.querySelector("#quant-levels");
      const stepEl = root.querySelector("#quant-step");
      const sqnrEl = root.querySelector("#quant-sqnr");
      const snrEl = root.querySelector("#quant-snr");

      function draw() {
        const c = ctx();
        if (!c) return;
        const { g, w, h } = c;
        const colors = themeColors();
        clear(g, w, h);

        const b = +bitsEl.value;
        const amp = +ampEl.value;
        const levels = Math.pow(2, b);
        const delta = 2 / levels;
        const N = 480;
        const f = 3;
        const xs = [];
        const qs = [];
        const es = [];
        let sig = 0;
        let err = 0;
        for (let i = 0; i < N; i++) {
          const t = i / (N - 1);
          const v = amp * Math.cos(2 * Math.PI * f * t);
          const q = Math.max(-1, Math.min(1, Math.round(v / delta) * delta));
          xs.push(v);
          qs.push(q);
          es.push(q - v);
          sig += v * v;
          err += (q - v) * (q - v);
        }
        const snr = 10 * Math.log10(sig / Math.max(err, 1e-12));

        const boxTop = { l: 48, r: w - 16, t: 18, b: h * 0.62 };
        drawGrid(g, boxTop, 5, 4, colors);
        drawAxis(g, boxTop, colors);
        drawXAxisLabels(g, boxTop, 0, 1, 4, (v) => v.toFixed(2), colors);
        drawYAxisLabels(g, boxTop, -1.05, 1.05, 4, colors, (v) => v.toFixed(1));

        // 量化电平线
        const stepCount = Math.min(levels, 64);
        g.strokeStyle = colors.border;
        g.globalAlpha = 0.7;
        g.lineWidth = 0.6;
        for (let i = 0; i <= stepCount; i++) {
          const v = -1 + (i / stepCount) * 2;
          const y = mapY(v, -1.05, 1.05, boxTop);
          g.beginPath();
          g.moveTo(boxTop.l, y);
          g.lineTo(boxTop.r, y);
          g.stroke();
        }
        g.globalAlpha = 1;

        drawPolyline(g, xs.map((v, i) => [i / (N - 1), v]), boxTop, 0, 1, -1.05, 1.05, colors.primary, 1.4, [5, 4]);
        drawPolyline(g, qs.map((v, i) => [i / (N - 1), v]), boxTop, 0, 1, -1.05, 1.05, colors.cyan, 1.8);

        // 误差
        const boxBot = { l: 48, r: w - 16, t: h * 0.72, b: h - 34 };
        drawGrid(g, boxBot, 5, 2, colors);
        drawAxis(g, boxBot, colors);
        drawXAxisLabels(g, boxBot, 0, 1, 4, (v) => v.toFixed(2), colors);
        const emax = Math.max(delta * 0.75, 1e-4);
        drawYAxisLabels(g, boxBot, -emax, emax, 2, colors, (v) => v.toFixed(3));
        drawPolyline(g, es.map((v, i) => [i / (N - 1), v]), boxBot, 0, 1, -emax, emax, colors.red, 1.3);

        levelsEl.textContent = String(levels);
        stepEl.textContent = delta.toFixed(4);
        const sqnr = 6.02 * b + 1.76;
        sqnrEl.textContent = sqnr.toFixed(1) + " dB";
        snrEl.textContent = snr.toFixed(1) + " dB";

        if (amp > 0.95) {
          status.className = "status-line bad";
          status.innerHTML = `<strong>接近满量程：</strong>注意留出余量，避免信号峰值削顶。削顶会引入非线性失真，无法用增加位数弥补。`;
        } else if (amp < 0.35) {
          status.className = "status-line warn";
          status.innerHTML = `<strong>幅度偏小：</strong>只用了约 ${(20 * Math.log10(amp)).toFixed(1)} dB 的动态范围，有效位数被浪费。理论上每减小一半幅度，SNR 下降约 6 dB。`;
        } else {
          status.className = "status-line good";
          status.innerHTML = `<strong>量化噪声近似白噪声：</strong>实测 SNR 与理论值接近。位数每增加 1 bit，SNR 约提高 6 dB。`;
        }
        repaint();
      }

      function update() {
        paintRange(bitsEl);
        paintRange(ampEl);
        draw();
      }
      bitsEl.addEventListener("input", update);
      ampEl.addEventListener("input", update);
      setDraw(draw);
      update();
      return destroy;
    },
  },
];

/* --------------------------------------------------------------------------
   共享工具
   -------------------------------------------------------------------------- */

const FONT_MONO = '"JetBrains Mono", "Cascadia Code", Consolas, monospace';
const FONT_UI = '"Inter", "Segoe UI", "Microsoft YaHei", sans-serif';

function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    text: v("--text"),
    muted: v("--muted"),
    faint: v("--faint"),
    border: v("--border"),
    grid: v("--border"),
    primary: v("--primary"),
    primarySoft: v("--primary-soft"),
    cyan: v("--cyan"),
    amber: v("--amber"),
    red: v("--red"),
    green: v("--green"),
    surface: v("--surface"),
  };
}

function mountCanvas(root, cssHeight) {
  const canvas = root.querySelector("canvas");
  const wrap = canvas.parentElement;
  let g = null;
  let W = 0;
  let H = 0;
  let drawFn = null;

  function resize() {
    const rect = wrap.getBoundingClientRect();
    const cssW = Math.max(280, Math.round(rect.width));
    const cssH = cssW < 560 ? Math.round(cssHeight * 0.82) : cssHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = "100%";
    canvas.style.height = cssH + "px";
    g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = cssW;
    H = cssH;
    if (drawFn) drawFn();
  }

  const ro = new ResizeObserver(() => {
    clearTimeout(ro._t);
    ro._t = setTimeout(resize, 60);
  });
  ro.observe(wrap);

  const onTheme = () => resize();
  window.addEventListener("spx:theme", onTheme);

  const api = {
    canvas,
    ctx: () => (g ? { g, w: W, h: H } : null),
    setDraw: (fn) => {
      drawFn = fn;
      if (W) fn();
      else requestAnimationFrame(resize);
    },
    repaint: () => {},
    destroy: () => {
      ro.disconnect();
      window.removeEventListener("spx:theme", onTheme);
    },
  };

  resize();
  requestAnimationFrame(resize);
  return api;
}

function demoShell(id, canvasTitle, canvasSub, legend, controls, readouts) {
  return `
  <div class="demo-layout">
    <div class="canvas-card">
      <div class="canvas-head">
        <strong>${canvasTitle}</strong>
        <span>${canvasSub}</span>
      </div>
      <div class="canvas-wrap"><canvas id="canvas-${id}" role="img" aria-label="${canvasTitle}"></canvas></div>
      <div class="legend">${legend}</div>
    </div>
    <div class="demo-panel">
      <div class="panel-card">
        <h3>参数调节</h3>
        ${controls}
      </div>
      <div class="panel-card">
        <h3>实时读数</h3>
        <div class="readouts">${readouts}</div>
      </div>
    </div>
  </div>`;
}

function rangeControl(id, label, min, max, step, value, unit) {
  return `
  <div class="control">
    <div class="control-head"><label for="${id}">${label}</label><output id="${id}-out">${value}${unit}</output></div>
    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" data-unit="${unit}" />
  </div>`;
}

function paintRange(input) {
  const min = +input.min;
  const max = +input.max;
  const val = +input.value;
  const fill = ((val - min) / (max - min)) * 100;
  input.style.setProperty("--fill", fill + "%");
  const out = document.getElementById(input.id + "-out");
  if (out) out.textContent = val + (input.dataset.unit || "");
}

function plotBox(w, h) {
  return { l: 48, r: w - 16, t: 26, b: h - 34 };
}

function mapX(v, min, max, box) {
  return box.l + ((v - min) / (max - min)) * (box.r - box.l);
}
function mapY(v, min, max, box) {
  return box.b - ((v - min) / (max - min)) * (box.b - box.t);
}

function clear(g, w, h) {
  g.clearRect(0, 0, w, h);
}

function drawGrid(g, box, cols, rows, colors) {
  g.save();
  g.strokeStyle = colors.grid;
  g.globalAlpha = 0.55;
  g.lineWidth = 0.7;
  for (let i = 1; i < cols; i++) {
    const x = box.l + ((box.r - box.l) * i) / cols;
    g.beginPath();
    g.moveTo(x, box.t);
    g.lineTo(x, box.b);
    g.stroke();
  }
  for (let j = 1; j < rows; j++) {
    const y = box.t + ((box.b - box.t) * j) / rows;
    g.beginPath();
    g.moveTo(box.l, y);
    g.lineTo(box.r, y);
    g.stroke();
  }
  g.restore();
}

function drawAxis(g, box, colors) {
  g.save();
  g.strokeStyle = colors.border;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(box.l, box.b + 0.5);
  g.lineTo(box.r, box.b + 0.5);
  g.moveTo(box.l + 0.5, box.t);
  g.lineTo(box.l + 0.5, box.b);
  g.stroke();
  g.restore();
}

function drawXAxisLabels(g, box, min, max, count, fmt, colors) {
  g.save();
  g.fillStyle = colors.faint;
  g.font = "10px " + FONT_MONO;
  g.textAlign = "center";
  g.textBaseline = "top";
  for (let i = 0; i <= count; i++) {
    const v = min + ((max - min) * i) / count;
    const x = mapX(v, min, max, box);
    g.fillText(fmt(v), x, box.b + 7);
  }
  g.restore();
}

function drawYAxisLabels(g, box, min, max, count, colors, fmt) {
  g.save();
  g.fillStyle = colors.faint;
  g.font = "10px " + FONT_MONO;
  g.textAlign = "right";
  g.textBaseline = "middle";
  for (let i = 0; i <= count; i++) {
    const v = min + ((max - min) * i) / count;
    const y = mapY(v, min, max, box);
    g.fillText(fmt ? fmt(v) : v.toFixed(1), box.l - 7, y);
  }
  g.restore();
}

function drawDbLabels(g, box, min, max, colors) {
  g.save();
  g.fillStyle = colors.faint;
  g.font = "10px " + FONT_MONO;
  g.textAlign = "right";
  g.textBaseline = "middle";
  for (let db = min; db <= max; db += 20) {
    const y = mapY(db, min, max, box);
    g.fillText(db + "", box.l - 7, y);
  }
  g.restore();
}

function drawPolyline(g, pts, box, xmin, xmax, ymin, ymax, color, width, dash) {
  if (!pts.length) return;
  g.save();
  g.strokeStyle = color;
  g.lineWidth = width || 1.5;
  if (dash) g.setLineDash(dash);
  g.beginPath();
  pts.forEach(([x, y], i) => {
    const px = mapX(x, xmin, xmax, box);
    const py = mapY(y, ymin, ymax, box);
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  });
  g.stroke();
  g.restore();
}

function drawStems(g, values, startIndex, box, xmin, xmax, ymin, ymax, color) {
  drawStemsPairs(
    g,
    values.map((v, i) => [startIndex + i, v]),
    box,
    xmin,
    xmax,
    ymin,
    ymax,
    color
  );
}

function drawStemsPairs(g, pairs, box, xmin, xmax, ymin, ymax, color) {
  if (!pairs.length) return;
  g.save();
  const baseY = mapY(0, ymin, ymax, box);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 1.5;
  pairs.forEach(([x, y]) => {
    const px = mapX(x, xmin, xmax, box);
    const py = mapY(y, ymin, ymax, box);
    g.globalAlpha = 0.55;
    g.beginPath();
    g.moveTo(px, baseY);
    g.lineTo(px, py);
    g.stroke();
    g.globalAlpha = 1;
    g.beginPath();
    g.arc(px, py, 2.6, 0, Math.PI * 2);
    g.fill();
  });
  g.restore();
}

function panelLabel(g, box, text, colors) {
  g.save();
  g.fillStyle = colors.muted;
  g.font = "600 10px " + FONT_MONO;
  g.textAlign = "right";
  g.textBaseline = "top";
  g.fillText(text, box.r - 2, box.t + 2);
  g.restore();
}

function sinc(x) {
  if (Math.abs(x) < 1e-9) return 1;
  return Math.sin(Math.PI * x) / (Math.PI * x);
}

function makeWindow(type, N) {
  const w = new Array(N);
  for (let n = 0; n < N; n++) {
    const t = N > 1 ? n / (N - 1) : 0;
    switch (type) {
      case "hann":
        w[n] = 0.5 - 0.5 * Math.cos(2 * Math.PI * t);
        break;
      case "hamming":
        w[n] = 0.54 - 0.46 * Math.cos(2 * Math.PI * t);
        break;
      case "blackman":
        w[n] = 0.42 - 0.5 * Math.cos(2 * Math.PI * t) + 0.08 * Math.cos(4 * Math.PI * t);
        break;
      case "kaiser8":
      case "kaiser": {
        const beta = 8;
        const r = 2 * t - 1;
        w[n] = besselI0(beta * Math.sqrt(Math.max(0, 1 - r * r))) / besselI0(beta);
        break;
      }
      default:
        w[n] = 1;
    }
  }
  return w;
}

function besselI0(x) {
  let sum = 1;
  let term = 1;
  for (let k = 1; k < 30; k++) {
    term *= (x / (2 * k)) * (x / (2 * k));
    sum += term;
    if (term < 1e-12 * sum) break;
  }
  return sum;
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j];
        const ui = im[i + j];
        const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
        const vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr;
        im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr;
        im[i + j + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}
