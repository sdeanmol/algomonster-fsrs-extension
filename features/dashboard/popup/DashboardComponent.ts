import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';

/**
 * @interface DashboardCoordinator
 * @description Contract for popup dashboard navigation and panel lifecycle management.
 */
export interface DashboardCoordinator {
    showStatus(message: string): void;
}

/**
 * @class DashboardComponent
 * @description Base class for popup option view panels.
 */
export abstract class DashboardComponent {
    coordinator: DashboardCoordinator;

    constructor(coordinator: DashboardCoordinator) {
        this.coordinator = coordinator;
    }

    /**
     * Component data load hook.
     */
    abstract load(): Promise<void>;

    /**
     * Component event listener binding hook.
     */
    abstract bindEvents(): void;

    /**
     * Delegates toast feedback notifications to parent coordinator.
     */
    showStatus(message: string): void {
        try {
            if (this.coordinator && typeof this.coordinator.showStatus === 'function') {
                this.coordinator.showStatus(message);
            }
        } catch (err) {
            UIUtils.catchError('DashboardComponent', 'Error executing showStatus', err, { message });
        }
    }
}
