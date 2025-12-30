import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import { AuthProvider } from "@/react-app/contexts/AuthContext";
import LoginPage from "@/react-app/pages/Login";
import Dashboard from "@/react-app/pages/Dashboard";
import Usuarios from "@/react-app/pages/Usuarios";
import Unidades from "@/react-app/pages/Unidades";
import CadastrarUsuario from "@/react-app/pages/CadastrarUsuario";
import Permissoes from "@/react-app/pages/Permissoes";
import Funcoes from "@/react-app/pages/Funcoes";
import Alojamentos from "@/react-app/pages/Alojamentos";
import Quartos from "@/react-app/pages/Quartos";
import Funcionarios from "@/react-app/pages/Funcionarios";
import ListaFuncionarios from "@/react-app/pages/ListaFuncionarios";
import Transferencia from "@/react-app/pages/Transferencia";
import ListarTransferencias from "@/react-app/pages/ListarTransferencias";
import Vistorias from "@/react-app/pages/Vistorias";
import LancarXml from "@/react-app/pages/LancarXml";
import VisualizarNotas from "@/react-app/pages/VisualizarNotas";
import Jornada from "@/react-app/pages/Jornada";
import Categorias from "@/react-app/pages/Categorias";
import StatusFuncionarios from "@/react-app/pages/StatusFuncionarios";
import LancamentoAvulso from "@/react-app/pages/LancamentoAvulso";
import Relatorios from "@/react-app/pages/Relatorios";
import CadastroProduto from "@/react-app/pages/CadastroProduto";
import MovimentacaoProduto from "@/react-app/pages/MovimentacaoProduto";
import Faxineiras from "@/react-app/pages/Faxineiras";
import Refeicoes from "@/react-app/pages/Refeicoes";
import Abastecimento from "@/react-app/pages/Abastecimento";
import Layout from "@/react-app/components/Layout";
import RotaProtegida from "@/react-app/components/ProtectedRoute";

export default function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route
                        path="/"
                        element={
                            <RotaProtegida>
                                <Layout />
                            </RotaProtegida>
                        }
                    >
                        <Route index element={<Navigate to="/dashboard" replace />} />
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="users" element={<Usuarios />} />
                        <Route path="users/new" element={<CadastrarUsuario />} />
                        <Route path="units" element={<Unidades />} />
                        <Route path="functions" element={<Funcoes />} />
                        <Route path="accommodations" element={<Alojamentos />} />
                        <Route path="rooms" element={<Quartos />} />
                        <Route path="employees" element={<Funcionarios />} />
                        <Route path="employees/list" element={<ListaFuncionarios />} />
                        <Route path="employees/transfer" element={<Transferencia />} />
                        <Route path="employees/transfers-list" element={<ListarTransferencias />} />
                        <Route path="inspection" element={<Vistorias />} />
                        <Route path="purchases/xml" element={<LancarXml />} />
                        <Route path="purchases/view" element={<VisualizarNotas />} />
                        <Route path="purchases/manual" element={<LancamentoAvulso />} />
                        <Route path="permissions" element={<Permissoes />} />
                        <Route path="categories" element={<Categorias />} />
                        <Route path="status" element={<StatusFuncionarios />} />
                        <Route path="jornada" element={<Jornada />} />
                        <Route path="reports" element={<Relatorios />} />
                        <Route path="stock/movement" element={<CadastroProduto />} />
                        <Route path="stock/product-movement" element={<MovimentacaoProduto />} />
                        <Route path="cleaners" element={<Faxineiras />} />
                        <Route path="meals" element={<Refeicoes />} />
                        <Route path="abastecimento" element={<Abastecimento />} />
                    </Route>
                </Routes>
            </Router>
        </AuthProvider>
    );
}
