/**
 * @file features/dashboard/analytics/memory/futureMemorySimulation.ts
 * @description Interactive Future Memory Simulation component predicting deck-wide retention decay
 * if a user ceases studying. Features milestone snapshots (Today, 30d, 90d, 180d), an interactive
 * slider to simulate hypothetical day pauses, and an SVG decay trajectory curve.
 * @context Popup / Analytics SPA Dashboard
 */

import { RECALL_THRESHOLD_GOOD, RECALL_THRESHOLD_WARNING } from '@common/constants';
import { UIUtils } from '../../../common/utils/uiUtils';
import { DataUtils, FutureMemorySimulationStats } from '../utils/dataUtils';

/**
 * Visualizes projected memory decay over time under a zero-review scenario.
 * Allows users to scrub through 0 to 180 simulated days to assess forgetfulness risks.
 */
export class FutureMemorySimulation {
    /** Data utility instance providing decay simulations and card counts */
    dataUtils: DataUtils;
    /** Current day offset selected on the interactive scrubber slider */
    sliderDays: number;
    /** Cached DOM container ID used for re-rendering on slider input */
    lastContainerId: string;

    /**
     * Initializes the FutureMemorySimulation component with default 45-day slider offset.
     * @param dataUtils - Card statistics helper instance.
     */
    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
            this.sliderDays = 45;
            this.lastContainerId = 'tab-simulation';
        } catch (err) {
            UIUtils.catchError('FutureMemorySimulation', 'Error initializing FutureMemorySimulation constructor', err);
            this.dataUtils = dataUtils;
            this.sliderDays = 45;
            this.lastContainerId = 'tab-simulation';
        }
    }

    /**
     * Main entry point to render the future memory simulation into the target container.
     * Generates snapshot cards, slider controls, and the SVG decay trajectory.
     * @param containerId - DOM ID of the container element hosting the simulation.
     * @returns void
     */
    render(containerId: string): void {
        try {
            this.lastContainerId = containerId;
            const container = document.getElementById(containerId);
            if (!container) return;

            // 1. Fetch simulation data and calculate SVG geometry
            const data = this.dataUtils.getFutureMemorySimulation(this.sliderDays);
            const { svgPathD, areaPathD, currentX, currentY } = this.generateCurveSvgPath(data.curvePoints, data.custom.retention);

            // 2. Build UI sections
            const cardsHtml = this.buildSimulationCardsHTML(data);
            const sliderHtml = this.buildInteractiveSliderHTML(data);
            const chartHtml = this.buildChartHTML(svgPathD, areaPathD, currentX, currentY);

            // 3. Assemble and inject HTML
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
                    ${cardsHtml}
                    ${sliderHtml}
                    ${chartHtml}
                </div>
            `;

            this.bindEvents();
        } catch (err) {
            UIUtils.catchError('FutureMemorySimulation', 'Error rendering FutureMemorySimulation', err, { containerId, sliderDays: this.sliderDays });
        }
    }

    /**
     * Calculates SVG path coordinates for the decay line, area fill gradient, and active slider dot.
     * @param points - Array of projected day offsets and retention percentages.
     * @param currentRetentionVal - Simulated retention at current slider position.
     * @returns Object containing SVG path strings and dot position coordinates.
     */
    generateCurveSvgPath(points: Array<{ day: number; retention: number }>, currentRetentionVal: number): { svgPathD: string; areaPathD: string; currentX: number; currentY: number } {
        try {
            const svgW = 900, svgH = 250;
            const padL = 50, padR = 20, padT = 20, padB = 40;
            const chartW = svgW - padL - padR;
            const chartH = svgH - padT - padB;

            const xScale = (t: number) => padL + (t / 180) * chartW;
            const yScale = (r: number) => padT + (1 - r) * chartH;

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
        } catch (err) {
            UIUtils.catchError('FutureMemorySimulation', 'Error generating curve SVG path', err, { currentRetentionVal });
            return {
                svgPathD: 'M50,20 L880,210',
                areaPathD: 'M50,20 L880,210 L880,230 L50,230 Z',
                currentX: 50,
                currentY: 20
            };
        }
    }

    /**
     * Binds input event listeners to the interactive range slider to trigger real-time re-renders.
     * @returns void
     */
    bindEvents(): void {
        try {
            const slider = document.getElementById('sim-days-range') as HTMLInputElement | null;
            if (slider) {
                slider.addEventListener('input', (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        const days = parseInt(target.value, 10);
                        if (!isNaN(days)) {
                            this.sliderDays = days;
                            this.render(this.lastContainerId);
                        }
                    } catch (inputErr) {
                        UIUtils.catchError('FutureMemorySimulation', 'Error handling sim-days-range input event', inputErr);
                    }
                });
            }
        } catch (err) {
            UIUtils.catchError('FutureMemorySimulation', 'Error binding FutureMemorySimulation event listeners', err);
        }
    }

    /**
     * Generates HTML for the metric cards showing static snapshots at Today, 30d, 90d, and 180d milestones.
     * @param data - Full simulation results across default time intervals.
     * @returns Rendered HTML grid of snapshot metric cards.
     */
    private buildSimulationCardsHTML(data: FutureMemorySimulationStats): string {
        return `
            <div class="sim-steps-grid">
                <div class="sim-step-card step-today">
                    <div class="step-header">
                        <span class="step-label">Today</span>
                        <span class="step-badge badge-today">Current</span>
                    </div>
                    <div class="step-value-wrap">
                        <span class="step-value ${data.today >= RECALL_THRESHOLD_GOOD ? 'text-success' : (data.today >= RECALL_THRESHOLD_WARNING ? 'text-warning' : 'text-danger')}">${data.today}%</span>
                        <span class="step-sub">Retention</span>
                    </div>
                    <div class="step-bar-bg">
                        <div class="step-bar-fill ${data.today >= RECALL_THRESHOLD_GOOD ? 'fill-success' : (data.today >= RECALL_THRESHOLD_WARNING ? 'fill-warning' : 'fill-danger')}" style="width: ${data.today}%;"></div>
                    </div>
                </div>

                <div class="sim-step-card step-30d">
                    <div class="step-header">
                        <span class="step-label">After 30 Days</span>
                        <span class="step-badge badge-30d">+30d</span>
                    </div>
                    <div class="step-value-wrap">
                        <span class="step-value ${data.d30 >= RECALL_THRESHOLD_GOOD ? 'text-success' : (data.d30 >= RECALL_THRESHOLD_WARNING ? 'text-warning' : 'text-danger')}">${data.d30}%</span>
                        <span class="step-sub">Retention</span>
                    </div>
                    <div class="step-bar-bg">
                        <div class="step-bar-fill ${data.d30 >= RECALL_THRESHOLD_GOOD ? 'fill-success' : (data.d30 >= RECALL_THRESHOLD_WARNING ? 'fill-warning' : 'fill-danger')}" style="width: ${data.d30}%;"></div>
                    </div>
                </div>

                <div class="sim-step-card step-90d">
                    <div class="step-header">
                        <span class="step-label">After 90 Days</span>
                        <span class="step-badge badge-90d">+90d</span>
                    </div>
                    <div class="step-value-wrap">
                        <span class="step-value ${data.d90 >= RECALL_THRESHOLD_GOOD ? 'text-success' : (data.d90 >= RECALL_THRESHOLD_WARNING ? 'text-warning' : 'text-danger')}">${data.d90}%</span>
                        <span class="step-sub">Retention</span>
                    </div>
                    <div class="step-bar-bg">
                        <div class="step-bar-fill ${data.d90 >= RECALL_THRESHOLD_GOOD ? 'fill-success' : (data.d90 >= RECALL_THRESHOLD_WARNING ? 'fill-warning' : 'fill-danger')}" style="width: ${data.d90}%;"></div>
                    </div>
                </div>

                <div class="sim-step-card step-180d">
                    <div class="step-header">
                        <span class="step-label">After 180 Days</span>
                        <span class="step-badge badge-180d">+180d</span>
                    </div>
                    <div class="step-value-wrap">
                        <span class="step-value ${data.d180 >= RECALL_THRESHOLD_GOOD ? 'text-success' : (data.d180 >= RECALL_THRESHOLD_WARNING ? 'text-warning' : 'text-danger')}">${data.d180}%</span>
                        <span class="step-sub">Retention</span>
                    </div>
                    <div class="step-bar-bg">
                        <div class="step-bar-fill ${data.d180 >= RECALL_THRESHOLD_GOOD ? 'fill-success' : (data.d180 >= RECALL_THRESHOLD_WARNING ? 'fill-warning' : 'fill-danger')}" style="width: ${data.d180}%;"></div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generates HTML for the interactive day slider and dynamic projections.
     * @param data - Full simulation results containing custom slider projection.
     * @returns Rendered HTML interactive box string.
     */
    private buildInteractiveSliderHTML(data: FutureMemorySimulationStats): string {
        return `
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
                        <span class="stat-val ${data.custom.retention >= RECALL_THRESHOLD_GOOD ? 'text-success' : (data.custom.retention >= RECALL_THRESHOLD_WARNING ? 'text-warning' : 'text-danger')}">${data.custom.retention}%</span>
                    </div>
                    <div class="sim-stat-pill">
                        <span class="stat-lbl">Patterns at High Risk (&lt;70%)</span>
                        <span class="stat-val ${data.custom.forgottenCount > 0 ? 'text-danger' : 'text-success'}">${data.custom.forgottenCount} / ${data.totalCards} cards</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generates HTML for the SVG chart depicting the decay trajectory.
     * @param svgPathD - SVG stroke path definition string for the decay line.
     * @param areaPathD - SVG fill path definition string for the gradient fill.
     * @param currentX - Scaled X coordinate for the active day scrubber marker dot.
     * @param currentY - Scaled Y coordinate for the active day scrubber marker dot.
     * @returns Rendered HTML chart container markup string.
     */
    private buildChartHTML(svgPathD: string, areaPathD: string, currentX: number, currentY: number): string {
        return `
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

                        <line x1="50" y1="39" x2="880" y2="39" stroke="#81c995" stroke-width="1.5" stroke-dasharray="5 5"></line>

                        <path d="${areaPathD}" fill="url(#simDecayGrad)"></path>

                        <path d="${svgPathD}" fill="none" stroke="#a8c7fa" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></path>

                        <circle cx="${currentX}" cy="${currentY}" r="6" fill="#a8c7fa" class="retention-dot"></circle>

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
        `;
    }
}
