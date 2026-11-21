/**
 * @file Declarative Toast Notification Component (Preact)
 * @module features/common/ui/components/Toast
 * @description Listens for 'algorecall-toast' custom events or controlled props
 * to display animated status toast notifications declaratively.
 */

import { h, JSX } from 'preact';
import { useState, useEffect, useLayoutEffect, useRef } from 'preact/hooks';

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
    const toastRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (propMessage !== undefined) setMessage(propMessage);
        if (propVisible !== undefined) setVisible(propVisible);
    }, [propMessage, propVisible]);

    useLayoutEffect(() => {
        let hideTimeout: ReturnType<typeof setTimeout> | undefined;

        const handleToast = (event: Event) => {
            const customEvent = event as CustomEvent<{ message: string; durationMs?: number }>;
            if (customEvent.detail && typeof customEvent.detail.message === 'string') {
                const text = customEvent.detail.message;
                setMessage(text);
                setVisible(true);

                if (toastRef.current) {
                    toastRef.current.textContent = text;
                    toastRef.current.className = `${className} show`;
                }

                if (hideTimeout) clearTimeout(hideTimeout);
                const dur = customEvent.detail.durationMs ?? durationMs;
                hideTimeout = setTimeout(() => {
                    setVisible(false);
                    if (toastRef.current) {
                        toastRef.current.className = className;
                    }
                }, dur);
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('algorecall-toast', handleToast);
        }

        return () => {
            if (hideTimeout) clearTimeout(hideTimeout);
            if (typeof window !== 'undefined') {
                window.removeEventListener('algorecall-toast', handleToast);
            }
        };
    }, [durationMs, className]);

    return (
        <div ref={toastRef} id={id} className={`${className}${visible ? ' show' : ''}`}>
            {message}
        </div>
    );
}
