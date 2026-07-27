/**
 * @file features/dashboard/popup/DashboardComponent.ts
 * @description Base class representing a visual panel/component within the dashboard popup.
 * Provides standard lifecycle hooks (init, bindEvents) and access to the central coordinator.
 */

export class DashboardComponent {
    coordinator: any;

    /**
     * @param {any} coordinator - Reference to the central AlgoRecallDashboard coordinator.
     */
    constructor(coordinator: any) {
        this.coordinator = coordinator;
    }

    /**
     * Lifecycle method to initialize the component.
     */
    init(): void {
        this.bindEvents();
    }

    /**
     * Lifecycle method to bind DOM event listeners. To be overridden or extended by subclasses.
     */
    bindEvents(): void {}

    /**
     * Relays status toast message display back to the central coordinator.
     */
    showStatus(msg: string, isError: boolean = false): void {
        if (this.coordinator && typeof this.coordinator.showStatus === 'function') {
            this.coordinator.showStatus(msg, isError);
        }
    }
}
