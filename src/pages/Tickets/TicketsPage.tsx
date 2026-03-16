import { useState, useEffect, useCallback } from "react";
import "./tickets.css";
import toast from "react-hot-toast";
import type {
    Chamado,
    Contato,
    Usuario,
    Tipo,
    Subtipo,
    ChamadoStatusHistorico,
    ChamadoStatus,
} from "../../types";
import type {
    ChamadoRequest,
    ChamadoStatusType,
    OrigemType,
    CategoriaType,
} from "../../services/api/ticketApi";
import { ticketApi } from "../../services/api/ticketApi";
import { contactApi } from "../../services/api/contactApi";
import { userApi } from "../../services/api/usersApi";
import { typeApi } from "../../services/api/typeApi";
import {
    STATUS_CONFIG,
    CATEGORIA_CONFIG,
    ORIGEM_CONFIG,
    formatarTempo,
    formatarDataHora,
} from "../../utils/ticketsHelpers";

// ─── Form vazio ───────────────────────────────────────────────────────────────
const FORM_VAZIO: ChamadoRequest = {
    texto: "",
    categoria: "DUVIDA",
    origem: "WHATSAPP",
    contatoId: "",
    usuarioResponsavelId: "",
    subtipoId: "",
};

type Erros = Partial<Record<keyof ChamadoRequest | "solucaoEncerrar", string>>;

