import { useNavigationStore } from "../store/navigationStore";
import { useAuthStore } from "../store/authStore";
import type { View } from "../types";

interface MenuItem {
    view: View;
    label: string;
    icon: string;
    apenasGestor?: boolean;
}

const MENU: { grupo: string; itens: MenuItem[] }[] = [
    {
        grupo: "VISÃO GERAL",
        itens: [{ view: "dashboard", label: "Dashboard", icon: "▦" }],
    },
    {
        grupo: "COMUNICAÇÃO",
        itens: [
            { view: "chat", label: "Chat", icon: "💬" },
            { view: "chamados", label: "Chamados", icon: "📋" },
        ],
    },
    {
        grupo: "CADASTROS",
        itens: [
            { view: "clientes", label: "Clientes", icon: "🏢" },
            { view: "contatos", label: "Contatos", icon: "👤" },
            { view: "tipos", label: "Tipos / Subtipos", icon: "🗂️" },
            {
                view: "usuarios",
                label: "Usuários",
                icon: "👥",
                apenasGestor: true,
            },
        ],
    },
];

export function Sidebar() {
    const { activeView, navigate } = useNavigationStore();
    const { usuario, logout } = useAuthStore();

    const podeVer = (item: MenuItem) => {
        if (item.apenasGestor && usuario?.perfil !== "GESTOR") return false;
        return true;
    };

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="sidebar-logo">
                <span className="logo-icon">🎧</span>
                <span className="logo-text">Suporte</span>
            </div>

            {/* Menu */}
            <nav className="sidebar-nav">
                {MENU.map(grupo => (
                    <div key={grupo.grupo} className="sidebar-grupo">
                        <span className="sidebar-grupo-label">
                            {grupo.grupo}
                        </span>
                        {grupo.itens.filter(podeVer).map(item => (
                            <button
                                key={item.view}
                                className={`sidebar-item ${activeView === item.view ? "ativo" : ""}`}
                                onClick={() => navigate(item.view)}
                            >
                                <span className="sidebar-item-icon">
                                    {item.icon}
                                </span>
                                <span className="sidebar-item-label">
                                    {item.label}
                                </span>
                            </button>
                        ))}
                    </div>
                ))}
            </nav>

            {/* Usuário */}
            <div className="sidebar-footer">
                <div className="sidebar-usuario">
                    <div className="sidebar-avatar">
                        {usuario?.nome?.charAt(0).toUpperCase()}
                    </div>
                    <div className="sidebar-usuario-info">
                        <span className="sidebar-usuario-nome">
                            {usuario?.nome}
                        </span>
                        <span className="sidebar-usuario-perfil">
                            {usuario?.perfil}
                        </span>
                    </div>
                </div>
                <button
                    className="sidebar-logout"
                    onClick={logout}
                    title="Sair"
                >
                    ⎋
                </button>
            </div>
        </aside>
    );
}
