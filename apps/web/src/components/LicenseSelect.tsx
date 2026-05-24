import { NODE_LICENSES, LICENSE_INFO, type NodeLicense } from '@node-runner/shared'

interface LicenseSelectProps {
    value: NodeLicense
    onChange: (license: NodeLicense) => void
}

// Dropdown + descriptive blurb so users actually understand what they're picking.
// Compact enough to slot into the upload Details step.
export function LicenseSelect({ value, onChange }: LicenseSelectProps) {
    const info = LICENSE_INFO[value]
    return (
        <div>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as NodeLicense)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none cursor-pointer"
            >
                {NODE_LICENSES.map((l) => (
                    <option key={l} value={l}>{LICENSE_INFO[l].short} - {LICENSE_INFO[l].label}</option>
                ))}
            </select>
            <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                {info.blurb}
                {info.url && (
                    <>
                        {' '}
                        <a href={info.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">
                            Read the full license
                        </a>.
                    </>
                )}
            </p>
        </div>
    )
}
