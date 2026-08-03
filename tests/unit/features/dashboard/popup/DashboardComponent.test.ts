import { describe, it, expect, jest } from '@jest/globals';
import { DashboardComponent, DashboardCoordinator } from '../../../../../features/dashboard/popup/DashboardComponent';

class TestComponent extends DashboardComponent {
  async load(): Promise<void> {}
  bindEvents(): void {}
}

describe('DashboardComponent', () => {
  it('delegates showStatus message to coordinator', () => {
    const mockCoordinator: DashboardCoordinator = {
      showStatus: jest.fn()
    };

    const component = new TestComponent(mockCoordinator);
    component.showStatus('Test Toast Message');

    expect(mockCoordinator.showStatus).toHaveBeenCalledWith('Test Toast Message');
  });

  it('handles exceptions in showStatus gracefully', () => {
    const mockCoordinator: DashboardCoordinator = {
      showStatus: jest.fn().mockImplementation(() => {
        throw new Error('Coordinator Toast Error');
      })
    };

    const component = new TestComponent(mockCoordinator);
    expect(() => component.showStatus('Error Message')).not.toThrow();
  });
});
