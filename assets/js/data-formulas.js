/* 谱线 · 公式速查数据 */

const FORMULA_GROUPS = [
  {
    id: "basics",
    title: "基础关系",
    desc: "脉冲、卷积与系统稳定性",
    items: [
      {
        name: "脉冲筛选",
        tex: String.raw`\sum_{n=-\infty}^{\infty}x[n]\,\delta[n-n_0]=x[n_0]`,
        note: "任意序列可分解为移位脉冲的加权和，这是卷积的起点。",
      },
      {
        name: "离散卷积",
        tex: String.raw`y[n]=x[n]*h[n]=\sum_{k=-\infty}^{\infty}x[k]\,h[n-k]`,
        note: "翻转、移位、相乘、求和。有限长序列卷积长度为 L+M-1。",
      },
      {
        name: "BIBO 稳定",
        tex: String.raw`\sum_{n=-\infty}^{\infty}\left|h[n]\right|<\infty`,
        note: "冲激响应绝对可和，等价于有界输入产生有界输出。",
      },
      {
        name: "能量与功率",
        tex: String.raw`E=\sum_{n=-\infty}^{\infty}\left|x[n]\right|^2,\qquad P=\lim_{N\to\infty}\frac{1}{2N+1}\sum_{n=-N}^{N}\left|x[n]\right|^2`,
        note: "能量信号总能量有限、平均功率为零；周期信号通常是功率信号。",
      },
      {
        name: "自相关",
        tex: String.raw`r_{xx}[l]=\sum_{n=-\infty}^{\infty}x[n]\,x[n-l]`,
        note: "实序列自相关偶对称，零延迟处取得最大值。",
      },
    ],
  },
  {
    id: "sampling",
    title: "采样与量化",
    desc: "奈奎斯特、混叠、SQNR 与过采样",
    items: [
      {
        name: "采样频谱",
        tex: String.raw`X_s(f)=\frac{1}{T_s}\sum_{k=-\infty}^{\infty}X(f-kf_s)`,
        note: "采样使频谱以 fs 为周期复制，副本不重叠才能无失真恢复。",
      },
      {
        name: "奈奎斯特准则",
        tex: String.raw`f_s>2f_{\max}`,
        note: "基带信号最高频率的两倍是采样率下限；工程上通常留 20%–100% 余量。",
      },
      {
        name: "混叠频率",
        tex: String.raw`f_{\text{alias}}=\left|f-kf_s\right|,\qquad k=\operatorname{round}\!\left(\frac{f}{f_s}\right)`,
        note: "7 Hz 以 10 Hz 采样会混叠到 3 Hz，采样后无法与原信号区分。",
      },
      {
        name: "量化步长",
        tex: String.raw`\Delta=\frac{V_{\text{FSR}}}{2^b},\qquad \sigma_e^2=\frac{\Delta^2}{12}`,
        note: "b 为位数，V_FSR 为满量程范围；舍入误差近似均匀分布。",
      },
      {
        name: "量化信噪比",
        tex: String.raw`SQNR=6.02b+1.76\ \text{dB}`,
        note: "满量程正弦输入。每增加 1 bit，信噪比约提高 6 dB。",
      },
      {
        name: "过采样增益",
        tex: String.raw`SQNR\approx6.02b+1.76+10\log_{10}(OSR),\qquad OSR=\frac{f_s}{2B}`,
        note: "仅靠过采样，采样率翻倍只改善约 3 dB；ΔΣ 噪声整形效率更高。",
      },
      {
        name: "理想重建",
        tex: String.raw`x(t)=\sum_{n=-\infty}^{\infty}x[n]\,\operatorname{sinc}\!\left(\frac{t-nT_s}{T_s}\right)`,
        note: "理想低通重建；实际 DAC 用零阶保持，频率响应带 sinc 滚降。",
      },
    ],
  },
  {
    id: "ztransform",
    title: "z 变换",
    desc: "定义、变换对、系统函数与稳定性",
    items: [
      {
        name: "z 变换定义",
        tex: String.raw`X(z)=\sum_{n=-\infty}^{\infty}x[n]\,z^{-n},\qquad z=re^{j\omega}`,
        note: "必须同时给出收敛域 ROC，否则无法唯一确定序列。",
      },
      {
        name: "基本变换对",
        tex: String.raw`a^nu[n]\ \longleftrightarrow\ \frac{1}{1-az^{-1}},\qquad |z|>|a|`,
        note: "极点位于 z=a；右边序列的 ROC 是圆外区域。",
      },
      {
        name: "系统函数",
        tex: String.raw`H(z)=\frac{Y(z)}{X(z)}=\frac{\sum_{m=0}^{M}b_mz^{-m}}{\sum_{k=0}^{N}a_kz^{-k}}`,
        note: "分母的根为极点，分子的根为零点。",
      },
      {
        name: "因果稳定判据",
        tex: String.raw`\text{因果稳定}\iff\text{所有极点满足 }|p_k|<1`,
        note: "等价于 ROC 包含单位圆。单位圆上有极点则临界稳定。",
      },
      {
        name: "频率响应",
        tex: String.raw`H(e^{j\omega})=\left.H(z)\right|_{z=e^{j\omega}}`,
        note: "单位圆上的取值。极点靠近单位圆形成谐振峰，零点在圆上形成陷波。",
      },
      {
        name: "部分分式",
        tex: String.raw`X(z)=\sum_{i}\frac{A_i}{1-p_iz^{-1}}\ \Longrightarrow\ x[n]=\sum_i A_i\,p_i^n u[n]`,
        note: "上式对应 ROC 在最外层极点之外的右边序列；左边序列方向相反。",
      },
    ],
  },
  {
    id: "fourier",
    title: "傅里叶分析与 DFT",
    desc: "DTFT、DFT、分辨率与循环卷积",
    items: [
      {
        name: "DTFT",
        tex: String.raw`X(e^{j\omega})=\sum_{n=-\infty}^{\infty}x[n]\,e^{-j\omega n}`,
        note: "时域离散导致频谱以 2π 为周期；主值区间通常取 [−π, π]。",
      },
      {
        name: "DTFT 逆变换",
        tex: String.raw`x[n]=\frac{1}{2\pi}\int_{-\pi}^{\pi}X(e^{j\omega})\,e^{j\omega n}\,d\omega`,
        note: "频域连续、周期；与 z 变换在单位圆上的取值一致。",
      },
      {
        name: "DFT",
        tex: String.raw`X[k]=\sum_{n=0}^{N-1}x[n]\,W_N^{nk},\qquad W_N=e^{-j2\pi/N}`,
        note: "N 点 DFT 把 N 个时域样本映射为 N 个频域复数，可逆。",
      },
      {
        name: "IDFT",
        tex: String.raw`x[n]=\frac{1}{N}\sum_{k=0}^{N-1}X[k]\,W_N^{-nk}`,
        note: "正变换不除以 N，逆变换除以 N；不同教材的归一化约定可能不同。",
      },
      {
        name: "频率 bin",
        tex: String.raw`f_k=k\frac{f_s}{N},\qquad k=0,1,\dots,N-1`,
        note: "前 N/2+1 个点对应 0 到奈奎斯特频率；k>N/2 为负频率。",
      },
      {
        name: "频率分辨率",
        tex: String.raw`\Delta f=\frac{f_s}{N}=\frac{1}{NT_s}=\frac{1}{T_{\text{obs}}}`,
        note: "真实分辨率只由观测时长决定。补零只是频域插值。",
      },
      {
        name: "循环卷积",
        tex: String.raw`y[n]=\sum_{m=0}^{N-1}x[m]\,h[(n-m)\bmod N]\ \longleftrightarrow\ X[k]H[k]`,
        note: "用 FFT 做线性卷积时，需补零到 N ≥ L+M−1，避免尾部绕回。",
      },
      {
        name: "DFT Parseval",
        tex: String.raw`\sum_{n=0}^{N-1}\left|x[n]\right|^2=\frac{1}{N}\sum_{k=0}^{N-1}\left|X[k]\right|^2`,
        note: "能量守恒；频域求和别忘了 1/N。",
      },
      {
        name: "补零后的频点",
        tex: String.raw`M>N:\quad \Delta f'=\frac{f_s}{M}`,
        note: "谱线变密但分辨率不变；可减小扇贝损失，不能分开原本无法分辨的频率。",
      },
    ],
  },
  {
    id: "windows",
    title: "窗函数",
    desc: "主瓣、旁瓣与常用窗",
    items: [
      {
        name: "矩形窗",
        tex: String.raw`w[n]=1,\quad 0\le n\le N-1`,
        note: "主瓣最窄（约 4π/N），旁瓣最高（−13 dB），泄漏最严重。",
      },
      {
        name: "Hann 窗",
        tex: String.raw`w[n]=0.5-0.5\cos\!\left(\frac{2\pi n}{N-1}\right)`,
        note: "主瓣约 8π/N，最高旁瓣 −31 dB，通用频谱分析首选。",
      },
      {
        name: "Hamming 窗",
        tex: String.raw`w[n]=0.54-0.46\cos\!\left(\frac{2\pi n}{N-1}\right)`,
        note: "主瓣约 8π/N，最高旁瓣 −43 dB，比 Hann 旁瓣更低。",
      },
      {
        name: "Blackman 窗",
        tex: String.raw`w[n]=0.42-0.5\cos\!\left(\frac{2\pi n}{N-1}\right)+0.08\cos\!\left(\frac{4\pi n}{N-1}\right)`,
        note: "主瓣约 12π/N，最高旁瓣 −58 dB，适合弱信号检测。",
      },
      {
        name: "Kaiser 窗",
        tex: String.raw`w[n]=\frac{I_0\!\left(\beta\sqrt{1-\left(\frac{2n}{N-1}-1\right)^2}\right)}{I_0(\beta)}`,
        note: "β 可调，在旁瓣与主瓣之间连续折中；I₀ 为零阶修正贝塞尔函数。",
      },
      {
        name: "窗特性对比",
        tex: String.raw`\begin{array}{lccc}\hline\text{窗} & \text{主瓣} & \text{旁瓣} & \text{扇贝损失}\\ \hline\text{矩形} & 4\pi/N & -13\text{ dB} & 3.92\text{ dB}\\ \text{Hann} & 8\pi/N & -31\text{ dB} & 1.42\text{ dB}\\ \text{Hamming} & 8\pi/N & -43\text{ dB} & 1.78\text{ dB}\\ \text{Blackman} & 12\pi/N & -58\text{ dB} & 1.10\text{ dB}\\ \hline\end{array}`,
        note: "主瓣越宽，频率分辨能力越弱；旁瓣越低，泄漏越少。",
      },
    ],
  },
  {
    id: "fir",
    title: "FIR 滤波器设计",
    desc: "理想低通、窗函数法与线性相位",
    items: [
      {
        name: "理想低通冲激响应",
        tex: String.raw`h_d[n]=\frac{\sin\!\left(\omega_c(n-\alpha)\right)}{\pi(n-\alpha)},\qquad \alpha=\frac{M}{2}`,
        note: "无限长、非因果；实际设计需截断并右移 α。",
      },
      {
        name: "窗函数法",
        tex: String.raw`h[n]=h_d[n-\alpha]\,w[n],\qquad n=0,1,\dots,M`,
        note: "窗的主瓣决定过渡带，旁瓣决定阻带衰减。",
      },
      {
        name: "线性相位条件",
        tex: String.raw`h[n]=\pm h[M-n]`,
        note: "实系数 FIR 对称或反对称，即可获得严格线性相位。",
      },
      {
        name: "群延迟",
        tex: String.raw`\tau_g=\frac{M}{2}\ \text{个样本}`,
        note: "所有频率延迟相同，波形不失真；代价是固定延迟。",
      },
      {
        name: "Kaiser 参数",
        tex: String.raw`\beta=\begin{cases}0.1102(A-8.7), & A>50\\0.5842(A-21)^{0.4}+0.07886(A-21), & 21<A\le50\\0, & A\le21\end{cases}`,
        note: "A 为阻带衰减（dB），用于确定 Kaiser 窗形状。",
      },
      {
        name: "Kaiser 阶数估计",
        tex: String.raw`M\approx\frac{A-8}{2.285\,\Delta\omega}`,
        note: "Δω 为过渡带宽度（rad/sample）；实际阶数需向上取整并仿真验证。",
      },
      {
        name: "FIR 与 IIR",
        tex: String.raw`\text{FIR: 稳定 + 线性相位},\qquad \text{IIR: 低阶高效}`,
        note: "相位敏感选 FIR；算力受限、只关心幅度选 IIR。",
      },
    ],
  },
  {
    id: "iir",
    title: "IIR 滤波器设计",
    desc: "双线性变换、预畸变与模拟原型",
    items: [
      {
        name: "双线性变换",
        tex: String.raw`s=\frac{2}{T}\cdot\frac{1-z^{-1}}{1+z^{-1}}`,
        note: "把 s 左半平面映射到单位圆内，稳定映射稳定，无混叠。",
      },
      {
        name: "频率畸变",
        tex: String.raw`\Omega=\frac{2}{T}\tan\!\left(\frac{\omega}{2}\right),\qquad \omega=2\arctan\!\left(\frac{\Omega T}{2}\right)`,
        note: "模拟频率 0→∞ 对应数字频率 0→π，高频被压缩。",
      },
      {
        name: "预畸变",
        tex: String.raw`\Omega_p=\frac{2}{T}\tan\!\left(\frac{\omega_p}{2}\right)`,
        note: "先把数字指标转换为模拟指标，再设计模拟原型。",
      },
      {
        name: "Butterworth 幅频",
        tex: String.raw`\left|H_a(j\Omega)\right|^2=\frac{1}{1+\left(\Omega/\Omega_c\right)^{2N}}`,
        note: "最大平坦，通带无波纹；阶数越高过渡带越陡。",
      },
      {
        name: "Butterworth 阶数",
        tex: String.raw`N\ge\frac{\log_{10}\!\left(\dfrac{10^{A_s/10}-1}{10^{A_p/10}-1}\right)}{2\log_{10}\!\left(\Omega_s/\Omega_p\right)}`,
        note: "A_p、A_s 为通带/阻带衰减（dB），Ω 为预畸变后的模拟频率。",
      },
      {
        name: "群延迟",
        tex: String.raw`\tau_g(\omega)=-\frac{d\theta(\omega)}{d\omega}`,
        note: "IIR 群延迟通常随频率变化，通带边缘可能急剧上升。",
      },
    ],
  },
  {
    id: "multirate",
    title: "多速率处理",
    desc: "抽取、插值与多相结构",
    items: [
      {
        name: "抽取",
        tex: String.raw`y[n]=x[Mn]\quad\Longrightarrow\quad Y(e^{j\omega})=\frac{1}{M}\sum_{k=0}^{M-1}X\!\left(e^{j(\omega-2\pi k)/M}\right)`,
        note: "频谱拉伸并叠加；抽取前需低通到 π/M，防止混叠。",
      },
      {
        name: "插值",
        tex: String.raw`y[n]=\begin{cases}x[n/L], & n=0,\pm L,\pm2L,\dots\\0, & \text{其他}\end{cases}\quad\Longrightarrow\quad Y(e^{j\omega})=X(e^{j\omega L})`,
        note: "补零后频谱压缩并产生镜像；需低通到 π/L 并补偿增益 L。",
      },
      {
        name: "有理数倍转换",
        tex: String.raw`\uparrow L\ \longrightarrow\ H_{\text{LP}}\!\left(\omega_c=\min\!\left(\frac{\pi}{L},\frac{\pi}{M}\right)\right)\ \longrightarrow\ \downarrow M`,
        note: "先插值再抽取，一个低通同时完成抗镜像与抗混叠。",
      },
      {
        name: "多相分解",
        tex: String.raw`H(z)=\sum_{k=0}^{L-1}z^{-k}E_k(z^L)`,
        note: "在低采样率侧计算，运算量降低约 L 倍；音频重采样与信道化器常用。",
      },
    ],
  },
  {
    id: "adaptive",
    title: "自适应与谱估计",
    desc: "LMS、周期图、Welch 与 AR",
    items: [
      {
        name: "LMS 更新",
        tex: String.raw`\mathbf{w}[n+1]=\mathbf{w}[n]+2\mu\,e[n]\,\mathbf{x}[n]`,
        note: "e[n]=d[n]−wᵀx[n]。步长 μ 决定收敛速度与稳态误差。",
      },
      {
        name: "LMS 步长范围",
        tex: String.raw`0<\mu<\frac{1}{\lambda_{\max}}\quad\text{（粗略：}\frac{1}{M\sigma_x^2}\text{）}`,
        note: "μ 过大振荡发散，过小收敛慢。",
      },
      {
        name: "NLMS",
        tex: String.raw`\mathbf{w}[n+1]=\mathbf{w}[n]+\frac{\mu}{\|\mathbf{x}[n]\|^2+\epsilon}\,e[n]\,\mathbf{x}[n]`,
        note: "按输入能量归一化，对输入功率变化不敏感。",
      },
      {
        name: "周期图",
        tex: String.raw`\hat{P}(\omega)=\frac{1}{N}\left|\sum_{n=0}^{N-1}x[n]e^{-j\omega n}\right|^2`,
        note: "实现简单但方差大；分段平均（Welch）可显著降低方差。",
      },
      {
        name: "AR 谱",
        tex: String.raw`P(\omega)=\frac{\sigma_u^2}{\left|1+\sum_{k=1}^{p}a_ke^{-j\omega k}\right|^2}`,
        note: "短数据、窄带信号分辨率高；阶数选择影响是否出现伪峰。",
      },
      {
        name: "MUSIC 谱",
        tex: String.raw`P_{\text{MUSIC}}(\theta)=\frac{1}{\mathbf{a}^H(\theta)\mathbf{E}_n\mathbf{E}_n^H\mathbf{a}(\theta)}`,
        note: "利用噪声子空间与导向矢量的正交性，需要阵列或多次快拍。",
      },
    ],
  },
];
