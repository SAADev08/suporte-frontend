import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import type { PageResponse, Usuario } from "../../types";
import {
    userApi,
    type PerfilType,
    type UserRequest,
} from "../../services/api/usersApi";
import { formatarData } from "../../utils/formatters";
import { useAuthStore } from "../../store/authStore";
import "./users.css";
import { Pagination, type TamanhoPagina } from "../../components/Pagination";

// ─── Form vazio ───────────────────────────────────────────────────────────────
const FORM_VAZIO: UserRequest = {
    nome: "",
    email: "",
    senha: "",
    perfil: "ANALISTA",
};

type Erros = Partial<Record<keyof UserRequest, string>>;

// ─── Componente principal ─────────────────────────────────────────────────────
export function UsersPage() {
    const { usuario: usuarioLogado } = useAuthStore();

    // Guarda de acesso — só GESTOR pode acessar
    if (usuarioLogado?.perfil !== "GESTOR") {
        return (
            <div className="acesso-negado">
                <span className="acesso-negado-icon">🔒</span>
                <h3>Acesso restrito</h3>
                <p>
                    Esta área é exclusiva para usuários com perfil{" "}
                    <strong>Gestor</strong>.
                </p>
            </div>
        );
    }

    return <UsuariosConteudo usuarioLogadoId={usuarioLogado.id} />;
}

