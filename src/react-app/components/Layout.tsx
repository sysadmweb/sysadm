import { Outlet, NavLink, useNavigate } from "react-router";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/react-app/supabase";
import { usePermissions } from "@/react-app/hooks/usePermissions";
import {
    LayoutDashboard,
    Users,
    Building2,
    Briefcase,
    Home,
    UserCircle,
    LogOut,
    UserLock,
    ShoppingCart,
    FileText,
    Upload,
    ChevronDown,
    ChevronRight,
    ClipboardCheck,
    Clock,
    Tag,
    Activity,
    Package,
    Utensils,
    Fuel,
    Settings
} from "lucide-react";

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [dbStatus, setDbStatus] = useState<{ ok: boolean; message: string } | null>(null);
    const { get } = usePermissions();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
    const navRef = useRef<HTMLDivElement>(null);

    const toggleMenu = (key: string) => {
        // Save current scroll position
        const scrollPos = navRef.current?.scrollTop || 0;

        setExpandedMenus((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );

        // Restore scroll position after state update
        setTimeout(() => {
            if (navRef.current) {
                navRef.current.scrollTop = scrollPos;
            }
        }, 0);
    };

    useEffect(() => {
        const check = async () => {
            const { error } = await supabase.from("unidades").select("id", { head: true }).limit(1);
            setDbStatus({ ok: !error, message: !error ? "Conexão ativa" : "Sem conexão" });
        };
        check();
    }, []);

    type NavItem = {
        path: string;
        icon: any;
        label: string;
        key: string;
        children?: { path: string; icon: any; label: string; key?: string }[];
    };

    const rawNavItems: NavItem[] = [
        { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard", key: "dashboard" },
        {
            path: "/employees-group",
            icon: UserCircle,
            label: "Funcionários",
            key: "employees",
            children: [
                { path: "/employees", icon: UserCircle, label: "Integração", key: "employees_integration" },
                { path: "/employees/list", icon: UserCircle, label: "Lista de funcionários", key: "employees_list" },
                { path: "/employees/transfer", icon: UserCircle, label: "Transferência", key: "employees_transfer" },
                { path: "/employees/transfers-list", icon: UserCircle, label: "Histórico de Transferências", key: "employees_transfers_list" },

            ],
        },
        { path: "/accommodations", icon: Home, label: "Alojamentos", key: "accommodations" },
        // { path: "/rooms", icon: Bed, label: "Quartos", key: "rooms" },
        { path: "/functions", icon: Briefcase, label: "Funções", key: "functions" },
        { path: "/categories", icon: Tag, label: "Categorias", key: "categories" },
        { path: "/status", icon: Activity, label: "Status", key: "status" },
        { path: "/inspection", icon: ClipboardCheck, label: "Vistorias", key: "inspection" },
        { path: "/jornada", icon: Clock, label: "Jornada", key: "jornada" },
        { path: "/reports", icon: FileText, label: "Relatórios", key: "reports" },
        { path: "/meals", icon: Utensils, label: "Refeição", key: "meals" },
        { path: "/abastecimento", icon: Fuel, label: "Abastecimento", key: "fuel_supply" },
        {
            path: "/purchases",
            icon: ShoppingCart,
            label: "Compras",
            key: "purchases",
            children: [
                { path: "/purchases/xml", icon: Upload, label: "Lançar XML" },
                { path: "/purchases/manual", icon: FileText, label: "Lançamento Avulso" },
                { path: "/purchases/view", icon: FileText, label: "Visualizar Nota" },
            ],
        },
        {
            path: "/stock",
            icon: Package,
            label: "Estoque",
            key: "stock",
            children: [
                { path: "/stock/movement", icon: Package, label: "Cadastro de Produto" },
                { path: "/stock/product-movement", icon: Package, label: "Movimentação" },
            ],
        },
        { path: "/cleaners", icon: Users, label: "Faxineiras", key: "cleaners" },
        ...(user?.is_super_user ? [{ path: "/units", icon: Building2, label: "Unidades", key: "units" }] : []),
        ...(user?.is_super_user ? [{ path: "/users", icon: Users, label: "Usuários", key: "users" }] : []),
        ...(user?.is_super_user ? [{ path: "/permissions", icon: UserLock, label: "Regras", key: "permissions" }] : []),
        { path: "/settings", icon: Settings, label: "Configurações", key: "settings" },
    ];

    const navItems = rawNavItems.filter((item) => {
        // First check if the parent item itself is allowed
        if (!get(item.key).can_view) return false;

        // If it has children, filter them
        if (item.children) {
            const visibleChildren = item.children.filter((child) => {
                // If child has a key, check permission. If not, assume it inherits parent's permission (or is always visible if parent is)
                return child.key ? get(child.key).can_view : true;
            });

            // If no children are visible, hide the parent (optional, but usually desired)
            if (visibleChildren.length === 0) return false;

            // Update the item's children to only include visible ones
            item.children = visibleChildren;
        }

        return true;
    });

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            <div className="p-6 border-b border-slate-700/50 flex-shrink-0">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    SysADM
                </h1>
                <p className="text-sm text-slate-400 mt-1">Gestão Administrativa</p>
            </div>

            <nav ref={navRef} className="p-4 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                {navItems.map((item) => (
                    <div key={item.key}>
                        {item.children ? (
                            <div>
                                <button
                                    onClick={() => toggleMenu(item.key)}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 ${expandedMenus.includes(item.key) ? "bg-slate-800/30" : ""
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon className="w-5 h-5" />
                                        <span className="font-medium">{item.label}</span>
                                    </div>
                                    {expandedMenus.includes(item.key) ? (
                                        <ChevronDown className="w-4 h-4" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4" />
                                    )}
                                </button>
                                {expandedMenus.includes(item.key) && (
                                    <div className="ml-4 mt-1 space-y-1 border-l border-slate-700/50 pl-2">
                                        {item.children.map((child) => (
                                            <NavLink
                                                key={child.path}
                                                to={child.path}
                                                end
                                                onClick={() => setMobileOpen(false)}
                                                className={({ isActive }) =>
                                                    `flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 text-sm ${isActive
                                                        ? "text-blue-400 bg-blue-500/10"
                                                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                                                    }`
                                                }
                                            >
                                                <child.icon className="w-4 h-4" />
                                                <span>{child.label}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <NavLink
                                to={item.path}
                                onClick={() => setMobileOpen(false)}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                        ? "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 shadow-lg shadow-blue-500/10"
                                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                                    }`
                                }
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="font-medium">{item.label}</span>
                            </NavLink>
                        )}
                    </div>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-700/50 flex-shrink-0 bg-slate-900/50">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-200">{user?.name}</p>
                        <p className="text-xs text-slate-400">{user?.username}</p>
                    </div>
                    <button
                        onClick={async () => {
                            await logout();
                            navigate("/login");
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
                {dbStatus && (
                    <div className="mt-3 flex items-center gap-2">
                        <div
                            className={`w-2 h-2 rounded-full ${dbStatus.ok ? "bg-green-400" : "bg-red-400"}`}
                            title={dbStatus.message}
                        />
                        <span className="text-xs text-slate-400">{dbStatus.message}</span>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Mobile header */}
            <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <button
                    onClick={() => setMobileOpen(true)}
                    className="px-3 py-2 rounded-lg bg-slate-800 text-slate-200"
                >
                    ☰
                </button>
                <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">WorkSpace</h1>
                <div className="w-10"></div> {/* Spacer for centering if needed, or just empty */}
            </header>

            {/* Sidebar desktop */}
            <aside className="hidden md:block fixed top-0 left-0 h-full w-64 bg-slate-900/50 backdrop-blur-xl border-r border-slate-700/50 shadow-2xl">
                <SidebarContent />
            </aside>

            {/* Mobile sidebar overlay */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
                    <div className="absolute top-0 left-0 h-full w-64 bg-slate-900/90 backdrop-blur-xl border-r border-slate-700/50 shadow-2xl">
                        <div className="relative h-full">
                            <button
                                onClick={() => setMobileOpen(false)}
                                className="absolute top-4 right-4 text-slate-400 z-10"
                            >
                                ✕
                            </button>
                            <SidebarContent />
                        </div>
                    </div>
                </div>
            )}

            {/* Main content */}
            <main className="md:ml-64 ml-0 p-4 md:p-8">
                <Outlet />
            </main>
        </div>
    );
}
