// Opções de itens por página disponíveis ao usuário
export const OPCOES_TAMANHO = [10, 25, 50] as const;
export type TamanhoPagina = (typeof OPCOES_TAMANHO)[number];

interface PaginationProps {
    page: number;
    totalPages: number;
    totalElements: number;
    size: number;
    // Callbacks para o componente pai atualizar o estado
    onPageChange: (page: number) => void;
    onSizeChange: (size: TamanhoPagina) => void;
}

export function Pagination({
    page,
    totalPages,
    totalElements,
    size,
    onPageChange,
    onSizeChange,
}: PaginationProps) {
    const temAnterior = page > 0;
    const temProxima = page < totalPages - 1;

    // Converte de 0-indexed (Spring) para 1-indexed (exibição)
    const paginaExibida = page + 1;

    // Gera os botões de página — máx 5 visíveis com reticências
    const gerarBotoes = (): (number | "...")[] => {
        if (totalPages <= 5) {
            return Array.from({ length: totalPages }, (_, i) => i);
        }
        const botoes: (number | "...")[] = [0];
        if (page > 2) botoes.push("...");
        for (
            let i = Math.max(1, page - 1);
            i <= Math.min(totalPages - 2, page + 1);
            i++
        ) {
            botoes.push(i);
        }
        if (page < totalPages - 3) botoes.push("...");
        botoes.push(totalPages - 1);
        return botoes;
    };

    // Exibição do intervalo de registros: "1–10 de 45"
    const inicio = totalElements === 0 ? 0 : page * size + 1;
    const fim = Math.min(page * size + size, totalElements);

    return (
        <div className="paginacao-bar">
            {/* Info + seletor de tamanho */}
            <div className="paginacao-info">
                <span className="paginacao-contagem">
                    {totalElements === 0
                        ? "Nenhum resultado"
                        : `${inicio}–${fim} de ${totalElements}`}
                </span>
                <label className="paginacao-tamanho-label">
                    Exibir
                    <select
                        className="paginacao-tamanho-select"
                        value={size}
                        onChange={e =>
                            onSizeChange(
                                Number(e.target.value) as TamanhoPagina,
                            )
                        }
                        title="Itens por página"
                    >
                        {OPCOES_TAMANHO.map(t => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                    por página
                </label>
            </div>

            {/* Navegação */}
            <div className="paginacao-nav">
                <button
                    className="paginacao-btn"
                    onClick={() => onPageChange(0)}
                    disabled={!temAnterior}
                    title="Primeira página"
                >
                    «
                </button>
                <button
                    className="paginacao-btn"
                    onClick={() => onPageChange(page - 1)}
                    disabled={!temAnterior}
                    title="Página anterior"
                >
                    ‹
                </button>

                {gerarBotoes().map((p, i) =>
                    p === "..." ? (
                        <span
                            key={`ellipsis-${i}`}
                            className="paginacao-reticencias"
                        >
                            …
                        </span>
                    ) : (
                        <button
                            key={p}
                            className={`paginacao-btn${page === p ? " ativo" : ""}`}
                            onClick={() => onPageChange(p)}
                            title={`Página ${p + 1}`}
                        >
                            {p + 1}
                        </button>
                    ),
                )}

                <button
                    className="paginacao-btn"
                    onClick={() => onPageChange(page + 1)}
                    disabled={!temProxima}
                    title="Próxima página"
                >
                    ›
                </button>
                <button
                    className="paginacao-btn"
                    onClick={() => onPageChange(totalPages - 1)}
                    disabled={!temProxima}
                    title="Última página"
                >
                    »
                </button>
            </div>

            {/* Indicador de página atual — útil em mobile */}
            {totalPages > 1 && (
                <span className="paginacao-pagina-atual">
                    Página {paginaExibida} de {totalPages}
                </span>
            )}
        </div>
    );
}
