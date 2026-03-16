import { useWebSocket } from "../hooks/useWebSocket";
import { useNavigationStore } from "../store/navigationStore";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { DashboardPage } from "../pages/DashboardPage";
import { ChatPage } from "../pages/Chats/ChatsPage";
import { TicketsPage } from "../pages/Tickets/TicketsPage";
import { ClientsPage } from "../pages/ClientsPage";
import { UsersPage } from "../pages/Users/UsersPage";
import { ContactsPage } from "../pages/Contacts/ContactsPage";
import { TypesPage } from "../pages/Types/Types";
import { useCallback, useEffect, useState } from "react";

// Breakpoint que ativa o comportamento de drawer (deve bater com o CSS)
const MOBILE_BREAKPOINT = 768;

export function MainLayout() {
    useWebSocket();
    const { activeView } = useNavigationStore();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleResize = useCallback(() => {
        if (window.innerWidth > MOBILE_BREAKPOINT) {
            setSidebarOpen(false);
        }
    }, []);

    useEffect(() => {
        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, [handleResize]);

    useEffect(() => {
        if (sidebarOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [sidebarOpen]);

    const toggleSidebar = () => setSidebarOpen(prev => !prev);
    const closeSidebar = () => setSidebarOpen(false);

    const renderView = () => {
        switch (activeView) {
            case "dashboard":
                return <DashboardPage />;
            case "chat":
                return <ChatPage />;
            case "chamados":
                return <TicketsPage />;
            case "clientes":
                return <ClientsPage />;
            case "contatos":
                return <ContactsPage />;
            case "usuarios":
                return <UsersPage />;
            case "tipos":
                return <TypesPage />;
            default:
                return <DashboardPage />;
        }
    };

    return (
        <div className="app-shell">
            {/* Header spans full width at the top */}
            <Header onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />

            {/* Sidebar + content below header */}
            <div className="body-shell">
                <Sidebar open={sidebarOpen} onCloseSide={closeSidebar} />
                <div className="main-content">
                    <main className="page-content">{renderView()}</main>
                </div>
            </div>
        </div>
    );
}
