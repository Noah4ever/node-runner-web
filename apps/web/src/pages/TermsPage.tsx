import { Link } from 'react-router-dom'

export function TermsPage() {
    return (
        <div className="mx-auto max-w-3xl px-6 py-16">
            <h1 className="text-3xl font-bold">Terms of Service</h1>
            <p className="mt-2 text-sm text-[var(--color-text-faint)]">Last updated: March 11, 2026</p>

            <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--color-text-muted)]">
                <section>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">1. Acceptance</h2>
                    <p className="mt-2">By using Node Runner ("the Service"), you agree to these terms. If you do not agree, do not use the Service.</p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">2. The Service</h2>
                    <p className="mt-2">Node Runner is a free, community tool for sharing, converting, and inspecting Blender node trees. The Service is provided "as is" without warranty of any kind.</p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">3. User Content</h2>
                    <ul className="mt-2 list-disc space-y-1 pl-6">
                        <li>You retain ownership of the content you upload.</li>
                        <li>By uploading content as public, you grant other users the right to view, download, and use your shared node trees.</li>
                        <li>You must not upload content you do not have the right to share.</li>
                        <li>You must not upload malicious, illegal, or harmful content.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">4. Acceptable Use</h2>
                    <p className="mt-2">You agree not to:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-6">
                        <li>Abuse, harass, or impersonate other users.</li>
                        <li>Attempt to bypass rate limits or security measures.</li>
                        <li>Use the Service for spam or automated bulk uploads.</li>
                        <li>Upload content that is illegal or violates the rights of others.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">5. Accounts & Termination</h2>
                    <p className="mt-2">We reserve the right to ban accounts or remove content that violates these terms, at our sole discretion and without prior notice.</p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">6. Availability</h2>
                    <p className="mt-2">We do not guarantee uptime or data persistence. The Service may be modified, suspended, or discontinued at any time. Back up any content you wish to keep.</p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">7. Liability</h2>
                    <p className="mt-2">The Service is provided free of charge. To the maximum extent permitted by law, we are not liable for any damages arising from your use of the Service.</p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">8. Contact</h2>
                    <p className="mt-2">Questions about these terms? Contact: <a href="mailto:noah@thiering.org" className="text-[var(--color-accent)] hover:underline">noah@thiering.org</a></p>
                </section>
            </div>

            <div className="mt-12 text-sm text-[var(--color-text-faint)]">
                <Link to="/privacy" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Privacy Policy →</Link>
            </div>
        </div>
    )
}
