/**
 * @file features/dashboard/popup/DashboardComponent.tsx
 * @description Base class and coordinator interface for modular popup dashboard panels.
 * Encapsulates the component lifecycle (data fetching, DOM event binding, status toasts)
 * across stats, heatmap, notifications, ratings, and search sub-views.
 * Migrated to Preact with TypeScript for unified component hierarchies.
 *
 * Architecture Role: Popup Sub-View Component Contract.
 * Context: Extension Popup UI (`features/dashboard/popup/popup.html`).
 * Key Exports:
 * - `DashboardCoordinator`: Navigation and notification contract for parent orchestrator.
 * - `DashboardComponent`: Abstract base class providing lifecycle hooks for child panels.
 */

import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';

/**
 * Contract for popup dashboard navigation and panel lifecycle management.
 * Implemented by AlgoRecallDashboard to receive notifications from child components.
 */
export interface DashboardCoordinator {
    /**
     * Displays a transient status or feedback toast notification in the popup header.
     * @param message - User-facing message to display in the toast banner.
     */
    showStatus(message: string): void;
}

/**
 * Abstract base class for popup option view panels and sub-components.
 * Standardizes async initialization, event attachment, and toast feedback routing.
 */
export abstract class DashboardComponent {
    /** Parent coordinator responsible for global popup view state and toast feedback. */
    coordinator: DashboardCoordinator;

    /**
     * Initializes the component with a reference to the dashboard coordinator.
     * @param coordinator - Parent dashboard coordinator instance.
     */
    constructor(coordinator: DashboardCoordinator) {
        this.coordinator = coordinator;
    }

    /**
     * Component data load hook. Fetches storage data or computes initial presentation state.
     * @async
     * @returns Promise resolving when component state has loaded.
     */
    abstract load(): Promise<void>;

    /**
     * Component event listener binding hook. Attaches DOM listeners for user interactions.
     */
    abstract bindEvents(): void;

    /**
     * Delegates toast feedback notifications to parent coordinator.
     * @param message - User-facing notification message string.
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

if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).DashboardComponent = DashboardComponent;
}

