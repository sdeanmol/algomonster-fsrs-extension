import { FutureMemorySimulation } from '../../features/dashboard/analytics/memory/futureMemorySimulation.js';

describe('FutureMemorySimulation', () => {
    let mockDataUtils;

    beforeEach(() => {
        document.body.innerHTML = '<div id="future-memory-simulation-container"></div>';

        mockDataUtils = {
            getFutureMemorySimulation: jest.fn((days) => ({
                today: 92,
                d30: 61,
                d90: 28,
                d180: 11,
                custom: {
                    days: days,
                    retention: 48,
                    forgottenCount: 14,
                    totalCards: 27
                },
                curvePoints: [
                    { day: 0, retention: 92 },
                    { day: 30, retention: 61 },
                    { day: 90, retention: 28 },
                    { day: 180, retention: 11 }
                ],
                totalCards: 27,
                reviewedCards: 25
            }))
        };
    });

    it('renders Future Memory Simulation structure and step values correctly', () => {
        const sim = new FutureMemorySimulation(mockDataUtils);
        sim.render('future-memory-simulation-container');

        const container = document.getElementById('future-memory-simulation-container');
        expect(container.innerHTML).toContain('Future Memory Simulation');
        expect(container.innerHTML).toContain('What if I stop studying?');
        expect(container.innerHTML).toContain('92%');
        expect(container.innerHTML).toContain('61%');
        expect(container.innerHTML).toContain('28%');
        expect(container.innerHTML).toContain('11%');
        expect(container.innerHTML).toContain('48%');
        expect(container.innerHTML).toContain('14 / 27 cards');
    });

    it('updates projected retention when range slider changes', () => {
        const sim = new FutureMemorySimulation(mockDataUtils);
        sim.render('future-memory-simulation-container');

        const slider = document.getElementById('sim-days-range');
        slider.value = '60';
        slider.dispatchEvent(new Event('input'));

        expect(mockDataUtils.getFutureMemorySimulation).toHaveBeenCalledWith(60);
    });
});
