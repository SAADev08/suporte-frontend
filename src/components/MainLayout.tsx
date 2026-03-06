import { useWebSocket } from "../hooks/useWebSocket";
import { useNavigationStore } from "../store/navigationStore";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { DashboardPage } from "../pages/DashboardPage";
import { ChatPage } from "../pages/ChatsPage";
import { TicketsPage } from "../pages/TicketsPage";
import { ClientsPage } from "../pages/ClientsPage";
import { UsersPage } from "../pages/UsersPage";
import { ContactsPage } from "../pages/ContactsPage";
import { TypesPage } from "../pages/Types";

export function MainLayout() {
    useWebSocket();
    const { activeView } = useNavigationStore();

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
            <Sidebar />
            <div className="main-content">
                <Header />
                <main className="page-content">{renderView()}</main>
            </div>
        </div>
    );
}
