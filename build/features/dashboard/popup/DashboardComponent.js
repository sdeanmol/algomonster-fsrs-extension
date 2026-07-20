/**
 * @file features/dashboard/popup/DashboardComponent.js
 * @description Base class representing a visual panel/component within the dashboard popup.
 * Provides standard lifecycle hooks (init, bindEvents) and access to the central coordinator.
 */

export class DashboardComponent {
    /**
     * @param {Object} coordinator - Reference to the central AlgoRecallDashboard coordinator.
     */
    constructor(coordinator) {
        this.coordinator = coordinator;
    }

    /**
     * Lifecycle method to initialize the component.
     */
    init() {
        this.bindEvents();
    }

    /**
     * Lifecycle method to bind DOM event listeners. To be overridden or extended by subclasses.
     */
    bindEvents() {}

    /**
     * Relays status toast message display back to the central coordinator.
     * @param {string} msg - Message description.
     * @param {boolean} [isError=false] - Signals if the message indicates an error.
     */
    showStatus(msg, isError = false) {
        this.coordinator.showStatus(msg, isError);
    }
}
