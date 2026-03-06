import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/authStore";
import { LoginPage } from "./pages/LoginPage";
import { MainLayout } from "./components/MainLayout";

export default function App() {
    const { isAuthenticated } = useAuthStore();

    return (
        <>
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: { fontSize: "14px" },
                    success: {
                        style: { background: "#ecfdf5", color: "#065f46" },
                    },
                    error: {
                        style: { background: "#fef2f2", color: "#991b1b" },
                    },
                }}
            />
            {isAuthenticated ? <MainLayout /> : <LoginPage />}
        </>
    );
}
