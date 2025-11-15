import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import { AuthProvider } from "@/react-app/contexts/AuthContext";
import LoginPage from "@/react-app/pages/Login";
import DashboardPage from "@/react-app/pages/Dashboard";
import UsersPage from "@/react-app/pages/Users";
import UnitsPage from "@/react-app/pages/Units";
import RegisterUserPage from "@/react-app/pages/RegisterUser";
import FunctionsPage from "@/react-app/pages/Functions";
import AccommodationsPage from "@/react-app/pages/Accommodations";
import RoomsPage from "@/react-app/pages/Rooms";
import EmployeesPage from "@/react-app/pages/Employees";
import Layout from "@/react-app/components/Layout";
import ProtectedRoute from "@/react-app/components/ProtectedRoute";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/new" element={<RegisterUserPage />} />
            <Route path="units" element={<UnitsPage />} />
            <Route path="functions" element={<FunctionsPage />} />
            <Route path="accommodations" element={<AccommodationsPage />} />
            <Route path="rooms" element={<RoomsPage />} />
            <Route path="employees" element={<EmployeesPage />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
