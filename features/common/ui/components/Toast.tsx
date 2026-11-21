/**
 * @file Declarative Toast Notification Component (Preact)
 * @module features/common/ui/components/Toast
 * @description Listens for 'algorecall-toast' custom events or controlled props
 * to display animated status toast notifications declaratively.
 */

import { h, JSX } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

export interface ToastProps {
    id?: string;
    message?: string;
    isVisible?: boolean;
    durationMs?: number;
    className?: string;
}

export function Toast({
    id = 'status-toast',
    message: propMessage,
    isVisible: propVisible,
    durationMs = 2500,
    className = 'toast'
}: ToastProps): JSX.Element {
    const [message, setMessage] = useState<string>(propMessage || '');
    const [visible, setVisible] = useState<boolean>(propVisible || false);
    const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const durationRef = useRef(durationMs);
    durationRef.current = durationMs;

    useEffect(() => {
        if (propMessage !== undefined) {
            setMessage(propMessage);
        }
    }, [propMessage]);

    useEffect(() => {
        if (propVisible !== undefined) {
            setVisible(propVisible);
            if (propVisible && durationMs > 0) {
                if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
                hideTimeoutRef.current = setTimeout(() => {
                    setVisible(false);
                    hideTimeoutRef.current = null;
                }, durationMs);
            } else if (!propVisible && hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
                hideTimeoutRef.current = null;
            }
        }
    }, [propVisible, durationMs]);

    useEffect(() => {
        const handleToast = (event: Event) => {
            const customEvent = event as CustomEvent<{ message: string; durationMs?: number }>;
            if (customEvent.detail && typeof customEvent.detail.message === 'string') {
                const text = customEvent.detail.message;
                setMessage(text);
                setVisible(true);

                if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
                const dur = customEvent.detail.durationMs ?? durationRef.current;
                hideTimeoutRef.current = setTimeout(() => {
                    setVisible(false);
                    hideTimeoutRef.current = null;
                }, dur);
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('algorecall-toast', handleToast);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('algorecall-toast', handleToast);
            }
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
                hideTimeoutRef.current = null;
            }
        };
    }, []);

    return (
        <div id={id} className={`${className}${visible ? ' show' : ''}`}>
            {message}
        </div>
    );
}
