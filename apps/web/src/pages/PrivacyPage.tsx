import { Link } from 'react-router-dom'

export function PrivacyPage() {
    return (
        <div className="mx-auto max-w-3xl px-6 py-16">
            <h1 className="text-3xl font-bold">Privacy Policy</h1>
            <p className="mt-2 text-sm text-[var(--color-text-faint)]">Last updated: March 11, 2026</p>

            <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--color-text-muted)]">
                <section>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">1. What We Collect</h2>
                    <p className="mt-2">Node Runner collects minimal data to provide the service:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-6">
                        <li><strong>Account data:</strong> When you sign in with Google or GitHub, we receive your email address, display name, and profile picture from the provider. With username-only accounts, no personal information is collected.</li>
                        <li><strong>Uploaded content:</strong> Node tree data, titles, descriptions, tags, and images you choose to upload.</li>
                        <li><strong>Usage data:</strong> Basic server logs (IP address, request path, timestamps) for security and debugging purposes.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">2. How We Use Your Data</h2>
                    <ul className="mt-2 list-disc space-y-1 pl-6">
                        <li>To authenticate you and maintain your session.</li>
                        <li>To display your public uploads and profile.</li>
                        <li>To prevent abuse (rate limiting, banning).</li>
                    </ul>
                    <p className="mt-2">We do not sell, share, or trade your personal data with third parties.</p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">3. Third-Party Services</h2>
                    <p className="mt-2">If you sign in with Google or GitHub, your authentication is handled by those providers under their respective privacy policies. We only receive the profile data listed above — we do not access your repositories, files, or other account data.</p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">4. Data Storage</h2>
                    <p className="mt-2">Your data is stored on our server. Uploaded content marked as public is visible to anyone. We do not use cookies — authentication is handled via a session token stored in your browser's local storage.</p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">5. Data Deletion</h2>
                    <p className="mt-2">You can delete your uploads at any time from your profile. To request full account deletion, contact us at the email below.</p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">6. Contact</h2>
                    <p className="mt-2">For privacy-related questions, contact: <a href="mailto:noah@thiering.org" className="text-[var(--color-accent)] hover:underline">noah@thiering.org</a></p>
                </section>
            </div>

            <div className="mt-12 text-sm text-[var(--color-text-faint)]">
                <Link to="/terms" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Terms of Service →</Link>
            </div>
        </div>
    )
}