// ─── Conteúdo principal (separado para não violar regras de hooks) ────────────
function UsuariosConteudo({ usuarioLogadoId }: { usuarioLogadoId: string }) {
    const [pageData, setPageData] = useState<PageResponse<Usuario> | null>(
        null,
    );
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState({
        nome: "",
        email: "",
        perfil: "" as PerfilType | "",
    });
    const [modal, setModal] = useState<"criar" | "editar" | "detalhe" | null>(
        null,
    );
    const [selecionado, setSelecionado] = useState<Usuario | null>(null);
    const [form, setForm] = useState<UserRequest>(FORM_VAZIO);
    const [erros, setErros] = useState<Erros>({});
    const [salvando, setSalvando] = useState(false);
    const [mostrarSenha, setMostrarSenha] = useState(false);
    const [confirmarInativar, setConfirmarInativar] = useState<Usuario | null>(
        null,
    );
    const [confirmarReativar, setConfirmarReativar] = useState<Usuario | null>(
        null,
    );

    const [page, setPage] = useState(0);
    const [size, setSize] = useState<TamanhoPagina>(10);

    // ─── Carregar ───────────────────────────────────────────────────────────────
    const carregar = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                nome: busca.nome || undefined,
                email: busca.email || undefined,
                perfil: busca.perfil || undefined,
                page,
                size,
            };
            const { data } = await userApi.listar(params);
            setPageData(data);
        } catch {
            toast.error("Erro ao carregar usuários");
        } finally {
            setLoading(false);
        }
    }, [busca, page, size]);

    useEffect(() => {
        carregar();
    }, [carregar]);

    // ─── Validação ──────────────────────────────────────────────────────────────
    const validar = (): boolean => {
        const e: Erros = {};
        if (!form.nome.trim()) e.nome = "Nome é obrigatório";
        if (!form.email.trim()) e.email = "E-mail é obrigatório";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
            e.email = "E-mail inválido";
        if (!form.perfil) e.perfil = "Perfil é obrigatório";

        // Senha obrigatória apenas na criação; na edição é opcional
        if (modal === "criar") {
            if (!form.senha?.trim()) e.senha = "Senha é obrigatória";
            else if (form.senha.length < 6) e.senha = "Mínimo 6 caracteres";
        } else if (modal === "editar" && form.senha && form.senha.length > 0) {
            if (form.senha.length < 6) e.senha = "Mínimo 6 caracteres";
        }

        setErros(e);
        return Object.keys(e).length === 0;
    };

    // ─── Abrir modais ────────────────────────────────────────────────────────────
    const abrirCriar = () => {
        setForm(FORM_VAZIO);
        setErros({});
        setMostrarSenha(false);
        setSelecionado(null);
        setModal("criar");
    };

    const abrirEditar = (u: Usuario) => {
        setForm({
            nome: u.nome,
            email: u.email,
            senha: "",
            perfil: u.perfil as PerfilType,
        });
        setErros({});
        setMostrarSenha(false);
        setSelecionado(u);
        setModal("editar");
    };

    const abrirDetalhe = async (u: Usuario) => {
        try {
            const { data } = await userApi.buscarPorId(u.id);
            setSelecionado(data);
            setModal("detalhe");
        } catch {
            toast.error("Erro ao carregar dados do usuário");
        }
    };

    // ─── Salvar ─────────────────────────────────────────────────────────────────
    const salvar = async () => {
        if (!validar()) return;
        setSalvando(true);
        try {
            const payload: UserRequest = {
                ...form,
                // Na edição, não envia senha se estiver vazia
                senha: form.senha?.trim() || undefined,
            };
            if (modal === "criar") {
                await userApi.criar(payload);
                toast.success("Usuário criado com sucesso!");
            } else if (modal === "editar" && selecionado) {
                await userApi.atualizar(selecionado.id, payload);
                toast.success("Usuário atualizado com sucesso!");
            }
            setModal(null);
            carregar();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message || "Erro ao salvar usuário";
            toast.error(msg);
        } finally {
            setSalvando(false);
        }
    };

    // ─── Inativar / Reativar ─────────────────────────────────────────────────────
    const inativar = async () => {
        if (!confirmarInativar) return;
        try {
            await userApi.inativar(confirmarInativar.id);
            toast.success(`Usuário "${confirmarInativar.nome}" inativado.`);
            setConfirmarInativar(null);
            carregar();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message || "Erro ao inativar usuário";
            toast.error(msg);
            setConfirmarInativar(null);
        }
    };

    const reativar = async () => {
        if (!confirmarReativar) return;
        try {
            await userApi.reativar(confirmarReativar.id);
            toast.success(`Usuário "${confirmarReativar.nome}" reativado.`);
            setConfirmarReativar(null);
            carregar();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message || "Erro ao reativar usuário";
            toast.error(msg);
            setConfirmarReativar(null);
        }
    };

    // ─── Handler form ────────────────────────────────────────────────────────────
    const handleChange = (field: keyof UserRequest, value: string) => {
        setForm(f => ({ ...f, [field]: value }));
        if (erros[field]) setErros(e => ({ ...e, [field]: undefined }));
    };

    // ─── Render ──────────────────────────────────────────────────────────────────
    return (
        <div className="modulo">
            {/* Cabeçalho */}
            <div className="modulo-header">
                <div>
                    <h2 className="modulo-titulo">Usuários</h2>
                    <p className="modulo-subtitulo">
                        Gerencie os usuários do sistema — acesso exclusivo para
                        Gestores
                    </p>
                </div>
                <button className="btn-primary" onClick={abrirCriar}>
                    + Novo Usuário
                </button>
            </div>

            {/* Filtros */}
            <div className="filtros-bar">
                <input
                    className="filtro-input"
                    placeholder="Buscar por nome..."
                    value={busca.nome}
                    onChange={e =>
                        setBusca(b => ({ ...b, nome: e.target.value }))
                    }
                />
                <input
                    className="filtro-input"
                    placeholder="E-mail..."
                    value={busca.email}
                    onChange={e =>
                        setBusca(b => ({ ...b, email: e.target.value }))
                    }
                />
                <select
                    title="filtro-input"
                    className="filtro-input"
                    value={busca.perfil}
                    onChange={e =>
                        setBusca(b => ({
                            ...b,
                            perfil: e.target.value as PerfilType | "",
                        }))
                    }
                >
                    <option value="">Todos os perfis</option>
                    <option value="GESTOR">Gestor</option>
                    <option value="ANALISTA">Analista</option>
                </select>
                <button
                    className="btn-secondary"
                    onClick={() => {
                        carregar();
                        setPage(0);
                    }}
                >
                    🔍 Buscar
                </button>
            </div>

            {/* Tabela */}
            <div className="tabela-wrapper">
                {loading ? (
                    <div className="estado-vazio">Carregando...</div>
                ) : !pageData || pageData.content.length === 0 ? (
                    <div className="estado-vazio">
                        <p>Nenhum usuário encontrado.</p>
                        <button className="btn-primary" onClick={abrirCriar}>
                            Criar primeiro usuário
                        </button>
                    </div>
                ) : (
                    <>
                        <table className="tabela tabela-7col">
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th className="tabela-col-ocultar-mobile">
                                        E-mail
                                    </th>
                                    <th>Perfil</th>
                                    <th>Status</th>
                                    <th className="tabela-col-ocultar-mobile">
                                        Cadastrado em
                                    </th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageData.content.map(u => (
                                    <tr
                                        key={u.id}
                                        className={
                                            !u.ativo ? "linha-inativa" : ""
                                        }
                                    >
                                        <td>
                                            <div className="usuario-nome-cell">
                                                <div className="usuario-avatar-mini">
                                                    {u.nome
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>
                                                <button
                                                    className="link-tabela"
                                                    onClick={() =>
                                                        abrirDetalhe(u)
                                                    }
                                                >
                                                    {u.nome}
                                                    {u.id ===
                                                        usuarioLogadoId && (
                                                        <span className="badge-eu">
                                                            você
                                                        </span>
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                        <td
                                            className="texto-mono tabela-col-ocultar-mobile"
                                            style={{ fontSize: 13 }}
                                        >
                                            {u.email}
                                        </td>
                                        <td>
                                            <span
                                                className={`badge-perfil badge-perfil-${u.perfil?.toLowerCase()}`}
                                            >
                                                {u.perfil === "GESTOR"
                                                    ? "👑 Gestor"
                                                    : "🎧 Analista"}
                                            </span>
                                        </td>
                                        <td>
                                            <span
                                                className={`badge ${u.ativo ? "badge-ativo" : "badge-inativo"}`}
                                            >
                                                {u.ativo ? "Ativo" : "Inativo"}
                                            </span>
                                        </td>
                                        <td
                                            className="tabela-col-ocultar-mobile"
                                            style={{
                                                color: "var(--color-text-muted)",
                                                fontSize: 13,
                                            }}
                                        >
                                            {formatarData(u.createdAt || "")}
                                        </td>
                                        <td>
                                            <div className="acoes-tabela">
                                                <button
                                                    className="btn-acao btn-acao-editar"
                                                    onClick={() =>
                                                        abrirEditar(u)
                                                    }
                                                    title="Editar"
                                                >
                                                    ✏️
                                                </button>
                                                {u.ativo ? (
                                                    <button
                                                        className="btn-acao btn-acao-inativar"
                                                        onClick={() =>
                                                            setConfirmarInativar(
                                                                u,
                                                            )
                                                        }
                                                        title="Inativar"
                                                        disabled={
                                                            u.id ===
                                                            usuarioLogadoId
                                                        }
                                                    >
                                                        🚫
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="btn-acao btn-acao-reativar"
                                                        onClick={() =>
                                                            setConfirmarReativar(
                                                                u,
                                                            )
                                                        }
                                                        title="Reativar"
                                                    >
                                                        ✅
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <Pagination
                            page={pageData.number}
                            totalPages={pageData.totalPages}
                            totalElements={pageData.totalElements}
                            size={pageData.size as TamanhoPagina}
                            onPageChange={setPage}
                            onSizeChange={s => {
                                setSize(s);
                                setPage(0);
                            }}
                        />
                    </>
                )}
            </div>

            {/* Modal Criar / Editar */}
            {(modal === "criar" || modal === "editar") && (
                <div className="modal-overlay" onClick={() => setModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>
                                {modal === "criar"
                                    ? "Novo Usuário"
                                    : "Editar Usuário"}
                            </h3>
                            <button
                                className="modal-fechar"
                                onClick={() => setModal(null)}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="form-grid">
                                {/* Nome */}
                                <div className="form-group form-col-2">
                                    <label>
                                        Nome{" "}
                                        <span className="obrigatorio">*</span>
                                    </label>
                                    <input
                                        value={form.nome}
                                        onChange={e =>
                                            handleChange("nome", e.target.value)
                                        }
                                        placeholder="Nome completo"
                                        className={
                                            erros.nome ? "input-erro" : ""
                                        }
                                    />
                                    {erros.nome && (
                                        <span className="erro-msg">
                                            {erros.nome}
                                        </span>
                                    )}
                                </div>

                                {/* E-mail */}
                                <div className="form-group form-col-2">
                                    <label>
                                        E-mail{" "}
                                        <span className="obrigatorio">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={e =>
                                            handleChange(
                                                "email",
                                                e.target.value,
                                            )
                                        }
                                        placeholder="usuario@empresa.com"
                                        className={
                                            erros.email ? "input-erro" : ""
                                        }
                                    />
                                    {erros.email && (
                                        <span className="erro-msg">
                                            {erros.email}
                                        </span>
                                    )}
                                </div>

                                {/* Perfil */}
                                <div className="form-group">
                                    <label>
                                        Perfil{" "}
                                        <span className="obrigatorio">*</span>
                                    </label>
                                    <select
                                        title="perfil"
                                        value={form.perfil}
                                        onChange={e =>
                                            handleChange(
                                                "perfil",
                                                e.target.value,
                                            )
                                        }
                                        className={
                                            erros.perfil ? "input-erro" : ""
                                        }
                                    >
                                        <option value="ANALISTA">
                                            🎧 Analista
                                        </option>
                                        <option value="GESTOR">
                                            👑 Gestor
                                        </option>
                                    </select>
                                    {erros.perfil && (
                                        <span className="erro-msg">
                                            {erros.perfil}
                                        </span>
                                    )}
                                </div>

                                {/* Senha */}
                                <div className="form-group">
                                    <label>
                                        {modal === "criar" ? (
                                            <>
                                                Senha{" "}
                                                <span className="obrigatorio">
                                                    *
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                Nova senha{" "}
                                                <span className="campo-info">
                                                    (opcional)
                                                </span>
                                            </>
                                        )}
                                    </label>
                                    <div className="input-senha-wrapper">
                                        <input
                                            type={
                                                mostrarSenha
                                                    ? "text"
                                                    : "password"
                                            }
                                            value={form.senha}
                                            onChange={e =>
                                                handleChange(
                                                    "senha",
                                                    e.target.value,
                                                )
                                            }
                                            placeholder={
                                                modal === "criar"
                                                    ? "Mínimo 6 caracteres"
                                                    : "Deixe em branco para manter"
                                            }
                                            className={
                                                erros.senha ? "input-erro" : ""
                                            }
                                        />
                                        <button
                                            type="button"
                                            className="btn-toggle-senha"
                                            onClick={() =>
                                                setMostrarSenha(v => !v)
                                            }
                                            tabIndex={-1}
                                        >
                                            {mostrarSenha ? "🙈" : "👁️"}
                                        </button>
                                    </div>
                                    {erros.senha && (
                                        <span className="erro-msg">
                                            {erros.senha}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setModal(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn-primary"
                                onClick={salvar}
                                disabled={salvando}
                            >
                                {salvando
                                    ? "Salvando..."
                                    : modal === "criar"
                                      ? "Criar Usuário"
                                      : "Salvar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Detalhe */}
            {modal === "detalhe" && selecionado && (
                <div className="modal-overlay" onClick={() => setModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Detalhes do Usuário</h3>
                            <button
                                className="modal-fechar"
                                onClick={() => setModal(null)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            {/* Avatar grande */}
                            <div className="usuario-detalhe-avatar">
                                <div className="usuario-avatar-grande">
                                    {selecionado.nome.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="usuario-detalhe-nome">
                                        {selecionado.nome}
                                    </p>
                                    <span
                                        className={`badge-perfil badge-perfil-${selecionado.perfil?.toLowerCase()}`}
                                    >
                                        {selecionado.perfil === "GESTOR"
                                            ? "👑 Gestor"
                                            : "🎧 Analista"}
                                    </span>
                                </div>
                            </div>

                            <div
                                className="detalhe-grid"
                                style={{ marginTop: 16 }}
                            >
                                <DetalheItem
                                    label="E-mail"
                                    valor={selecionado.email}
                                    span2
                                    mono
                                />
                                <DetalheItem
                                    label="Status"
                                    valor={
                                        selecionado.ativo ? "Ativo" : "Inativo"
                                    }
                                    badge={
                                        selecionado.ativo ? "ativo" : "inativo"
                                    }
                                />
                                <DetalheItem
                                    label="Cadastrado em"
                                    valor={formatarData(
                                        selecionado.createdAt || "",
                                    )}
                                />
                                <DetalheItem
                                    label="Atualizado em"
                                    valor={formatarData(
                                        selecionado.updatedAt || "",
                                    )}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setModal(null)}
                            >
                                Fechar
                            </button>
                            <button
                                className="btn-primary"
                                onClick={() => abrirEditar(selecionado)}
                            >
                                Editar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Confirmar Inativação */}
            {confirmarInativar && (
                <div
                    className="modal-overlay"
                    onClick={() => setConfirmarInativar(null)}
                >
                    <div
                        className="modal modal-sm"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h3>Confirmar Inativação</h3>
                            <button
                                className="modal-fechar"
                                onClick={() => setConfirmarInativar(null)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>
                                Deseja inativar o usuário{" "}
                                <strong>{confirmarInativar.nome}</strong>?
                            </p>
                            <p className="texto-aviso">
                                ⚠️ O usuário perderá o acesso ao sistema
                                imediatamente após a inativação.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setConfirmarInativar(null)}
                            >
                                Cancelar
                            </button>
                            <button className="btn-danger" onClick={inativar}>
                                Confirmar Inativação
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Confirmar Reativação */}
            {confirmarReativar && (
                <div
                    className="modal-overlay"
                    onClick={() => setConfirmarReativar(null)}
                >
                    <div
                        className="modal modal-sm"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h3>Confirmar Reativação</h3>
                            <button
                                className="modal-fechar"
                                onClick={() => setConfirmarReativar(null)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>
                                Deseja reativar o usuário{" "}
                                <strong>{confirmarReativar.nome}</strong>?
                            </p>
                            <p
                                className="texto-aviso"
                                style={{
                                    borderColor: "rgba(39,174,96,.3)",
                                    background: "rgba(39,174,96,.06)",
                                    color: "#1a6b3c",
                                }}
                            >
                                ✅ O usuário voltará a ter acesso ao sistema.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setConfirmarReativar(null)}
                            >
                                Cancelar
                            </button>
                            <button className="btn-primary" onClick={reativar}>
                                Confirmar Reativação
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Componente auxiliar ──────────────────────────────────────────────────────
function DetalheItem({
    label,
    valor,
    mono,
    badge,
    span2,
}: {
    label: string;
    valor?: string | null;
    mono?: boolean;
    badge?: "ativo" | "inativo";
    span2?: boolean;
}) {
    return (
        <div
            className="detalhe-item"
            style={span2 ? { gridColumn: "span 2" } : {}}
        >
            <span className="detalhe-label">{label}</span>
            {badge ? (
                <span className={`badge badge-${badge}`}>{valor}</span>
            ) : (
                <span className={`detalhe-valor ${mono ? "texto-mono" : ""}`}>
                    {valor || "—"}
                </span>
            )}
        </div>
    );
}
