/**
 * @file Preact Accessible Toggle Switch Component
 * @module features/common/ui/components/Toggle
 * @description Standardized, accessible switch toggle replacing repetitive imperative toggle boilerplate.
 */

import { h, JSX } from 'preact';

export interface ToggleProps {
    id?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    description?: string;
    disabled?: boolean;
    className?: string;
}

export function Toggle({
    id,
    checked,
    onChange,
    label,
    description,
    disabled = false,
    className = ''
}: ToggleProps): JSX.Element {
    const handleChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        onChange(target.checked);
    };

    return (
        <div className={`toggle-control-group ${className}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            {label && (
                <div className="toggle-text-label" style={{ display: 'flex', flexDirection: 'column' }}>
                    <label htmlFor={id} style={{ cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
                        {label}
                    </label>
                    {description && (
                        <span className="toggle-description" style={{ fontSize: '0.85em', opacity: 0.75 }}>
                            {description}
                        </span>
                    )}
                </div>
            )}
            <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '38px', height: '22px' }}>
                <input
                    type="checkbox"
                    id={id}
                    checked={checked}
                    onChange={handleChange}
                    disabled={disabled}
                    style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                    className="slider round"
                    style={{
                        position: 'absolute',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: checked ? 'var(--primary-color, #4f46e5)' : '#ccc',
                        borderRadius: '22px',
                        transition: '.3s'
                    }}
                />
            </label>
        </div>
    );
}

