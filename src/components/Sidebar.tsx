import { useNavigationStore } from "../store/navigationStore";
import { useAuthStore } from "../store/authStore";
import type { View } from "../types";
import {
    faHouse,
    faCommentDots,
    type IconDefinition,
    faAddressBook,
    faFolderClosed,
} from "@fortawesome/free-regular-svg-icons";
import {
    faClipboardList,
    faPeopleLine,
    faUserGroup,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface SidebarProps {
    open?: boolean;
    onCloseSide?: () => void;
}

interface MenuItem {
    view: View;
    label: string;
    icon: IconDefinition;
    apenasGestor?: boolean;
}

const MENU: { grupo: string; itens: MenuItem[] }[] = [
    {
        grupo: "Visão Geral",
        itens: [{ view: "dashboard", label: "Home", icon: faHouse }],
    },
    {
        grupo: "Comunicação",
        itens: [
            { view: "chat", label: "Chat", icon: faCommentDots },
            { view: "chamados", label: "Chamados", icon: faClipboardList },
        ],
    },
    {
        grupo: "Cadastros",
        itens: [
            { view: "clientes", label: "Clientes", icon: faPeopleLine },
            { view: "contatos", label: "Contatos", icon: faAddressBook },
            { view: "tipos", label: "Tipos / Subtipos", icon: faFolderClosed },
            {
                view: "usuarios",
                label: "Usuários",
                icon: faUserGroup,
                apenasGestor: true,
            },
        ],
    },
];

export function Sidebar({ open = false, onCloseSide }: SidebarProps) {
    const { activeView, navigate } = useNavigationStore();
    const { usuario } = useAuthStore();

    const podeVer = (item: MenuItem) => {
        if (item.apenasGestor && usuario?.perfil !== "GESTOR") return false;
        return true;
    };

    const handleNavegar = (view: View) => {
        navigate(view);
        // Fecha o drawer ao navegar em mobile
        onCloseSide?.();
    };

    return (
        <>
            {/* Overlay escuro — só visível em mobile quando drawer está aberto */}

            <div
                className={`sidebar-overlay${open ? " visivel" : ""}`}
                onClick={onCloseSide}
                aria-hidden="true"
            />

            <aside className={`sidebar${open ? " aberta" : ""}`}>
                {/* Navigation */}
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
                                    onClick={() => handleNavegar(item.view)}
                                >
                                    <span className="sidebar-item-icon">
                                        <FontAwesomeIcon icon={item.icon} />
                                    </span>
                                    <span className="sidebar-item-label">
                                        {item.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ))}
                </nav>

                {/* Footer / User */}
                {/* <div className="sidebar-footer">
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
                <button
                    className="sidebar-logout"
                    onClick={logout}
                    title="Sair"
                >
                    ⎋
                </button>
            </div> */}
            </aside>
        </>
    );
}
