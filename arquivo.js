/**
 * ============================================================
 *  MultiSelectTag — Componente de seleção múltipla com busca
 * ============================================================
 *
 * Uso:
 *   new MultiSelectTag('id-do-select', { opções });
 *
 * Opções disponíveis:
 *   placeholder  {string}   — Texto do campo de busca. Padrão: "Pesquisar..."
 *   rounded      {boolean}  — Bordas arredondadas. Padrão: true
 *   shadow       {boolean}  — Sombra no componente. Padrão: false
 *   tagColor     {object}   — Cores das tags selecionadas:
 *                              { textColor, borderColor, bgColor }
 *   onChange     {function} — Callback chamado ao mudar seleção.
 *                              Recebe um array de { label, value }.
 *
 * Exemplo:
 *   new MultiSelectTag('meu-select', {
 *     placeholder: 'Buscar...',
 *     tagColor: { textColor: '#fff', borderColor: '#333', bgColor: '#333' },
 *     onChange: (selecionados) => console.log(selecionados)
 *   });
 */
function MultiSelectTag(selectId, opcoes = {}) {

    // ── Configurações com valores padrão ──────────────────────────────────────
    const config = {
        rounded:     opcoes.rounded     ?? true,
        shadow:      opcoes.shadow      ?? false,
        placeholder: opcoes.placeholder ?? 'Pesquisar...',
        onChange:    opcoes.onChange    ?? null,
        tagColor: {
            textColor:   opcoes.tagColor?.textColor   || '#041d36',
            borderColor: opcoes.tagColor?.borderColor || '#0a4b8c74',
            bgColor:     opcoes.tagColor?.bgColor     || '#a8d4ff8e',
        }
    };

    // ── Referências aos elementos do DOM ──────────────────────────────────────
    let selectOriginal;   // O <select> original (ficará oculto)
    let dados = [];       // Array interno de opções { value, label, selected }
    let parser = new DOMParser();

    // Elementos que serão criados dinamicamente
    let wrapper, corpo, inputContainer, inputBusca, btnToggle, gaveta, lista;

    // ── Inicialização ─────────────────────────────────────────────────────────

    selectOriginal = document.getElementById(selectId);
    if (!selectOriginal) {
        console.warn(`MultiSelectTag: elemento com id "${selectId}" não encontrado.`);
        return;
    }

    // Lê as opções do <select> original e converte para array interno
    dados = Array.from(selectOriginal.options).map(opt => ({
        value:    opt.value,
        label:    opt.label,
        selected: opt.selected
    }));

    // Oculta o <select> original (mantemos para compatibilidade com formulários)
    selectOriginal.classList.add('hidden');

    _construirInterface();
    _renderizarLista();
    _adicionarEventosLista();
    _sincronizarSelectOriginal(false); // false = não dispara onChange na inicialização

    // ── Construção da interface visual ────────────────────────────────────────

    function _construirInterface() {
        // Contêiner raiz do componente
        wrapper = document.createElement('div');
        wrapper.classList.add('mult-select-tag');

        // Div interna para largura 100%
        const wrapperInterno = document.createElement('div');
        wrapperInterno.classList.add('wrapper');

        // Corpo: área visível com tags + botão de seta
        corpo = document.createElement('div');
        corpo.classList.add('body');
        if (config.shadow)  corpo.classList.add('shadow');
        if (config.rounded) corpo.classList.add('rounded');

        // Área onde as tags selecionadas aparecem + campo de busca
        inputContainer = document.createElement('div');
        inputContainer.classList.add('input-container');

        // Campo de busca
        inputBusca = document.createElement('input');
        inputBusca.classList.add('input');
        inputBusca.placeholder = config.placeholder;
        inputBusca.setAttribute('aria-label', config.placeholder);

        // Div que envolve o campo de busca
        const inputBody = document.createElement('div');
        inputBody.classList.add('input-body');
        inputBody.append(inputBusca);

        corpo.append(inputContainer);

        // Botão com seta para abrir/fechar a gaveta de opções
        const btnContainer = document.createElement('div');
        btnContainer.classList.add('btn-container');

        btnToggle = document.createElement('button');
        btnToggle.type = 'button';
        btnToggle.setAttribute('aria-label', 'Abrir lista de opções');

        const setaSVG = parser.parseFromString(`
            <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"
                 fill="none" viewBox="0 0 24 24" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="18 15 12 21 6 15"></polyline>
            </svg>
        `, 'image/svg+xml').documentElement;

        btnToggle.append(setaSVG);
        btnContainer.append(btnToggle);
        corpo.append(btnContainer);
        wrapperInterno.append(corpo);

        // Gaveta (dropdown) com campo de busca e lista de opções
        gaveta = document.createElement('div');
        gaveta.classList.add('drawer', 'hidden');
        if (config.shadow)  gaveta.classList.add('shadow');
        if (config.rounded) gaveta.classList.add('rounded');

        gaveta.append(inputBody);

        lista = document.createElement('ul');
        gaveta.appendChild(lista);

        wrapper.appendChild(wrapperInterno);
        wrapper.appendChild(gaveta);

        // Insere o novo componente logo após o <select> original
        if (selectOriginal.nextSibling) {
            selectOriginal.parentNode.insertBefore(wrapper, selectOriginal.nextSibling);
        } else {
            selectOriginal.parentNode.appendChild(wrapper);
        }

        // ── Eventos da interface ───────────────────────────────────────────────

        // Abre/fecha a gaveta ao clicar em qualquer lugar do corpo do componente
        // (área de tags + seta). O clique no ícone X das tags já chama
        // e.stopPropagation(), então remover uma tag não reabre a gaveta.
        corpo.addEventListener('click', () => {
            if (gaveta.classList.contains('hidden')) {
                _renderizarLista();
                _adicionarEventosLista();
                gaveta.classList.remove('hidden');
                inputBusca.focus();
            } else {
                gaveta.classList.add('hidden');
            }
        });

        // Filtra a lista ao digitar no campo de busca
        inputBusca.addEventListener('keyup', () => {
            _renderizarLista(inputBusca.value);
            _adicionarEventosLista();
        });

        // Remove a última tag com Backspace quando o campo está vazio
        inputBusca.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !inputBusca.value) {
                const tags = Array.from(inputContainer.children)
                    .filter(el => !el.classList.contains('input-body'));

                if (tags.length > 0) {
                    const ultimaTag = tags[tags.length - 1];
                    const valor = ultimaTag.firstChild?.dataset?.value;
                    if (valor) {
                        const item = dados.find(d => d.value === valor);
                        if (item) item.selected = false;
                        _removerTag(valor);
                        _sincronizarSelectOriginal();
                    }
                }
            }
        });

        // Fecha a gaveta ao clicar fora do componente
        window.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                gaveta.classList.add('hidden');
            }
        });
    }

    // ── Renderiza a lista de opções na gaveta ─────────────────────────────────
    // textoBusca: filtra apenas os itens cujo label começa com o texto
    function _renderizarLista(textoBusca = null) {
        lista.innerHTML = '';

        dados.forEach(item => {
            // Aplica filtro de busca (sem acento, sem case)
            if (textoBusca) {
                const textoNorm = _removerAcentos(textoBusca.toLowerCase());
                const labelNorm = _removerAcentos(item.label.toLowerCase());
                if (!labelNorm.includes(textoNorm)) return;
            }

            const li = document.createElement('li');
            li.dataset.value = item.value;

            // Checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.style.margin = '0 0.5em 0 0';
            checkbox.classList.add('input_checkbox');
            checkbox.dataset.value = item.value;
            checkbox.checked = item.selected;

            li.appendChild(checkbox);
            li.appendChild(document.createTextNode(item.label));

            // Destaque visual para itens já selecionados
            if (item.selected) {
                li.style.backgroundColor = config.tagColor.bgColor;
                // Cria a tag no inputContainer se ainda não existir
                if (!_tagJaExiste(item.value)) {
                    _criarTag(item);
                }
            }

            lista.appendChild(li);
        });
    }

    // ── Adiciona eventos de clique em cada item da lista ──────────────────────
    function _adicionarEventosLista() {
        Array.from(lista.children).forEach(li => {
            li.addEventListener('click', (e) => {
                const valor = e.currentTarget.dataset.value;
                const item  = dados.find(d => d.value === valor);
                if (!item) return;

                if (!item.selected) {
                    // Seleciona o item
                    item.selected = true;
                    inputBusca.value = '';
                    _renderizarLista();
                    _adicionarEventosLista();
                } else {
                    // Deseleciona o item
                    item.selected = false;
                    inputBusca.value = '';
                    _renderizarLista();
                    _adicionarEventosLista();
                    _removerTag(valor);
                }

                _sincronizarSelectOriginal();
            });
        });
    }

    // ── Cria uma "tag" (pill) no inputContainer para um item selecionado ──────
    function _criarTag(item) {
        const tag = document.createElement('div');
        tag.classList.add('item-container');
        tag.style.color       = config.tagColor.textColor;
        tag.style.borderColor = config.tagColor.borderColor;
        tag.style.background  = config.tagColor.bgColor;

        const label = document.createElement('div');
        label.classList.add('item-label');
        label.style.color = config.tagColor.textColor;
        label.textContent = item.label;
        label.dataset.value = item.value;

        // Ícone X para remover a tag individualmente
        const fechar = parser.parseFromString(`
            <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"
                 fill="none" viewBox="0 0 24 24" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                 class="item-close-svg">
                <line x1="18" y1="6"  x2="6"  y2="18"></line>
                <line x1="6"  y1="6"  x2="18" y2="18"></line>
            </svg>
        `, 'image/svg+xml').documentElement;

        fechar.addEventListener('click', (e) => {
            e.stopPropagation(); // evita abrir a gaveta ao fechar uma tag
            const itemParaRemover = dados.find(d => d.value === item.value);
            if (itemParaRemover) itemParaRemover.selected = false;
            _removerTag(item.value);
            _renderizarLista();
            _sincronizarSelectOriginal();
        });

        tag.appendChild(label);
        tag.appendChild(fechar);
        inputContainer.append(tag);
    }

    // ── Remove uma tag do inputContainer pelo value ───────────────────────────
    function _removerTag(valor) {
        Array.from(inputContainer.children).forEach(el => {
            if (!el.classList.contains('input-body') &&
                el.firstChild?.dataset?.value === valor) {
                inputContainer.removeChild(el);
            }
        });
    }

    // ── Verifica se uma tag já existe no inputContainer ───────────────────────
    function _tagJaExiste(valor) {
        return Array.from(inputContainer.children).some(el =>
            !el.classList.contains('input-body') &&
            el.firstChild?.dataset?.value === valor
        );
    }

    // ── Sincroniza o <select> original e dispara o onChange ───────────────────
    // dispararCallback: se false, não chama config.onChange (usado na inicialização)
    function _sincronizarSelectOriginal(dispararCallback = true) {
        const selecionados = [];

        dados.forEach((item, i) => {
            selectOriginal.options[i].selected = item.selected;
            if (item.selected) {
                selecionados.push({ label: item.label, value: item.value });
            }
        });

        if (dispararCallback && typeof config.onChange === 'function') {
            config.onChange(selecionados);
        }
    }

    // ── Utilitário: remove acentos de uma string ──────────────────────────────
    function _removerAcentos(texto) {
        return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
}
