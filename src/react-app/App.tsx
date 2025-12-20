import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import { AuthProvider } from "@/react-app/contexts/AuthContext";
import LoginPage from "@/react-app/pages/Login";
import DashboardPage from "@/react-app/pages/Dashboard";
import UsersPage from "@/react-app/pages/Users";
import UnitsPage from "@/react-app/pages/Units";
import RegisterUserPage from "@/react-app/pages/RegisterUser";
import PermissionsPage from "@/react-app/pages/Permissions";
import FunctionsPage from "@/react-app/pages/Functions";
import AccommodationsPage from "@/react-app/pages/Accommodations";
import RoomsPage from "@/react-app/pages/Rooms";
import EmployeesPage from "@/react-app/pages/Employees";
import EmployeeListPage from "@/react-app/pages/EmployeeList";
import TransferPage from "@/react-app/pages/Transfer";
import InspectionPage from "@/react-app/pages/Inspection";
import PurchasesXmlPage from "@/react-app/pages/PurchasesXml";
import PurchasesViewPage from "@/react-app/pages/PurchasesView";
import WorkLogsPage from "@/react-app/pages/WorkLogs";
import CategoriesPage from "@/react-app/pages/Categories";
import StatusPage from "@/react-app/pages/Status";
import ManualPurchasesPage from "@/react-app/pages/ManualPurchases";
import ReportsPage from "@/react-app/pages/Reports";
import StockMovementPage from "@/react-app/pages/StockMovement";
import ProductMovementPage from "@/react-app/pages/ProductMovement";
import CleanersPage from "@/react-app/pages/Cleaners";
import MealsPage from "@/react-app/pages/Meals";
import AbastecimentoPage from "@/react-app/pages/Abastecimento";
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
                        <Route path="employees/list" element={<EmployeeListPage />} />
                        <Route path="employees/transfer" element={<TransferPage />} />
                        <Route path="inspection" element={<InspectionPage />} />
                        <Route path="purchases/xml" element={<PurchasesXmlPage />} />
                        <Route path="purchases/view" element={<PurchasesViewPage />} />
                        <Route path="purchases/manual" element={<ManualPurchasesPage />} />
                        <Route path="permissions" element={<PermissionsPage />} />
                        <Route path="categories" element={<CategoriesPage />} />
                        <Route path="status" element={<StatusPage />} />
                        <Route path="jornada" element={<WorkLogsPage />} />
                        <Route path="reports" element={<ReportsPage />} />
                        <Route path="stock/movement" element={<StockMovementPage />} />
                        <Route path="stock/product-movement" element={<ProductMovementPage />} />
                        <Route path="cleaners" element={<CleanersPage />} />
                        <Route path="meals" element={<MealsPage />} />
                        <Route path="abastecimento" element={<AbastecimentoPage />} />
                    </Route>
                </Routes>
            </Router>
        </AuthProvider>
    );
}
