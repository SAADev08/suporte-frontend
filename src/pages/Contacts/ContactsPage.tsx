import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import type { Contato, Cliente, PageResponse } from "../../types";
import { contactApi, type ContatoRequest } from "../../services/api/contactApi";
import { clienteApi } from "../../services/api/clientApi";
import { formatarData, formatarTelefone } from "../../utils/formatters";
import "./contacts.css";
import { Pagination, type TamanhoPagina } from "../../components/Pagination";
import { useNotificacaoStore } from "../../store/notificationStore";
import { ContactTimeline } from "./ContactTimeline";

function apenasNumeros(v: string) {
    return v.replace(/\D/g, "");
}

// ─── Estado inicial ───────────────────────────────────────────────────────────
const FORM_VAZIO: ContatoRequest = {
    nome: "",
    telefone: "",
    email: "",
    clienteIds: [],
};

type Erros = Partial<Record<keyof ContatoRequest | "clienteIds", string>>;

// ─── Componente principal ─────────────────────────────────────────────────────
export function ContactsPage() {
    const [pageData, setPageData] = useState<PageResponse<Contato> | null>(
        null,
    );
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState({ nome: "", telefone: "", email: "" });
    const [modal, setModal] = useState<"criar" | "editar" | "detalhe" | null>(
        null,
    );
    const [selecionado, setSelecionado] = useState<Contato | null>(null);
    const [form, setForm] = useState<ContatoRequest>(FORM_VAZIO);
    const [erros, setErros] = useState<Erros>({});
    const [salvando, setSalvando] = useState(false);
    const [confirmInativar, setConfirmInativar] = useState<Contato | null>(
        null,
    );
    const [clienteBusca, setClienteBusca] = useState("");
    const [page, setPage] = useState(0);
    const [size, setSize] = useState<TamanhoPagina>(10);
    const [timelineContato, setTimelineContato] = useState<{
        id: string;
        nome: string;
        telefone: string;
    } | null>(null);

    const { removerContatoPendente } = useNotificacaoStore.getState();

    // ─── Carregar clientes para o select ──────────────────────────────────────
    useEffect(() => {
        clienteApi
            .listar()
            .then(({ data }: { data: PageResponse<Cliente> }) =>
                setClientes(data.content.filter(c => c.ativo)),
            )
            .catch(() => toast.error("Erro ao carregar lista de clientes"));
    }, []);

    // ─── Carregar contatos ─────────────────────────────────────────────────────
    const carregar = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                nome: busca.nome || undefined,
                telefone: apenasNumeros(busca.telefone) || undefined,
                email: busca.email || undefined,
                page,
                size,
            };
            const { data } = await contactApi.listar(params);
            setPageData(data);
        } catch {
            toast.error("Erro ao carregar contatos");
        } finally {
            setLoading(false);
        }
    }, [busca, page, size]);

    useEffect(() => {
        carregar();
    }, [carregar]);

    // ─── Validação ─────────────────────────────────────────────────────────────
    const validar = (): boolean => {
        const e: Erros = {};
        if (!form.nome.trim()) e.nome = "Nome é obrigatório";
        const tel = apenasNumeros(form.telefone);
        if (!tel) e.telefone = "Telefone é obrigatório";
        else if (tel.length < 10)
            e.telefone = "Telefone inválido (mínimo 10 dígitos)";
        if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
            e.email = "E-mail inválido";
        if (form.clienteIds.length === 0)
            e.clienteIds = "Vincule pelo menos um cliente";
        setErros(e);
        return Object.keys(e).length === 0;
    };

    // ─── Abrir modais ──────────────────────────────────────────────────────────
    const abrirCriar = () => {
        setForm(FORM_VAZIO);
        setErros({});
        setSelecionado(null);
        setClienteBusca("");
        setModal("criar");
    };

    const abrirEditar = (c: Contato) => {
        console.log(c);
        setForm({
            nome: c.nome,
            telefone: formatarTelefone(c.telefone),
            email: c.email || "",
            clienteIds: c.clientes?.map(cl => cl.id) ?? [],
        });
        setErros({});
        setSelecionado(c);
        setClienteBusca("");
        setModal("editar");
    };

    const abrirDetalhe = async (c: Contato) => {
        try {
            const { data } = await contactApi.buscarPorId(c.id);
            setSelecionado(data);
            setModal("detalhe");
        } catch {
            toast.error("Erro ao carregar dados do contato");
        }
    };

    // ─── Salvar ────────────────────────────────────────────────────────────────
    const salvar = async () => {
        if (!validar()) return;
        setSalvando(true);
        try {
            const payload: ContatoRequest = {
                ...form,
                telefone: apenasNumeros(form.telefone),
            };
            if (modal === "criar") {
                await contactApi.criar(payload);
                toast.success("Contato cadastrado com sucesso!");
            } else if (modal === "editar" && selecionado) {
                console.log(selecionado);
                await contactApi.atualizar(selecionado.id, payload);
                toast.success("Contato atualizado com sucesso!");

                if (selecionado.pendenteVinculacao) {
                    removerContatoPendente(selecionado.id);
                }
            }
            setModal(null);
            carregar();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message || "Erro ao salvar contato";
            toast.error(msg);
        } finally {
            setSalvando(false);
        }
    };

    // ─── Inativar ──────────────────────────────────────────────────────────────
    const inativar = async () => {
        if (!confirmInativar) return;
        try {
            await contactApi.inativar(confirmInativar.id);
            toast.success(`Contato "${confirmInativar.nome}" inativado.`);
            setConfirmInativar(null);
            carregar();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ||
                "Não foi possível inativar o contato";
            toast.error(msg);
            setConfirmInativar(null);
        }
    };

    // ─── Handlers formulário ───────────────────────────────────────────────────
    const handleChange = (field: keyof ContatoRequest, value: string) => {
        if (field === "telefone") {
            setForm(f => ({
                ...f,
                telefone: formatarTelefone(apenasNumeros(value)),
            }));
        } else {
            setForm(f => ({ ...f, [field]: value }));
        }
        if ((erros as Record<string, unknown>)[field])
            setErros(e => ({ ...e, [field]: undefined }));
    };

    const toggleCliente = (id: string) => {
        setForm(f => {
            const ids = f.clienteIds.includes(id)
                ? f.clienteIds.filter(x => x !== id)
                : [...f.clienteIds, id];
            return { ...f, clienteIds: ids };
        });
        if (erros.clienteIds) setErros(e => ({ ...e, clienteIds: undefined }));
    };

    // ─── Clientes filtrados no select ─────────────────────────────────────────
    const clientesFiltrados = clientes.filter(
        c =>
            c.nome.toLowerCase().includes(clienteBusca.toLowerCase()) ||
            c.cpfCnpj.includes(clienteBusca),
    );

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="modulo">
            {/* Cabeçalho */}
            <div className="modulo-header">
                <div>
                    <h2 className="modulo-titulo">Contatos</h2>
                    <p className="modulo-subtitulo">
                        Gerencie os contatos vinculados aos clientes
                    </p>
                </div>
                <button className="btn-primary" onClick={abrirCriar}>
                    + Novo Contato
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
                    placeholder="Telefone..."
                    value={busca.telefone}
                    onChange={e =>
                        setBusca(b => ({ ...b, telefone: e.target.value }))
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
                        <p>Nenhum contato encontrado.</p>
                        <button className="btn-primary" onClick={abrirCriar}>
                            Cadastrar primeiro contato
                        </button>
                    </div>
                ) : (
                    <>
                        <table className="tabela tabela-6col">
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Telefone</th>
                                    <th className="tabela-col-ocultar-mobile">
                                        E-mail
                                    </th>
                                    <th className="tabela-col-ocultar-mobile">
                                        Clientes
                                    </th>

                                    <th>Status</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageData.content.map(c => (
                                    <tr
                                        key={c.id}
                                        className={
                                            !c.ativo ? "linha-inativa" : ""
                                        }
                                    >
                                        <td>
                                            <button
                                                className="link-tabela"
                                                onClick={() => abrirDetalhe(c)}
                                            >
                                                {c.nome}
                                            </button>
                                        </td>
                                        <td className="texto-mono">
                                            {formatarTelefone(c.telefone)}
                                        </td>
                                        <td className="tabela-col-ocultar-mobile">
                                            {c.email || "—"}
                                        </td>
                                        <td className="tabela-col-ocultar-mobile">
                                            <div className="clientes-chips">
                                                {c.clientes
                                                    ?.slice(0, 2)
                                                    .map(cl => (
                                                        <span
                                                            key={cl.id}
                                                            className="chip"
                                                        >
                                                            {cl.nome}
                                                        </span>
                                                    ))}
                                                {(c.clientes?.length ?? 0) >
                                                    2 && (
                                                    <span className="chip chip-mais">
                                                        +
                                                        {(c.clientes?.length ??
                                                            0) - 2}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span
                                                className={`badge ${c.ativo ? "badge-ativo" : "badge-inativo"}`}
                                            >
                                                {c.ativo ? "Ativo" : "Inativo"}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="acoes-tabela">
                                                <button
                                                    className="btn-acao"
                                                    onClick={() =>
                                                        setTimelineContato({
                                                            id: c.id,
                                                            nome: c.nome,
                                                            telefone: c.telefone,
                                                        })
                                                    }
                                                    title="Ver conversa"
                                                >
                                                    💬
                                                </button>
                                                <button
                                                    className="btn-acao btn-acao-editar"
                                                    onClick={() =>
                                                        abrirEditar(c)
                                                    }
                                                    title="Editar"
                                                >
                                                    ✏️
                                                </button>
                                                {c.ativo && (
                                                    <button
                                                        className="btn-acao btn-acao-inativar"
                                                        onClick={() =>
                                                            setConfirmInativar(
                                                                c,
                                                            )
                                                        }
                                                        title="Inativar"
                                                    >
                                                        🚫
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
                    <div
                        className="modal modal-lg"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h3>
                                {modal === "criar"
                                    ? "Novo Contato"
                                    : "Editar Contato"}
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

                                {/* Telefone */}
                                <div className="form-group">
                                    <label>
                                        Telefone{" "}
                                        <span className="obrigatorio">*</span>
                                    </label>
                                    <input
                                        value={form.telefone}
                                        onChange={e =>
                                            handleChange(
                                                "telefone",
                                                e.target.value,
                                            )
                                        }
                                        placeholder="(00) 00000-0000"
                                        maxLength={15}
                                        className={
                                            erros.telefone ? "input-erro" : ""
                                        }
                                    />
                                    {erros.telefone && (
                                        <span className="erro-msg">
                                            {erros.telefone}
                                        </span>
                                    )}
                                </div>

                                {/* E-mail */}
                                <div className="form-group">
                                    <label>E-mail</label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={e =>
                                            handleChange(
                                                "email",
                                                e.target.value,
                                            )
                                        }
                                        placeholder="email@exemplo.com"
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

                                {/* Clientes vinculados */}
                                <div className="form-group form-col-2">
                                    <label>
                                        Clientes vinculados{" "}
                                        <span className="obrigatorio">*</span>
                                        <span
                                            className="campo-info"
                                            style={{ marginLeft: 8 }}
                                        >
                                            {form.clienteIds.length}{" "}
                                            selecionado(s)
                                        </span>
                                    </label>

                                    <div
                                        className={`clientes-select-box ${erros.clienteIds ? "input-erro" : ""}`}
                                    >
                                        {/* Busca dentro do select */}
                                        <div className="clientes-select-search">
                                            <input
                                                placeholder="Filtrar clientes..."
                                                value={clienteBusca}
                                                onChange={e =>
                                                    setClienteBusca(
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>

                                        {/* Lista de clientes */}
                                        <div className="clientes-select-list">
                                            {clientesFiltrados.length === 0 ? (
                                                <div className="clientes-select-vazio">
                                                    Nenhum cliente encontrado
                                                </div>
                                            ) : (
                                                clientesFiltrados.map(cl => {
                                                    const selecionado =
                                                        form.clienteIds.includes(
                                                            cl.id,
                                                        );
                                                    return (
                                                        <label
                                                            key={cl.id}
                                                            className={`cliente-option ${selecionado ? "selecionado" : ""}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={
                                                                    selecionado
                                                                }
                                                                onChange={() =>
                                                                    toggleCliente(
                                                                        cl.id,
                                                                    )
                                                                }
                                                            />
                                                            <span className="cliente-option-nome">
                                                                {cl.nome}
                                                            </span>
                                                            <span className="cliente-option-cidade">
                                                                {cl.cidade ||
                                                                    "—"}
                                                            </span>
                                                        </label>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                    {erros.clienteIds && (
                                        <span className="erro-msg">
                                            {erros.clienteIds}
                                        </span>
                                    )}

                                    {/* Chips dos selecionados */}
                                    {form.clienteIds.length > 0 && (
                                        <div
                                            className="clientes-chips"
                                            style={{ marginTop: 6 }}
                                        >
                                            {form.clienteIds.map(id => {
                                                const cl = clientes.find(
                                                    c => c.id === id,
                                                );
                                                return cl ? (
                                                    <span
                                                        key={id}
                                                        className="chip chip-removivel"
                                                    >
                                                        {cl.nome}
                                                        <button
                                                            onClick={() =>
                                                                toggleCliente(
                                                                    id,
                                                                )
                                                            }
                                                        >
                                                            ✕
                                                        </button>
                                                    </span>
                                                ) : null;
                                            })}
                                        </div>
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
                                      ? "Cadastrar"
                                      : "Salvar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Detalhe */}
            {modal === "detalhe" && selecionado && (
                <div className="modal-overlay" onClick={() => setModal(null)}>
                    <div
                        className="modal modal-lg"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h3>Detalhes do Contato</h3>
                            <button
                                className="modal-fechar"
                                onClick={() => setModal(null)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="detalhe-grid">
                                <DetalheItem
                                    label="Nome"
                                    valor={selecionado.nome}
                                    span2
                                />
                                <DetalheItem
                                    label="Telefone"
                                    valor={formatarTelefone(
                                        selecionado.telefone,
                                    )}
                                    mono
                                />
                                <DetalheItem
                                    label="E-mail"
                                    valor={selecionado.email}
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
                            </div>

                            {/* Clientes vinculados */}
                            <div style={{ marginTop: 16 }}>
                                <p
                                    className="detalhe-label"
                                    style={{ marginBottom: 8 }}
                                >
                                    Clientes vinculados
                                </p>
                                <div className="clientes-chips">
                                    {selecionado.clientes?.length ? (
                                        selecionado.clientes.map(cl => (
                                            <span
                                                key={cl.id}
                                                className="chip chip-lg"
                                            >
                                                <strong>{cl.nome}</strong>
                                                {cl.cidade && (
                                                    <span
                                                        style={{
                                                            color: "var(--color-text-muted)",
                                                            marginLeft: 4,
                                                        }}
                                                    >
                                                        — {cl.cidade}
                                                    </span>
                                                )}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="campo-info">
                                            Nenhum cliente vinculado
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

            {/* Timeline de conversa por contato */}
            {timelineContato && (
                <ContactTimeline
                    contatoId={timelineContato.id}
                    contatoNome={timelineContato.nome}
                    foneContato={formatarTelefone(timelineContato.telefone)}
                    onClose={() => setTimelineContato(null)}
                />
            )}

            {/* Modal Confirmar Inativação */}
            {confirmInativar && (
                <div
                    className="modal-overlay"
                    onClick={() => setConfirmInativar(null)}
                >
                    <div
                        className="modal modal-sm"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h3>Confirmar Inativação</h3>
                            <button
                                className="modal-fechar"
                                onClick={() => setConfirmInativar(null)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>
                                Deseja inativar o contato{" "}
                                <strong>{confirmInativar.nome}</strong>?
                            </p>
                            <p className="texto-aviso">
                                ⚠️ Esta ação só é permitida se não houver
                                chamados abertos vinculados a este contato.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setConfirmInativar(null)}
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
