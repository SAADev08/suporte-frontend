import { useEffect, useRef, useState } from "react";
import { useNotificacaoStore } from "../store/notificationStore";
import { useAuthStore } from "../store/authStore";
import {
    faArrowRightFromBracket,
    faChevronDown,
    faChevronUp,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface HeaderProps {
    onToggleSidebar?: () => void;
    sidebarOpen?: boolean;
}

export function Header({ onToggleSidebar, sidebarOpen }: HeaderProps) {
    const { notificacoes, naoLidas, marcarTodasLidas } = useNotificacaoStore();
    const { usuario, logout } = useAuthStore();
    const [showNotif, setShowNotif] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    const toggleNotif = () => {
        setShowNotif(prev => !prev);
        setShowUserMenu(false);
        if (!showNotif) marcarTodasLidas();
    };

    const toggleUserMenu = () => {
        setShowUserMenu(prev => !prev);
        setShowNotif(false);
    };

    const handleLogout = () => {
        setShowUserMenu(false);
        logout();
    };

    useEffect(() => {
        console.log("usuario no header:", usuario);
    });

    useEffect(() => {
        if (!showNotif) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (
                notifRef.current &&
                !notifRef.current.contains(e.target as Node)
            ) {
                setShowNotif(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showNotif]);

    useEffect(() => {
        if (!showUserMenu) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (
                userMenuRef.current &&
                !userMenuRef.current.contains(e.target as Node)
            ) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [showUserMenu]);

    return (
        <header className="header">
            {/* Hamburger para mobile */}
            <button
                type="button"
                className="btn-hamburger"
                onClick={onToggleSidebar}
                title={sidebarOpen ? "Fechar" : "Abrir"}
                aria-label={sidebarOpen ? "Fechar menu" : "Abrir menu"}
            >
                {sidebarOpen ? "✖" : "☰"}
            </button>

            {/* Logo */}
            <div className="header-logo">
                <span className="header-logo-icon">🎧</span>
                <span className="header-logo-text">Suporte</span>
            </div>

            {/* Actions */}
            <div className="header-acoes">
                {/* Notifications */}
                <div className="notif-wrapper" ref={notifRef}>
                    <button
                        className="notif-btn"
                        onClick={toggleNotif}
                        title="Notificações"
                    >
                        🔔
                        {naoLidas > 0 && (
                            <span className="notif-badge">
                                {naoLidas > 99 ? "99+" : naoLidas}
                            </span>
                        )}
                    </button>

                    {showNotif && (
                        <div className="notif-dropdown">
                            <div className="notif-header">Notificações</div>
                            {notificacoes.length === 0 ? (
                                <p className="notif-vazio">
                                    Nenhuma notificação
                                </p>
                            ) : (
                                notificacoes.slice(0, 10).map(n => (
                                    <div
                                        key={n.id}
                                        className={`notif-item notif-${n.tipo}`}
                                    >
                                        <span className="notif-msg">
                                            {n.mensagem}
                                        </span>
                                        <span className="notif-hora">
                                            {new Date(
                                                n.dtRecebimento,
                                            ).toLocaleTimeString("pt-BR")}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* User */}
                <div className="user-menu-wrapper" ref={userMenuRef}>
                    <button
                        className={`header-user${showUserMenu ? " header-user--ativo" : ""}`}
                        onClick={toggleUserMenu}
                        aria-label={showUserMenu ? "Fechar menu" : "Abrir menu"}
                    >
                        <div className="header-avatar">
                            {usuario?.nome?.charAt(0).toUpperCase() ?? "U"}
                        </div>
                        <div className="header-user-info">
                            <span className="header-user-nome">
                                {usuario?.nome ?? "Usuário"}
                            </span>
                            <span className="header-user-email">
                                {usuario?.email ?? ""}
                            </span>
                        </div>
                        <span className="header-user-chevron">
                            {showUserMenu ? (
                                <FontAwesomeIcon icon={faChevronUp} />
                            ) : (
                                <FontAwesomeIcon icon={faChevronDown} />
                            )}
                        </span>
                    </button>

                    {showUserMenu && (
                        <div className="user-menu-dropdown" role="menu">
                            {/* Cabeçalho do menu */}
                            <div className="user-menu-header">
                                <div className="user-menu-avatar">
                                    {usuario?.nome?.charAt(0).toUpperCase() ??
                                        "U"}
                                </div>
                                <div className="user-menu-header-info">
                                    <span className="user-menu-nome">
                                        {usuario?.nome ?? "Usuário"}
                                    </span>
                                    <span className="user-menu-email">
                                        {usuario?.email ?? ""}
                                    </span>
                                </div>
                            </div>

                            <div className="user-menu-divider" />

                            {/* Itens futuros (ex: editar perfil) */}

                            <div className="user-menu-divider" />

                            {/* Logout */}
                            <button
                                className="user-menu-item user-menu-item--danger"
                                onClick={handleLogout}
                                role="menuitem"
                            >
                                <span className="user-menu-item-icon">
                                    <FontAwesomeIcon
                                        icon={faArrowRightFromBracket}
                                    />
                                </span>
                                <span>Sair</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
