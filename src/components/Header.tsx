import { useState } from "react";
import { useNotificacaoStore } from "../store/notificationStore";
import { useNavigationStore } from "../store/navigationStore";

const VIEW_LABELS: Record<string, string> = {
    dashboard: "Dashboard",
    chat: "Chat",
    chamados: "Chamados",
    clientes: "Clientes",
    contatos: "Contatos",
    usuarios: "Usuários",
    tipos: "Tipos / Subtipos",
};

export function Header() {
    const { activeView } = useNavigationStore();
    const { notificacoes, naoLidas, marcarTodasLidas } = useNotificacaoStore();
    const [showNotif, setShowNotif] = useState(false);

    const toggleNotif = () => {
        setShowNotif(prev => !prev);
        if (!showNotif) marcarTodasLidas();
    };

    return (
        <header className="header">
            <div className="header-titulo">
                <h1>{VIEW_LABELS[activeView] || activeView}</h1>
            </div>

            <div className="header-acoes">
                {/* Notificações */}
                <div className="notif-wrapper">
                    <button className="notif-btn" onClick={toggleNotif}>
                        🔔
                        {naoLidas > 0 && (
                            <span className="notif-badge">
                                {naoLidas > 99 ? "99+" : naoLidas}
                            </span>
                        )}
                    </button>

                    {showNotif && (
                        <div className="notif-dropdown">
                            <div className="notif-header">
                                <span>Notificações</span>
                            </div>
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
            </div>
        </header>
    );
}
