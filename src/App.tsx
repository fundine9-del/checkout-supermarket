import { Navigate, Route, Routes } from 'react-router-dom'
import { DashboardLayout, RequireAuth } from './components/Layout'
import { LoginPage } from './pages/Login'
import { SignupPage } from './pages/Signup'
import { OverviewPage } from './pages/Overview'
import { ProductsPage } from './pages/Products'
import { SalesPage } from './pages/Sales'
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
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/sales" element={<SalesPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}