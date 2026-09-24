import { Navigate, Route, Routes } from 'react-router-dom'
import { DashboardLayout, RequireAuth } from './components/Layout'
import { LoginPage } from './pages/Login'
import { SignupPage } from './pages/Signup'
import { OverviewPage } from './pages/Overview'
import { AnalyticsPage } from './pages/Analytics'
import { ProductsPage } from './pages/Products'
import { SalesPage } from './pages/Sales'
import { StoreQRPage } from './pages/StoreQR'
import { IntegrationsPage } from './pages/Integrations'
import { useAuth } from './context/AuthContext'

function HomeRedirect() {
  const { session, loading } = useAuth()
  if (loading) return null
  return <Navigate to={session ? '/overview' : '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/qr" element={<StoreQRPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}