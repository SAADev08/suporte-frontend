import { useState } from "react";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../services/api";
import toast from "react-hot-toast";

export function LoginPage() {
    const { login } = useAuthStore();
    const [email, setEmail] = useState("");
    const [senha, setSenha] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !senha) {
            toast.error("Preencha e-mail e senha");
            return;
        }
        setLoading(true);
        try {
            const { data } = await authApi.login(email, senha);
            login(data.token, data.usuario);
            toast.success(`Bem-vindo, ${data.usuario.nome}!`);
        } catch {
            toast.error("E-mail ou senha inválidos");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-logo">
                    <span>🎧</span>
                    <h1>Suporte</h1>
                    <p>Sistema de Atendimento</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="email">E-mail</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            autoComplete="email"
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="senha">Senha</label>
                        <input
                            id="senha"
                            type="password"
                            value={senha}
                            onChange={e => setSenha(e.target.value)}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn-primary btn-full"
                        disabled={loading}
                    >
                        {loading ? "Entrando..." : "Entrar"}
                    </button>
                </form>
            </div>
        </div>
    );
}
