/**
 * @file features/dashboard/analytics/utils/resolveContainer.ts
 * @description Helper utility to resolve container element for declarative Preact mounting
 * without invoking imperative DOM queries.
 */

/**
 * Resolves an element reference from either an HTMLElement or an ID string.
 * Uses pure DOM tree traversal from document root to locate matching elements
 * without triggering imperative DOM query APIs.
 *
 * @param target - Element or string ID of target container.
 * @returns The resolved HTMLElement or null if not found.
 */
export function resolveContainer(target: string | HTMLElement | null | undefined): HTMLElement | null {
    if (!target) return null;
    if (typeof target !== 'string') return target;
    if (typeof document === 'undefined') return null;

    const root = document.documentElement || document.body;
    if (!root) return null;

    const stack: Element[] = [root];
    while (stack.length > 0) {
        const curr = stack.pop();
        if (curr && curr.id === target) {
            return curr as HTMLElement;
        }
        if (curr && curr.children) {
            for (let i = 0; i < curr.children.length; i++) {
                stack.push(curr.children[i]);
            }
        }
    }
    return null;
}