// ─── Componente principal ─────────────────────────────────────────────────────
export function TicketsPage() {
    // Dados
    const [chamados, setChamados] = useState<Chamado[]>([]);
    const [contatos, setContatos] = useState<Contato[]>([]);
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [tipos, setTipos] = useState<Tipo[]>([]);
    const [subtipos, setSubtipos] = useState<Subtipo[]>([]);
    const [historico, setHistorico] = useState<ChamadoStatusHistorico[]>([]);

    // UI
    const [loading, setLoading] = useState(true);
    const [filtros, setFiltros] = useState<{
        status: ChamadoStatusType | "";
        origem: OrigemType | "";
    }>({ status: "", origem: "" });
    const [modal, setModal] = useState<
        "criar" | "editar" | "detalhe" | "encerrar" | null
    >(null);
    const [selecionado, setSelecionado] = useState<Chamado | null>(null);
    const [form, setForm] = useState<ChamadoRequest>(FORM_VAZIO);
    const [erros, setErros] = useState<Erros>({});
    const [salvando, setSalvando] = useState(false);
    const [solucaoEncerrar, setSolucaoEncerrar] = useState("");
    const [abaDetalhe, setAbaDetalhe] = useState<"info" | "historico">("info");

    // ─── Dados auxiliares ───────────────────────────────────────────────────────
    useEffect(() => {
        Promise.all([contactApi.listar(), userApi.listar(), typeApi.listar()])
            .then(([c, u, t]) => {
                setContatos(c.data.content.filter(x => x.ativo));
                setUsuarios(u.data.content.filter(x => x.ativo));
                setTipos(t.data);
            })
            .catch(() => toast.error("Erro ao carregar dados auxiliares"));
    }, []);

    // Carrega subtipos quando tipo muda no form
    const handleTipoChange = async (tipoId: string) => {
        setSubtipos([]);
        setForm((f: ChamadoRequest) => ({ ...f, subtipoId: "" }));
        if (!tipoId) return;
        try {
            const { data } = await typeApi.listarSubtipos(tipoId);
            setSubtipos(data);
        } catch {
            toast.error("Erro ao carregar subtipos");
        }
    };

    // ─── Carregar chamados ──────────────────────────────────────────────────────
    const carregar = useCallback(async (f = filtros) => {
        setLoading(true);
        try {
            const { data } = await ticketApi.listar({
                status: f.status || undefined,
                origem: f.origem || undefined,
            });
            setChamados(data.content);
        } catch {
            toast.error("Erro ao carregar chamados");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        carregar();
    }, [carregar]);

    // ─── Validação ──────────────────────────────────────────────────────────────
    const validar = (): boolean => {
        const e: Erros = {};
        if (!form.contatoId) e.contatoId = "Contato é obrigatório";
        if (!form.origem) e.origem = "Origem é obrigatória";
        setErros(e);
        return Object.keys(e).length === 0;
    };

    // ─── Abrir modais ───────────────────────────────────────────────────────────
    const abrirCriar = () => {
        setForm(FORM_VAZIO);
        setSubtipos([]);
        setErros({});
        setSelecionado(null);
        setModal("criar");
    };

    const abrirEditar = (c: Chamado) => {
        setForm({
            texto: c.texto || "",
            categoria: (c.categoria as CategoriaType) || "DUVIDA",
            origem: c.origem as OrigemType,
            statusAtual: c.statusAtual as ChamadoStatusType,
            contatoId: c.contatoId || "",
            usuarioResponsavelId: c.usuarioResponsavelId || "",
            subtipoId: c.subtipoId || "",
            solucao: c.solucao || "",
        });
        setSubtipos([]);
        setErros({});
        setSelecionado(c);
        setModal("editar");
    };

    const abrirDetalhe = async (c: Chamado) => {
        try {
            const [det, hist] = await Promise.all([
                ticketApi.buscarPorId(c.id),
                ticketApi.historico(c.id),
            ]);
            setSelecionado(det.data);
            setHistorico(hist.data);
            setAbaDetalhe("info");
            setModal("detalhe");
        } catch {
            toast.error("Erro ao carregar chamado");
        }
    };

    const abrirEncerrar = (c: Chamado) => {
        setSelecionado(c);
        setSolucaoEncerrar(c.solucao || "");
        setErros({});
        setModal("encerrar");
    };

    // ─── Salvar ─────────────────────────────────────────────────────────────────
    const salvar = async () => {
        if (!validar()) return;
        setSalvando(true);
        try {
            const payload: ChamadoRequest = {
                ...form,
                usuarioResponsavelId: form.usuarioResponsavelId || undefined,
                subtipoId: form.subtipoId || undefined,
            };
            if (modal === "criar") {
                await ticketApi.criar(payload);
                toast.success("Chamado aberto com sucesso!");
            } else if (modal === "editar" && selecionado) {
                await ticketApi.atualizar(selecionado.id, payload);
                toast.success("Chamado atualizado com sucesso!");
            }
            setModal(null);
            carregar();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message || "Erro ao salvar chamado";
            toast.error(msg);
        } finally {
            setSalvando(false);
        }
    };

    // ─── Encerrar ───────────────────────────────────────────────────────────────
    const encerrar = async () => {
        if (!solucaoEncerrar.trim()) {
            setErros({
                solucaoEncerrar: "Solução é obrigatória para encerrar",
            });
            return;
        }
        if (!selecionado) return;
        setSalvando(true);
        try {
            await ticketApi.encerrar(selecionado.id, {
                solucao: solucaoEncerrar,
            });
            toast.success("Chamado encerrado com sucesso!");
            setModal(null);
            carregar();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message || "Erro ao encerrar chamado";
            toast.error(msg);
        } finally {
            setSalvando(false);
        }
    };

    // ─── Render ──────────────────────────────────────────────────────────────────
    return (
        <div className="modulo">
            {/* Cabeçalho */}
            <div className="modulo-header">
                <div>
                    <h2 className="modulo-titulo">Chamados</h2>
                    <p className="modulo-subtitulo">
                        Gerencie os chamados de suporte
                    </p>
                </div>
                <button className="btn-primary" onClick={abrirCriar}>
                    + Novo Chamado
                </button>
            </div>

            {/* Filtros */}
            <div className="filtros-bar">
                <select
                    title="filtro de status"
                    className="filtro-input"
                    value={filtros.status}
                    onChange={e =>
                        setFiltros(f => ({
                            ...f,
                            status: e.target.value as ChamadoStatusType | "",
                        }))
                    }
                >
                    <option value="">Todos os status</option>
                    {(Object.keys(STATUS_CONFIG) as ChamadoStatus[]).map(s => (
                        <option key={s} value={s}>
                            {STATUS_CONFIG[s].icone} {STATUS_CONFIG[s].label}
                        </option>
                    ))}
                </select>
                <select
                    title="filtro de origem"
                    className="filtro-input"
                    value={filtros.origem}
                    onChange={e =>
                        setFiltros(f => ({
                            ...f,
                            origem: e.target.value as OrigemType | "",
                        }))
                    }
                >
                    <option value="">Todas as origens</option>
                    {(Object.keys(ORIGEM_CONFIG) as OrigemType[]).map(o => (
                        <option key={o} value={o}>
                            {ORIGEM_CONFIG[o].icone} {ORIGEM_CONFIG[o].label}
                        </option>
                    ))}
                </select>
                <button
                    className="btn-secondary"
                    onClick={() => carregar(filtros)}
                >
                    🔍 Buscar
                </button>
            </div>

            {/* Cards de contagem por status */}
            <div className="chamados-status-cards">
                {(Object.keys(STATUS_CONFIG) as ChamadoStatusType[]).map(s => {
                    const count = chamados.filter(
                        c => c.statusAtual === s,
                    ).length;
                    const cfg = STATUS_CONFIG[s];
                    return (
                        <button
                            key={s}
                            className={`status-card ${filtros.status === s ? "ativo" : ""}`}
                            style={
                                {
                                    "--card-cor": cfg.cor,
                                    "--card-bg": cfg.bg,
                                    "--card-border": cfg.border,
                                } as React.CSSProperties
                            }
                            onClick={() => {
                                const novoStatus =
                                    filtros.status === s ? "" : s;
                                const novosFiltros = {
                                    ...filtros,
                                    status: novoStatus as
                                        | ChamadoStatusType
                                        | "",
                                };
                                setFiltros(novosFiltros);
                                carregar(novosFiltros);
                            }}
                        >
                            {/* <span className="status-card-icone">
                                {cfg.icone}
                            </span> */}
                            <span className="status-card-count">{count}</span>
                            <span className="status-card-label">
                                {cfg.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Tabela */}
            <div className="tabela-wrapper">
                {loading ? (
                    <div className="estado-vazio">Carregando...</div>
                ) : chamados.length === 0 ? (
                    <div className="estado-vazio">
                        <p>Nenhum chamado encontrado.</p>
                        <button className="btn-primary" onClick={abrirCriar}>
                            Abrir primeiro chamado
                        </button>
                    </div>
                ) : (
                    <table className="tabela tabela-7col">
                        <thead>
                            <tr>
                                <th>Contato</th>
                                <th>Status</th>
                                <th>Categoria</th>
                                <th>Origem</th>
                                <th>Responsável</th>
                                <th>Abertura</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chamados.map(c => {
                                const status =
                                    STATUS_CONFIG[
                                        c.statusAtual as ChamadoStatusType
                                    ];
                                const categoria = c.categoria
                                    ? CATEGORIA_CONFIG[
                                          c.categoria as CategoriaType
                                      ]
                                    : null;
                                const origem =
                                    ORIGEM_CONFIG[c.origem as OrigemType];
                                const encerrado = c.statusAtual === "ENCERRADO";
                                return (
                                    <tr key={c.id}>
                                        <td>
                                            <button
                                                className="link-tabela"
                                                onClick={() => abrirDetalhe(c)}
                                            >
                                                {c.contatoNome}
                                            </button>
                                        </td>
                                        <td>
                                            {status && (
                                                <span
                                                    className="badge-status"
                                                    style={{
                                                        color: status.cor,
                                                        background: status.bg,
                                                        border: `1px solid ${status.border}`,
                                                    }}
                                                >
                                                    {status.icone}{" "}
                                                    {status.label}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {categoria ? (
                                                <span className="texto-categoria">
                                                    {categoria.icone}{" "}
                                                    {categoria.label}
                                                </span>
                                            ) : (
                                                "—"
                                            )}
                                        </td>
                                        <td>
                                            <span className="texto-origem">
                                                {origem.icone} {origem.label}
                                            </span>
                                        </td>
                                        <td>
                                            {c.usuarioResponsavelNome || (
                                                <span
                                                    style={{
                                                        color: "var(--color-text-muted)",
                                                    }}
                                                >
                                                    Sem responsável
                                                </span>
                                            )}
                                        </td>
                                        <td
                                            style={{
                                                fontSize: 12,
                                                color: "var(--color-text-muted)",
                                            }}
                                        >
                                            {formatarDataHora(c.dtAbertura)}
                                        </td>
                                        <td>
                                            <div className="acoes-tabela">
                                                <button
                                                    className="btn-acao btn-acao-editar"
                                                    onClick={() =>
                                                        abrirEditar(c)
                                                    }
                                                    title="Editar"
                                                >
                                                    ✏️
                                                </button>
                                                {!encerrado && (
                                                    <button
                                                        className="btn-acao btn-acao-encerrar"
                                                        onClick={() =>
                                                            abrirEncerrar(c)
                                                        }
                                                        title="Encerrar"
                                                    >
                                                        🔒
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ─── Modal Criar / Editar ─────────────────────────────────────────── */}
            {(modal === "criar" || modal === "editar") && (
                <div className="modal-overlay" onClick={() => setModal(null)}>
                    <div
                        className="modal modal-lg"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h3>
                                {modal === "criar"
                                    ? "Novo Chamado"
                                    : "Editar Chamado"}
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
                                {/* Contato */}
                                <div className="form-group form-col-2">
                                    <label>
                                        Contato{" "}
                                        <span className="obrigatorio">*</span>
                                    </label>
                                    <select
                                        title="contato"
                                        value={form.contatoId}
                                        onChange={e => {
                                            setForm(f => ({
                                                ...f,
                                                contatoId: e.target.value,
                                            }));
                                            setErros(er => ({
                                                ...er,
                                                contatoId: undefined,
                                            }));
                                        }}
                                        className={
                                            erros.contatoId ? "input-erro" : ""
                                        }
                                    >
                                        <option value="">
                                            Selecione o contato...
                                        </option>
                                        {contatos.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.nome} — {c.telefone}
                                            </option>
                                        ))}
                                    </select>
                                    {erros.contatoId && (
                                        <span className="erro-msg">
                                            {erros.contatoId}
                                        </span>
                                    )}
                                </div>

                                {/* Origem */}
                                <div className="form-group">
                                    <label>
                                        Origem{" "}
                                        <span className="obrigatorio">*</span>
                                    </label>
                                    <select
                                        title="origem"
                                        value={form.origem}
                                        onChange={e => {
                                            setForm(f => ({
                                                ...f,
                                                origem: e.target
                                                    .value as OrigemType,
                                            }));
                                            setErros(er => ({
                                                ...er,
                                                origem: undefined,
                                            }));
                                        }}
                                        className={
                                            erros.origem ? "input-erro" : ""
                                        }
                                    >
                                        {(
                                            Object.keys(
                                                ORIGEM_CONFIG,
                                            ) as OrigemType[]
                                        ).map(o => (
                                            <option key={o} value={o}>
                                                {ORIGEM_CONFIG[o].icone}{" "}
                                                {ORIGEM_CONFIG[o].label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Categoria */}
                                <div className="form-group">
                                    <label>Categoria</label>
                                    <select
                                        title="categoria"
                                        value={form.categoria}
                                        onChange={e =>
                                            setForm(f => ({
                                                ...f,
                                                categoria: e.target
                                                    .value as CategoriaType,
                                            }))
                                        }
                                    >
                                        {(
                                            Object.keys(
                                                CATEGORIA_CONFIG,
                                            ) as CategoriaType[]
                                        ).map(cat => (
                                            <option key={cat} value={cat}>
                                                {CATEGORIA_CONFIG[cat].icone}{" "}
                                                {CATEGORIA_CONFIG[cat].label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Status (apenas na edição) */}
                                {modal === "editar" && (
                                    <div className="form-group">
                                        <label>Status</label>
                                        <select
                                            title="status"
                                            value={form.statusAtual}
                                            onChange={e =>
                                                setForm(f => ({
                                                    ...f,
                                                    statusAtual: e.target
                                                        .value as ChamadoStatusType,
                                                }))
                                            }
                                        >
                                            {(
                                                Object.keys(
                                                    STATUS_CONFIG,
                                                ) as ChamadoStatusType[]
                                            )
                                                .filter(s => s !== "ENCERRADO")
                                                .map(s => (
                                                    <option key={s} value={s}>
                                                        {STATUS_CONFIG[s].icone}{" "}
                                                        {STATUS_CONFIG[s].label}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                )}

                                {/* Responsável */}
                                <div className="form-group">
                                    <label>Responsável</label>
                                    <select
                                        title="responsavel"
                                        value={form.usuarioResponsavelId}
                                        onChange={e =>
                                            setForm(f => ({
                                                ...f,
                                                usuarioResponsavelId:
                                                    e.target.value,
                                            }))
                                        }
                                    >
                                        <option value="">
                                            Sem responsável
                                        </option>
                                        {usuarios.map(u => (
                                            <option key={u.id} value={u.id}>
                                                {u.nome}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Tipo → Subtipo (cascata) */}
                                <div className="form-group">
                                    <label>Tipo</label>
                                    <select
                                        title="tipo"
                                        onChange={e =>
                                            handleTipoChange(e.target.value)
                                        }
                                        defaultValue=""
                                    >
                                        <option value="">
                                            Selecione o tipo...
                                        </option>
                                        {tipos.map(t => (
                                            <option key={t.id} value={t.id}>
                                                {t.nome}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Subtipo</label>
                                    <select
                                        title="subtipo"
                                        value={form.subtipoId}
                                        onChange={e =>
                                            setForm(f => ({
                                                ...f,
                                                subtipoId: e.target.value,
                                            }))
                                        }
                                        disabled={subtipos.length === 0}
                                    >
                                        <option value="">
                                            Selecione o subtipo...
                                        </option>
                                        {subtipos.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.nome}
                                            </option>
                                        ))}
                                    </select>
                                    {subtipos.length === 0 && (
                                        <span className="campo-info">
                                            Selecione um tipo primeiro
                                        </span>
                                    )}
                                </div>

                                {/* Descrição */}
                                <div className="form-group form-col-2">
                                    <label>Descrição</label>
                                    <textarea
                                        rows={3}
                                        value={form.texto}
                                        onChange={e =>
                                            setForm(f => ({
                                                ...f,
                                                texto: e.target.value,
                                            }))
                                        }
                                        placeholder="Descreva o chamado..."
                                        style={{ resize: "vertical" }}
                                    />
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
                                      ? "Abrir Chamado"
                                      : "Salvar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Modal Detalhe ───────────────────────────────────────────────── */}
            {modal === "detalhe" && selecionado && (
                <div className="modal-overlay" onClick={() => setModal(null)}>
                    <div
                        className="modal modal-lg"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                }}
                            >
                                <h3>Chamado</h3>
                                {(() => {
                                    const cfg =
                                        STATUS_CONFIG[
                                            selecionado.statusAtual as ChamadoStatusType
                                        ];
                                    return cfg ? (
                                        <span
                                            className="badge-status"
                                            style={{
                                                color: cfg.cor,
                                                background: cfg.bg,
                                                border: `1px solid ${cfg.border}`,
                                            }}
                                        >
                                            {cfg.icone} {cfg.label}
                                        </span>
                                    ) : null;
                                })()}
                            </div>
                            <button
                                className="modal-fechar"
                                onClick={() => setModal(null)}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Abas */}
                        <div className="chamado-abas">
                            <button
                                className={`chamado-aba ${abaDetalhe === "info" ? "ativa" : ""}`}
                                onClick={() => setAbaDetalhe("info")}
                            >
                                📋 Informações
                            </button>
                            <button
                                className={`chamado-aba ${abaDetalhe === "historico" ? "ativa" : ""}`}
                                onClick={() => setAbaDetalhe("historico")}
                            >
                                🕐 Histórico ({historico.length})
                            </button>
                        </div>

                        <div className="modal-body">
                            {abaDetalhe === "info" ? (
                                <>
                                    <div className="detalhe-grid">
                                        <DetalheItem
                                            label="Contato"
                                            valor={selecionado.contatoNome}
                                            span2
                                        />
                                        <DetalheItem
                                            label="Responsável"
                                            valor={
                                                selecionado.usuarioResponsavelNome
                                            }
                                        />
                                        <DetalheItem
                                            label="Origem"
                                            valor={`${ORIGEM_CONFIG[selecionado.origem as OrigemType]?.icone} ${ORIGEM_CONFIG[selecionado.origem as OrigemType]?.label}`}
                                        />
                                        <DetalheItem
                                            label="Categoria"
                                            valor={
                                                selecionado.categoria
                                                    ? `${CATEGORIA_CONFIG[selecionado.categoria as CategoriaType]?.icone} ${CATEGORIA_CONFIG[selecionado.categoria as CategoriaType]?.label}`
                                                    : undefined
                                            }
                                        />
                                        <DetalheItem
                                            label="Abertura"
                                            valor={formatarDataHora(
                                                selecionado.dtAbertura,
                                            )}
                                        />
                                        <DetalheItem
                                            label="Encerramento"
                                            valor={formatarDataHora(
                                                selecionado.dtEncerramento,
                                            )}
                                        />
                                        <DetalheItem
                                            label="1ª Mensagem"
                                            valor={formatarDataHora(
                                                selecionado.dtPrimeiraMensagem,
                                            )}
                                        />
                                        <DetalheItem
                                            label="1ª Resposta"
                                            valor={formatarDataHora(
                                                selecionado.dtPrimeiraResposta,
                                            )}
                                        />
                                        <DetalheItem
                                            label="Tempo Total"
                                            valor={formatarTempo(
                                                selecionado.tempoTotalSegundos,
                                            )}
                                        />
                                    </div>

                                    {selecionado.texto && (
                                        <div className="chamado-texto-box">
                                            <span className="detalhe-label">
                                                Descrição
                                            </span>
                                            <p>{selecionado.texto}</p>
                                        </div>
                                    )}

                                    {selecionado.solucao && (
                                        <div className="chamado-texto-box chamado-solucao-box">
                                            <span className="detalhe-label">
                                                ✅ Solução
                                            </span>
                                            <p>{selecionado.solucao}</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="historico-lista">
                                    {historico.length === 0 ? (
                                        <div
                                            className="estado-vazio"
                                            style={{ padding: 24 }}
                                        >
                                            <p>Nenhum histórico registrado.</p>
                                        </div>
                                    ) : (
                                        historico.map((h, i) => {
                                            const cfg =
                                                STATUS_CONFIG[
                                                    h.status as ChamadoStatusType
                                                ];
                                            return (
                                                <div
                                                    key={h.id || i}
                                                    className="historico-item"
                                                >
                                                    <div
                                                        className="historico-dot"
                                                        style={{
                                                            background:
                                                                cfg?.cor ||
                                                                "#ccc",
                                                        }}
                                                    />
                                                    <div className="historico-conteudo">
                                                        <div className="historico-topo">
                                                            <span
                                                                className="badge-status"
                                                                style={{
                                                                    color: cfg?.cor,
                                                                    background:
                                                                        cfg?.bg,
                                                                    border: `1px solid ${cfg?.border}`,
                                                                }}
                                                            >
                                                                {cfg?.icone}{" "}
                                                                {cfg?.label}
                                                            </span>
                                                            <span className="historico-tempo">
                                                                {formatarTempo(
                                                                    h.tempoEmStatusSegundos,
                                                                )}
                                                            </span>
                                                        </div>
                                                        <div className="historico-datas">
                                                            <span>
                                                                Início:{" "}
                                                                {formatarDataHora(
                                                                    h.dtInicio,
                                                                )}
                                                            </span>
                                                            {h.dtFim && (
                                                                <span>
                                                                    Fim:{" "}
                                                                    {formatarDataHora(
                                                                        h.dtFim,
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setModal(null)}
                            >
                                Fechar
                            </button>
                            {selecionado.statusAtual !== "ENCERRADO" && (
                                <>
                                    <button
                                        className="btn-secondary"
                                        onClick={() => abrirEditar(selecionado)}
                                    >
                                        Editar
                                    </button>
                                    <button
                                        className="btn-danger"
                                        onClick={() =>
                                            abrirEncerrar(selecionado)
                                        }
                                    >
                                        🔒 Encerrar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Modal Encerrar ──────────────────────────────────────────────── */}
            {modal === "encerrar" && selecionado && (
                <div className="modal-overlay" onClick={() => setModal(null)}>
                    <div
                        className="modal modal-sm"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h3>Encerrar Chamado</h3>
                            <button
                                className="modal-fechar"
                                onClick={() => setModal(null)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <p
                                style={{
                                    marginBottom: 12,
                                    fontSize: 13,
                                    color: "var(--color-text-muted)",
                                }}
                            >
                                Contato:{" "}
                                <strong style={{ color: "var(--color-text)" }}>
                                    {selecionado.contatoNome}
                                </strong>
                            </p>
                            <div className="form-group">
                                <label>
                                    Solução{" "}
                                    <span className="obrigatorio">*</span>
                                </label>
                                <textarea
                                    rows={4}
                                    value={solucaoEncerrar}
                                    onChange={e => {
                                        setSolucaoEncerrar(e.target.value);
                                        setErros({});
                                    }}
                                    placeholder="Descreva a solução aplicada..."
                                    className={
                                        erros.solucaoEncerrar
                                            ? "input-erro"
                                            : ""
                                    }
                                    style={{ resize: "vertical" }}
                                    autoFocus
                                />
                                {erros.solucaoEncerrar && (
                                    <span className="erro-msg">
                                        {erros.solucaoEncerrar}
                                    </span>
                                )}
                            </div>
                            <p className="texto-aviso">
                                ⚠️ O chamado será marcado como encerrado e o
                                tempo total será calculado.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setModal(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn-danger"
                                onClick={encerrar}
                                disabled={salvando}
                            >
                                {salvando
                                    ? "Encerrando..."
                                    : "🔒 Confirmar Encerramento"}
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
    span2,
    mono,
}: {
    label: string;
    valor?: string | null;
    span2?: boolean;
    mono?: boolean;
}) {
    return (
        <div
            className="detalhe-item"
            style={span2 ? { gridColumn: "span 2" } : {}}
        >
            <span className="detalhe-label">{label}</span>
            <span className={`detalhe-valor ${mono ? "texto-mono" : ""}`}>
                {valor || "—"}
            </span>
        </div>
    );
}
