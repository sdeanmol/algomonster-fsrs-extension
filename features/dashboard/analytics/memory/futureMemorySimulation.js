/**
 * @file features/dashboard/analytics/memory/futureMemorySimulation.js
 * @description Interactive Future Memory Simulation component predicting memory decay
 * if a user stops studying (Today, 30d, 90d, 180d, and interactive day slider).
 */

export class FutureMemorySimulation {
    constructor(dataUtils) {
        this.dataUtils = dataUtils;
        this.sliderDays = 45;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const data = this.dataUtils.getFutureMemorySimulation(this.sliderDays);
        const { svgPathD, areaPathD, currentX, currentY } = this.generateCurveSvgPath(data.curvePoints, data.custom.retention);

        container.innerHTML = `
            <div class="memory-panel ana-panel-wide future-sim-panel">
                <div class="ana-panel-header">
                    <div>
                        <span class="ana-panel-title">
                            Future Memory Simulation
                            <span class="help-icon" data-tooltip="Simulates how your overall retention percentage decays over time if you stop reviewing today.">?</span>
                        </span>
                        <p class="sim-subtitle">Predict: <strong>&ldquo;What if I stop studying?&rdquo;</strong></p>
                    </div>
                </div>

                <!-- 4 Milestone Step Cards -->
                <div class="sim-steps-grid">
                    <div class="sim-step-card step-today">
                        <div class="step-header">
                            <span class="step-label">Today</span>
                            <span class="step-badge badge-today">Current</span>
                        </div>
                        <div class="step-value-wrap">
                            <span class="step-value text-success">${data.today}%</span>
                            <span class="step-sub">Retention</span>
                        </div>
                        <div class="step-bar-bg">
                            <div class="step-bar-fill fill-success" style="width: ${data.today}%;"></div>
                        </div>
                    </div>

                    <div class="sim-step-card step-30d">
                        <div class="step-header">
                            <span class="step-label">After 30 Days</span>
                            <span class="step-badge badge-30d">+30d</span>
                        </div>
                        <div class="step-value-wrap">
                            <span class="step-value ${data.d30 >= 75 ? 'text-success' : (data.d30 >= 50 ? 'text-warning' : 'text-danger')}">${data.d30}%</span>
                            <span class="step-sub">Retention</span>
                        </div>
                        <div class="step-bar-bg">
                            <div class="step-bar-fill ${data.d30 >= 75 ? 'fill-success' : (data.d30 >= 50 ? 'fill-warning' : 'fill-danger')}" style="width: ${data.d30}%;"></div>
                        </div>
                    </div>

                    <div class="sim-step-card step-90d">
                        <div class="step-header">
                            <span class="step-label">After 90 Days</span>
                            <span class="step-badge badge-90d">+90d</span>
                        </div>
                        <div class="step-value-wrap">
                            <span class="step-value ${data.d90 >= 50 ? 'text-warning' : 'text-danger'}">${data.d90}%</span>
                            <span class="step-sub">Retention</span>
                        </div>
                        <div class="step-bar-bg">
                            <div class="step-bar-fill ${data.d90 >= 50 ? 'fill-warning' : 'fill-danger'}" style="width: ${data.d90}%;"></div>
                        </div>
                    </div>

                    <div class="sim-step-card step-180d">
                        <div class="step-header">
                            <span class="step-label">After 180 Days</span>
                            <span class="step-badge badge-180d">+180d</span>
                        </div>
                        <div class="step-value-wrap">
                            <span class="step-value text-danger">${data.d180}%</span>
                            <span class="step-sub">Retention</span>
                        </div>
                        <div class="step-bar-bg">
                            <div class="step-bar-fill fill-danger" style="width: ${data.d180}%;"></div>
                        </div>
                    </div>
                </div>

                <!-- Interactive Time Scrubbing Control -->
                <div class="sim-interactive-box">
                    <div class="sim-slider-row">
                        <div class="slider-header-wrap">
                            <span class="slider-title">Simulate zero reviews for:</span>
                            <span class="slider-days-pill"><strong>${data.custom.days}</strong> days</span>
                        </div>
                        <input type="range" id="sim-days-range" class="sim-range-slider" 
                               min="0" max="180" step="5" value="${data.custom.days}" aria-label="Simulated days">
                    </div>

                    <div class="sim-output-row">
                        <div class="sim-stat-pill">
                            <span class="stat-lbl">Projected Retention</span>
                            <span class="stat-val ${data.custom.retention >= 75 ? 'text-success' : (data.custom.retention >= 50 ? 'text-warning' : 'text-danger')}">${data.custom.retention}%</span>
                        </div>
                        <div class="sim-stat-pill">
                            <span class="stat-lbl">Patterns at High Risk (<70%)</span>
                            <span class="stat-val ${data.custom.forgottenCount > 0 ? 'text-danger' : 'text-success'}">${data.custom.forgottenCount} / ${data.totalCards} cards</span>
                        </div>
                    </div>
                </div>

                <!-- Visual Decay Chart aligned with Memory Tab chart styling -->
                <div class="sim-chart-section">
                    <div class="chart-title-wrap">
                        <span class="chart-heading">FSRS Memory Decay Trajectory</span>
                        <span class="target-ref-legend"><span class="legend-line"></span> 90% Target Retention Line</span>
                    </div>
                    <div class="ana-chart-area sim-svg-wrapper">
                        <svg class="retention-curve-svg multi-line" viewBox="0 0 900 250" preserveAspectRatio="none" style="width: 100%; height: 100%; min-height: 250px;">
                            <defs>
                                <linearGradient id="simDecayGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#a8c7fa" stop-opacity="0.25"/>
                                    <stop offset="100%" stop-color="#a8c7fa" stop-opacity="0.0"/>
                                </linearGradient>
                            </defs>

                            <!-- Grid lines & Axis Y Labels (0%, 25%, 50%, 75%, 100%) -->
                            <line class="retention-grid-line" x1="50" y1="20" x2="880" y2="20" />
                            <text class="retention-axis-label" x="40" y="24" text-anchor="end">100%</text>

                            <line class="retention-grid-line" x1="50" y1="67.5" x2="880" y2="67.5" />
                            <text class="retention-axis-label" x="40" y="71.5" text-anchor="end">75%</text>

                            <line class="retention-grid-line" x1="50" y1="115" x2="880" y2="115" />
                            <text class="retention-axis-label" x="40" y="119" text-anchor="end">50%</text>

                            <line class="retention-grid-line" x1="50" y1="162.5" x2="880" y2="162.5" />
                            <text class="retention-axis-label" x="40" y="166.5" text-anchor="end">25%</text>

                            <line class="retention-grid-line" x1="50" y1="210" x2="880" y2="210" />
                            <text class="retention-axis-label" x="40" y="214" text-anchor="end">0%</text>

                            <!-- Target 90% Retention Line (Y = 20 + 0.1 * 190 = 39) -->
                            <line x1="50" y1="39" x2="880" y2="39" stroke="#81c995" stroke-width="1.5" stroke-dasharray="5 5"></line>

                            <!-- Area fill under curve -->
                            <path d="${areaPathD}" fill="url(#simDecayGrad)"></path>

                            <!-- Main Decay Curve -->
                            <path d="${svgPathD}" fill="none" stroke="#a8c7fa" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></path>

                            <!-- Interactive Position Indicator Circle -->
                            <circle cx="${currentX}" cy="${currentY}" r="6" fill="#a8c7fa" class="retention-dot"></circle>

                            <!-- X Axis Day Labels -->
                            <text class="retention-axis-label" x="50" y="240" text-anchor="middle">Now</text>
                            <text class="retention-axis-label" x="188" y="240" text-anchor="middle">30d</text>
                            <text class="retention-axis-label" x="326" y="240" text-anchor="middle">60d</text>
                            <text class="retention-axis-label" x="465" y="240" text-anchor="middle">90d</text>
                            <text class="retention-axis-label" x="603" y="240" text-anchor="middle">120d</text>
                            <text class="retention-axis-label" x="741" y="240" text-anchor="middle">150d</text>
                            <text class="retention-axis-label" x="880" y="240" text-anchor="middle">180d</text>
                        </svg>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    generateCurveSvgPath(points, currentRetentionVal) {
        const svgW = 900, svgH = 250;
        const padL = 50, padR = 20, padT = 20, padB = 40;
        const chartW = svgW - padL - padR; // 830
        const chartH = svgH - padT - padB; // 190

        const xScale = (t) => padL + (t / 180) * chartW;
        const yScale = (r) => padT + (1 - r) * chartH;

        if (!points || points.length === 0) {
            return {
                svgPathD: `M${padL},${yScale(0.9)} L${svgW - padR},${yScale(0.1)}`,
                areaPathD: `M${padL},${yScale(0.9)} L${svgW - padR},${yScale(0.1)} L${svgW - padR},${padT + chartH} L${padL},${padT + chartH} Z`,
                currentX: xScale(this.sliderDays),
                currentY: yScale(0.5)
            };
        }

        const coords = points.map(p => {
            const rRatio = Math.max(0, Math.min(100, p.retention)) / 100;
            return {
                x: Math.round(xScale(p.day) * 10) / 10,
                y: Math.round(yScale(rRatio) * 10) / 10
            };
        });

        const pathStr = coords.map(c => `${c.x},${c.y}`).join(' L');
        const svgPathD = `M${pathStr}`;
        const areaPathD = `M${pathStr} L${svgW - padR},${padT + chartH} L${padL},${padT + chartH} Z`;

        const sliderR = Math.max(0, Math.min(100, currentRetentionVal)) / 100;
        const currentX = Math.round(xScale(this.sliderDays) * 10) / 10;
        const currentY = Math.round(yScale(sliderR) * 10) / 10;

        return { svgPathD, areaPathD, currentX, currentY };
    }

    bindEvents() {
        const slider = document.getElementById('sim-days-range');
        if (slider) {
            slider.addEventListener('input', (e) => {
                const days = parseInt(e.target.value, 10);
                if (!isNaN(days)) {
                    this.sliderDays = days;
                    this.render('future-memory-simulation-container');
                }
            });
        }
    }
}

