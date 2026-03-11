import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { RootLayout } from '@/layouts/RootLayout'
import { HomePage } from '@/pages/HomePage'
import { UploadPage } from '@/pages/UploadPage'
import { ConvertPage } from '@/pages/ConvertPage'
import { DiffPage } from '@/pages/DiffPage'
import { DiscoverPage } from '@/pages/DiscoverPage'
import { SharedPage } from '@/pages/SharedPage'
import { DocsPage } from '@/pages/DocsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { SignInPage } from '@/pages/SignInPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { UserProfilePage } from '@/pages/UserProfilePage'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'
import { AdminLoginPage } from '@/pages/AdminLoginPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { TermsPage } from '@/pages/TermsPage'

export function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<RootLayout />}>
                    <Route index element={<HomePage />} />
                    <Route path="upload" element={<UploadPage />} />
                    <Route path="paste" element={<Navigate to="/upload" replace />} />
                    <Route path="convert" element={<ConvertPage />} />
                    <Route path="diff" element={<DiffPage />} />
                    <Route path="discover" element={<DiscoverPage />} />
                    <Route path="share/:id" element={<SharedPage />} />
                    <Route path="docs" element={<DocsPage />} />
                    <Route path="signin" element={<SignInPage />} />
                    <Route path="auth/callback" element={<AuthCallbackPage />} />
                    <Route path="adminlogin" element={<AdminLoginPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="user/:userId" element={<UserProfilePage />} />
                    <Route path="privacy" element={<PrivacyPage />} />
                    <Route path="terms" element={<TermsPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}
