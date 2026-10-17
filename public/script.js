const STORAGE_ADVENTURES_KEY = 'verge_ai_adventures';
const STORAGE_ACTIVE_ID_KEY = 'verge_ai_active_id';

// Presets de Cenários, Personagens Contextuais e Regras
const SCENARIO_PRESETS = [
  {
    id: 'medieval-fantasy',
    icon: '⚔️',
    title: 'Fantasia Medieval',
    summary: 'The Witcher / D&D: Tavernas, reinos em conflito, monstros e magia.',
    theme: 'Um reino medieval assolado por tensões entre barões rivais, monstros espreitando nas florestas e ruínas antigas repletas de segredos arcanos.',
    characters: [
      { name: 'Caçador de Monstros Errante', desc: 'Espadachim veterano com reflexos treinados, poções alquímicas e cicatrizes de bestas antigas.' },
      { name: 'Mago Acadêmico Renegado', desc: 'Estudioso de magias arcanas banidas, expulso da academia real em busca de relíquias proibidas.' },
      { name: 'Ladina dos Subterrâneos', desc: 'Especialista em invasão furtiva e venenos, com contatos na influente guilda de ladrões.' }
    ],
    defaultRule: 'Aventura épica balanceada, magia misteriosa, combate tático e consequências de honra.'
  },
  {
    id: 'zombie-apocalypse',
    icon: '🧟',
    title: 'Apocalipse Zumbi',
    summary: 'The Last of Us / Walking Dead: Cidades em ruínas, infectados e sobrevivência.',
    theme: 'Uma metrópole em ruínas dominada pela vegetação e hordas de infectados letais anos após o colapso, onde comida, abrigo e munição valem mais que ouro.',
    characters: [
      { name: 'Sobrevivente Calejado', desc: 'Veterano pragmático com instinto de sobrevivência apurado, poucas balas e mestre em armadilhas.' },
      { name: 'Médica de Posto Avançado', desc: 'Ex-cirurgiã que domina primeiros socorros e botânica para produzir remédios em meio ao caos.' },
      { name: 'Batedor de Zona Proibida', desc: 'Jovem ágil que domina parkour em telhados e conhece rotas secretas infestadas por infectados.' }
    ],
    defaultRule: 'Sobrevivência crua, escassez severa de munição, furtividade obrigatória e tensão psicológica.'
  },
  {
    id: 'cyberpunk',
    icon: '🦾',
    title: 'Cyberpunk & Submundo',
    summary: 'Cyberpunk 2077: Megacorporações, neon, implantes ilegais e hackers.',
    theme: 'Uma megalópole futurista chuvosa iluminada por neon, onde megacorporações bilionárias ditam as leis e mercenários com implantes cibernéticos disputam as ruas.',
    characters: [
      { name: 'Mercenário Cibernético', desc: 'Combatente com braço biônico reforçado e reflexos neurais acelerados aceitando trabalhos sujos.' },
      { name: 'Netrunner Especialista', desc: 'Hacker de elite com interface neural direta capaz de desativar câmeras, torres e implantes inimigos.' },
      { name: 'Médico Clandestino de Beco', desc: 'Cirurgião que instala próteses no mercado negro e deve favores perigosos a sindicatos do crime.' }
    ],
    defaultRule: 'Alta tecnologia, moralidade cinzenta, vigilância corporativa e ação frenética.'
  }
];

const RULE_PRESETS = [
  {
    id: 'balanced',
    title: '⚖️ Causa & Efeito Equilibrado',
    text: 'Narrativo dinâmico, consequências realistas e causa e efeito estrito às ações do protagonista.'
  },
  {
    id: 'hardcore',
    title: '💀 Sobrevivência Brutal & Escassez',
    text: 'Realismo implacável, recursos extremamente escassos, ferimentos pesados e risco constante de morte.'
  },
  {
    id: 'cinematic',
    title: '🎬 Ação Cinematográfica & Mistério',
    text: 'Ritmo acelerado, revelações dramáticas, pistas instigantes e reviravoltas cinematográficas.'
  }
];

// Gerenciador de armazenamento das múltiplas aventuras
const AdventureStorage = {
  getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_ADVENTURES_KEY);
      if (raw) return JSON.parse(raw);

      // Migração suave de formatos antigos
      const legacy = localStorage.getItem('verge_ai_active_adventure');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        const migrated = [{
          id: 'adv_' + Date.now(),
          title: parsed.setup?.theme ? parsed.setup.theme.slice(0, 28) : 'Aventura Anterior',
          setup: parsed.setup,
          history: parsed.history || [],
          lastOptions: [],
          status: { condition: 'Ileso', inventory: [] },
          updatedAt: parsed.updatedAt || new Date().toISOString()
        }];
        localStorage.setItem(STORAGE_ADVENTURES_KEY, JSON.stringify(migrated));
        localStorage.removeItem('verge_ai_active_adventure');
        return migrated;
      }

      return [];
    } catch (e) {
      console.warn('Erro ao ler aventuras do localStorage:', e);
      return [];
    }
  },

  saveAll(list) {
    try {
      localStorage.setItem(STORAGE_ADVENTURES_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Erro ao salvar aventuras no localStorage:', e);
    }
  },

  getActiveId() {
    return localStorage.getItem(STORAGE_ACTIVE_ID_KEY) || null;
  },

  setActiveId(id) {
    if (id) {
      localStorage.setItem(STORAGE_ACTIVE_ID_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_ACTIVE_ID_KEY);
    }
  },

  getById(id) {
    const list = this.getAll();
    return list.find(a => a.id === id) || null;
  },

  create(title, setup, openingText, options = [], status = null) {
    const list = this.getAll();
    const newAdventure = {
      id: 'adv_' + Date.now(),
      title: title || setup.theme.slice(0, 28),
      setup,
      history: [
        { role: 'model', text: openingText }
      ],
      lastOptions: options || [],
      status: status || { condition: 'Ileso', inventory: [] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    list.unshift(newAdventure);
    this.saveAll(list);
    this.setActiveId(newAdventure.id);
    return newAdventure;
  },

  updateHistory(id, newHistory, options = null, status = null) {
    const list = this.getAll();
    const index = list.findIndex(a => a.id === id);
    if (index !== -1) {
      list[index].history = newHistory;
      if (options !== null) {
        list[index].lastOptions = options;
      }
      if (status !== null) {
        list[index].status = status;
      }
      list[index].updatedAt = new Date().toISOString();
      this.saveAll(list);
    }
  },

  delete(id) {
    let list = this.getAll();
    list = list.filter(a => a.id !== id);
    this.saveAll(list);
    if (this.getActiveId() === id) {
      this.setActiveId(list.length > 0 ? list[0].id : null);
    }
    return list;
  }
};

const state = {
  activeAdventure: null,
  isLoading: false,
  selectedScenarioId: null,
  scenarios: [...SCENARIO_PRESETS]
};

const dom = {
  sidebar: document.getElementById('sidebar'),
  sidebarOverlay: document.getElementById('sidebar-overlay'),
  btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
  btnCloseSidebar: document.getElementById('btn-close-sidebar'),
  btnNewAdventure: document.getElementById('btn-new-adventure'),
  adventuresList: document.getElementById('adventures-list'),
  apiStatus: document.getElementById('api-status'),

  setupPanel: document.getElementById('setup-panel'),
  gamePanel: document.getElementById('game-panel'),
  setupForm: document.getElementById('setup-form'),
  btnRefreshPresets: document.getElementById('btn-refresh-presets'),
  scenarioPresetsGrid: document.getElementById('scenario-presets-grid'),
  charPresetsWrapper: document.getElementById('char-presets-wrapper'),
  charPresetsList: document.getElementById('char-presets-list'),
  rulePresetsList: document.getElementById('rule-presets-list'),
  toggleDiceRule: document.getElementById('toggle-dice-rule'),

  themeInput: document.getElementById('theme-input'),
  charInput: document.getElementById('char-input'),
  rulesInput: document.getElementById('rules-input'),
  btnStart: document.getElementById('btn-start'),

  activeTitleLabel: document.getElementById('active-title-label'),
  activeCharLabel: document.getElementById('active-char-label'),
  activeThemeLabel: document.getElementById('active-theme-label'),
  btnExport: document.getElementById('btn-export'),
  btnDeleteAdventure: document.getElementById('btn-delete-adventure'),

  charConditionBadge: document.getElementById('char-condition-badge'),
  charInventoryList: document.getElementById('char-inventory-list'),

  chatBox: document.getElementById('chat-box'),
  loading: document.getElementById('loading-indicator'),
  actionSuggestions: document.getElementById('action-suggestions'),
  suggestionsContainer: document.getElementById('suggestions-container'),
  actionForm: document.getElementById('action-form'),
  actionInput: document.getElementById('action-input'),
  btnSend: document.getElementById('btn-send'),
  btnRollDice: document.getElementById('btn-roll-dice')
};

async function checkApiStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.aiConfigured) {
      dom.apiStatus.textContent = 'IA Ativa (Gemini)';
      dom.apiStatus.classList.add('online');
    } else {
      dom.apiStatus.textContent = 'Modo Demo (Falta .env)';
    }
  } catch {
    dom.apiStatus.textContent = 'Servidor Desconectado';
  }
}

function escapeHTML(str) {
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}

function renderMarkdown(text) {
  if (window.marked && typeof window.marked.parse === 'function') {
    return window.marked.parse(text, { breaks: true, gfm: true });
  }

  // Fallback seguro caso CDN do marked não esteja disponível
  let html = escapeHTML(text);
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  return html.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

function appendMessage(role, text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;

  if (role === 'player') {
    msgDiv.innerHTML = `
      <div class="author">Você</div>
      <div>${escapeHTML(text)}</div>
    `;
  } else if (role === 'system') {
    msgDiv.innerHTML = `
      <div class="dice-result-badge">${renderMarkdown(text)}</div>
    `;
  } else {
    msgDiv.innerHTML = renderMarkdown(text);
  }

  dom.chatBox.appendChild(msgDiv);
  dom.chatBox.scrollTop = dom.chatBox.scrollHeight;
}

function setLoading(loading) {
  state.isLoading = loading;
  dom.loading.classList.toggle('hidden', !loading);
  dom.btnSend.disabled = loading;
  dom.actionInput.disabled = loading;
  if (dom.btnRollDice) dom.btnRollDice.disabled = loading;
  if (dom.btnStart) dom.btnStart.disabled = loading;

  // Desabilitar chips enquanto carrega
  if (dom.suggestionsContainer) {
    const chips = dom.suggestionsContainer.querySelectorAll('.suggestion-chip');
    chips.forEach(chip => chip.disabled = loading);
  }
}

function renderCharacterSheet(status) {
  if (!dom.charConditionBadge || !dom.charInventoryList) return;

  const safeStatus = status || { condition: 'Ileso', inventory: [] };
  const condition = safeStatus.condition || 'Ileso';
  const inventory = Array.isArray(safeStatus.inventory) ? safeStatus.inventory : [];

  // Atualiza Badge de Condição com cor dinâmica
  dom.charConditionBadge.textContent = condition;
  dom.charConditionBadge.className = 'condition-badge';

  const lower = condition.toLowerCase();
  if (lower.includes('crític') || lower.includes('morrend') || lower.includes('inconsciente') || lower.includes('grave') || lower.includes('sangrand')) {
    dom.charConditionBadge.classList.add('condition-danger');
  } else if (lower.includes('ferid') || lower.includes('exaust') || lower.includes('cansad') || lower.includes('abalad') || lower.includes('alert') || lower.includes('adrenalisad') || lower.includes('tont')) {
    dom.charConditionBadge.classList.add('condition-warning');
  } else {
    dom.charConditionBadge.classList.add('condition-healthy');
  }

  // Atualiza Tags de Inventário
  if (inventory.length === 0) {
    dom.charInventoryList.innerHTML = '<span class="inventory-empty">Nenhum item relevante</span>';
  } else {
    dom.charInventoryList.innerHTML = inventory.map(item => `
      <span class="inventory-tag">📦 ${escapeHTML(item)}</span>
    `).join('');
  }
}

function renderSuggestions(options) {
  if (!dom.actionSuggestions || !dom.suggestionsContainer) return;

  if (!options || !Array.isArray(options) || options.length === 0) {
    dom.actionSuggestions.classList.add('hidden');
    dom.suggestionsContainer.innerHTML = '';
    return;
  }

  dom.suggestionsContainer.innerHTML = '';
  options.forEach(opt => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'suggestion-chip';
    chip.title = 'Clique para preencher a caixa de ação e editar';
    chip.textContent = opt;

    chip.addEventListener('click', () => {
      if (state.isLoading) return;
      dom.actionInput.value = opt;
      dom.actionInput.focus();
      const len = dom.actionInput.value.length;
      dom.actionInput.setSelectionRange(len, len);
    });

    dom.suggestionsContainer.appendChild(chip);
  });

  dom.actionSuggestions.classList.remove('hidden');
}

// =========================================================
// PRESETS INTERATIVOS (CENÁRIOS, PERSONAGENS & REGRAS)
// =========================================================
function renderScenarioPresets() {
  if (!dom.scenarioPresetsGrid) return;
  dom.scenarioPresetsGrid.innerHTML = '';

  const list = state.scenarios && state.scenarios.length > 0 ? state.scenarios : SCENARIO_PRESETS;

  list.forEach(scenario => {
    const card = document.createElement('div');
    card.className = `scenario-card ${state.selectedScenarioId === scenario.id ? 'active' : ''}`;
    card.innerHTML = `
      <div class="scenario-card-header">
        <span class="scenario-card-icon">${scenario.icon || '🌌'}</span>
        <span class="scenario-card-title">${escapeHTML(scenario.title)}</span>
      </div>
      <p class="scenario-card-desc">${escapeHTML(scenario.summary)}</p>
    `;

    card.addEventListener('click', () => {
      selectScenarioPreset(scenario);
    });

    dom.scenarioPresetsGrid.appendChild(card);
  });
}

function selectScenarioPreset(scenario) {
  state.selectedScenarioId = scenario.id;

  const list = state.scenarios && state.scenarios.length > 0 ? state.scenarios : SCENARIO_PRESETS;

  // Atualiza cards ativos
  const cards = dom.scenarioPresetsGrid.querySelectorAll('.scenario-card');
  cards.forEach((c, idx) => {
    if (list[idx]) {
      c.classList.toggle('active', list[idx].id === scenario.id);
    }
  });

  // Preenche tema
  dom.themeInput.value = scenario.theme;

  // Abre e renderiza personagens contextuais deste cenário
  renderCharacterPresets(scenario.characters);

  // Seleciona a primeira opção de personagem por padrão para conveniência
  if (scenario.characters && scenario.characters.length > 0) {
    selectCharacterPreset(scenario.characters[0], 0);
  }

  // Atualiza regra
  updateRulesInputValue(scenario.defaultRule);
}

async function fetchNewAiPresets() {
  if (!dom.btnRefreshPresets) return;

  dom.btnRefreshPresets.disabled = true;
  const originalHtml = dom.btnRefreshPresets.innerHTML;
  dom.btnRefreshPresets.innerHTML = '<span>⏳</span> Verge está criando...';

  // Feedback visual no grid
  dom.scenarioPresetsGrid.innerHTML = `
    <div style="grid-column: 1 / -1; padding: 2.5rem 1rem; text-align: center; color: var(--accent); font-style: italic;">
      ✨ Verge está tecendo 3 novos mundos consagrados da cultura pop...
    </div>
  `;

  try {
    const res = await fetch('/api/generate-presets');
    const data = await res.json();

    if (!res.ok || !data.presets || !Array.isArray(data.presets) || data.presets.length === 0) {
      throw new Error(data.error || 'Falha ao gerar presets.');
    }

    state.scenarios = data.presets.slice(0, 3);
    renderScenarioPresets();

    if (state.scenarios.length > 0) {
      selectScenarioPreset(state.scenarios[0]);
    }
  } catch (err) {
    console.warn('Erro ao gerar com IA:', err);
    alert('Não foi possível gerar novos mundos no momento. Restaurando cenários anteriores.');
    renderScenarioPresets();
  } finally {
    dom.btnRefreshPresets.disabled = false;
    dom.btnRefreshPresets.innerHTML = originalHtml;
  }
}

function renderCharacterPresets(characters) {
  if (!dom.charPresetsWrapper || !dom.charPresetsList) return;

  if (!characters || characters.length === 0) {
    dom.charPresetsWrapper.classList.add('hidden');
    dom.charPresetsList.innerHTML = '';
    return;
  }

  dom.charPresetsWrapper.classList.remove('hidden');
  dom.charPresetsList.innerHTML = '';

  characters.forEach((char, idx) => {
    const card = document.createElement('div');
    card.className = `character-card ${idx === 0 ? 'active' : ''}`;
    card.innerHTML = `
      <div class="character-card-name">👤 ${escapeHTML(char.name)}</div>
      <p class="character-card-desc">${escapeHTML(char.desc)}</p>
    `;

    card.addEventListener('click', () => {
      selectCharacterPreset(char, idx);
    });

    dom.charPresetsList.appendChild(card);
  });
}

function selectCharacterPreset(char, index) {
  dom.charInput.value = `${char.name} (${char.desc})`;

  // Destaca card selecionado
  const cards = dom.charPresetsList.querySelectorAll('.character-card');
  cards.forEach((c, idx) => {
    c.classList.toggle('active', idx === index);
  });
}

function renderRulePresets() {
  if (!dom.rulePresetsList) return;
  dom.rulePresetsList.innerHTML = '';

  RULE_PRESETS.forEach((rule, idx) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `rule-chip ${idx === 0 ? 'active' : ''}`;
    chip.textContent = rule.title;

    chip.addEventListener('click', () => {
      const chips = dom.rulePresetsList.querySelectorAll('.rule-chip');
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      updateRulesInputValue(rule.text);
    });

    dom.rulePresetsList.appendChild(chip);
  });
}

function updateRulesInputValue(baseRuleText) {
  let ruleText = baseRuleText || dom.rulesInput.value || 'Narrativo dinâmico';

  // Remove sufixo de dados se já tiver para evitar duplicação
  ruleText = ruleText.replace(/\s*com testes de dados d20 em ações arriscadas\.?/gi, '').trim();

  if (dom.toggleDiceRule && dom.toggleDiceRule.checked) {
    ruleText += ' com testes de dados d20 em ações arriscadas';
  }

  dom.rulesInput.value = ruleText;
}

// =========================================================
// SISTEMA DINÂMICO DE CONFIRMAÇÃO & ROLAGEM DE DADO D20
// =========================================================
function renderDiceChallenge(actionText, riskDescription) {
  removeDiceChallenge();

  const card = document.createElement('div');
  card.id = 'dice-challenge-banner';
  card.className = 'dice-challenge-banner';
  card.innerHTML = `
    <div class="dice-challenge-header">
      <span class="dice-icon-spin">🎲</span>
      <span class="dice-challenge-title">Verge Exige Teste de Risco (d20)</span>
    </div>
    <p class="dice-challenge-risk">
      <strong>Risco em jogo:</strong> ${escapeHTML(riskDescription)}
    </p>
    <div class="dice-challenge-actions">
      <button type="button" class="btn-dice-confirm" id="btn-confirm-dice">
        <span>🎲</span> Confirmar e Rolar Dado
      </button>
      <button type="button" class="btn-dice-cancel" id="btn-cancel-dice">
        ↩️ Escolher outra ação
      </button>
    </div>
  `;

  dom.chatBox.appendChild(card);
  dom.chatBox.scrollTop = dom.chatBox.scrollHeight;

  const btnConfirm = card.querySelector('#btn-confirm-dice');
  const btnCancel = card.querySelector('#btn-cancel-dice');

  btnConfirm.addEventListener('click', () => {
    btnConfirm.disabled = true;
    btnCancel.disabled = true;

    // Efeito visual de rolagem
    const diceFaces = ['🎲 4', '🎲 19', '🎲 2', '🎲 15', '🎲 20', '🎲 8', '🎲 12'];
    let idx = 0;
    const ticker = setInterval(() => {
      btnConfirm.innerHTML = `<span>🎲</span> Verge rolando... ${diceFaces[idx % diceFaces.length]}`;
      idx++;
    }, 85);

    setTimeout(async () => {
      clearInterval(ticker);

      const roll = Math.floor(Math.random() * 20) + 1;
      let outcome = '';
      if (roll === 20) outcome = 'Sucesso Crítico Épico!';
      else if (roll >= 10) outcome = 'Sucesso!';
      else if (roll >= 2) outcome = 'Complicação / Risco!';
      else outcome = 'Falha Crítica Desastrosa!';

      removeDiceChallenge();

      // Fala o resultado do dado rolado por Verge
      appendMessage('system', `🎲 Verge rolou o d20: **${roll}** (${outcome})`);

      // Dá andamento na narrativa com o desfecho da ação
      const resolutionMessage = `[🎲 Verge rolou d20: ${roll} (${outcome})] ${actionText}`;
      await submitResolvedAction(resolutionMessage);
    }, 700);
  });

  btnCancel.addEventListener('click', () => {
    removeDiceChallenge();

    // Reverte a tentativa e o alerta para manter o histórico da crônica limpo
    if (state.activeAdventure && state.activeAdventure.history.length >= 2) {
      state.activeAdventure.history.splice(-2, 2);
      AdventureStorage.updateHistory(
        state.activeAdventure.id,
        state.activeAdventure.history,
        state.activeAdventure.lastOptions || []
      );
    }

    appendMessage('system', '↩️ *Você reconsiderou e decidiu não correr esse risco. Escolha outra abordagem:*');

    // Restaura as opções anteriores e preenche o input com a ação para o jogador editar
    renderSuggestions(state.activeAdventure.lastOptions || []);
    dom.actionInput.value = actionText;
    dom.actionInput.focus();
    dom.actionInput.select();
  });
}

function removeDiceChallenge() {
  const existing = document.getElementById('dice-challenge-banner');
  if (existing) existing.remove();
}

async function submitResolvedAction(resolutionMessage) {
  if (state.isLoading || !state.activeAdventure) return;

  setLoading(true);
  if (dom.actionSuggestions) dom.actionSuggestions.classList.add('hidden');

  state.activeAdventure.history.push({ role: 'user', text: resolutionMessage });
  AdventureStorage.updateHistory(state.activeAdventure.id, state.activeAdventure.history);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setup: state.activeAdventure.setup,
        message: resolutionMessage,
        history: state.activeAdventure.history
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao processar turno.');

    appendMessage('dm', data.reply);
    state.activeAdventure.history.push({ role: 'model', text: data.reply });
    state.activeAdventure.lastOptions = data.options || [];

    if (data.status) {
      state.activeAdventure.status = data.status;
      renderCharacterSheet(data.status);
    }

    AdventureStorage.updateHistory(
      state.activeAdventure.id,
      state.activeAdventure.history,
      data.options || [],
      data.status || null
    );

    renderSuggestions(data.options || []);
    renderSidebar();

  } catch (err) {
    appendMessage('dm', `[Falha de conexão com Verge: ${err.message}]`);
  } finally {
    setLoading(false);
    dom.actionInput.focus();
  }
}

function closeMobileSidebar() {
  if (dom.sidebar) dom.sidebar.classList.remove('open');
  if (dom.sidebarOverlay) dom.sidebarOverlay.classList.add('hidden');
}

function openMobileSidebar() {
  if (dom.sidebar) dom.sidebar.classList.add('open');
  if (dom.sidebarOverlay) dom.sidebarOverlay.classList.remove('hidden');
}

function renderSidebar() {
  const list = AdventureStorage.getAll();
  const activeId = AdventureStorage.getActiveId();

  dom.adventuresList.innerHTML = '';

  if (list.length === 0) {
    dom.adventuresList.innerHTML = `
      <div class="adventures-empty">
        Nenhuma aventura iniciada.<br>Crie sua primeira acima!
      </div>
    `;
    return;
  }

  list.forEach(adv => {
    const item = document.createElement('div');
    item.className = `adventure-item ${adv.id === activeId ? 'active' : ''}`;

    const turnsCount = adv.history ? Math.floor(adv.history.length / 2) : 0;
    const dateFormatted = new Date(adv.updatedAt).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short'
    });

    item.innerHTML = `
      <div class="adventure-item-text">
        <span class="adventure-item-title">${escapeHTML(adv.title || 'Aventura')}</span>
        <span class="adventure-item-meta">${escapeHTML(adv.setup?.character || 'Personagem')} • ${turnsCount} turnos • ${dateFormatted}</span>
      </div>
      <button type="button" class="adventure-item-delete" title="Excluir aventura">🗑️</button>
    `;

    // Clicar para abrir a aventura
    item.addEventListener('click', (e) => {
      if (e.target.closest('.adventure-item-delete')) return;
      selectAdventure(adv.id);
      closeMobileSidebar();
    });

    // Clicar para deletar a aventura
    const btnDel = item.querySelector('.adventure-item-delete');
    btnDel.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Deseja excluir permanentemente a aventura "${adv.title}"?`)) {
        AdventureStorage.delete(adv.id);
        const remaining = AdventureStorage.getAll();
        if (state.activeAdventure && state.activeAdventure.id === adv.id) {
          if (remaining.length > 0) {
            selectAdventure(remaining[0].id);
          } else {
            showSetupPanel();
          }
        }
        renderSidebar();
      }
    });

    dom.adventuresList.appendChild(item);
  });
}

function showSetupPanel() {
  AdventureStorage.setActiveId(null);
  state.activeAdventure = null;

  dom.setupPanel.classList.remove('hidden');
  dom.gamePanel.classList.add('hidden');
  if (dom.actionSuggestions) dom.actionSuggestions.classList.add('hidden');

  // Seleciona o primeiro preset por padrão
  if (SCENARIO_PRESETS.length > 0) {
    selectScenarioPreset(SCENARIO_PRESETS[0]);
  }

  renderSidebar();
}

function selectAdventure(id) {
  const adv = AdventureStorage.getById(id);
  if (!adv) {
    showSetupPanel();
    return;
  }

  AdventureStorage.setActiveId(id);
  state.activeAdventure = adv;

  dom.setupPanel.classList.add('hidden');
  dom.gamePanel.classList.remove('hidden');

  dom.activeTitleLabel.textContent = adv.title || 'Aventura Sem Título';
  dom.activeCharLabel.textContent = `Protagonista: ${adv.setup?.character || 'Herói'}`;
  dom.activeThemeLabel.textContent = `• ${adv.setup?.theme || ''}`;

  dom.chatBox.innerHTML = '';
  adv.history.forEach(turn => {
    appendMessage(turn.role === 'user' ? 'player' : 'dm', turn.text);
  });

  renderCharacterSheet(adv.status || { condition: 'Ileso', inventory: [] });
  renderSuggestions(adv.lastOptions || []);

  dom.actionInput.focus();
  renderSidebar();
}

async function submitAction(actionText) {
  const action = (actionText || '').trim();
  if (!action || state.isLoading || !state.activeAdventure) return;

  removeDiceChallenge();

  appendMessage('player', action);
  dom.actionInput.value = '';

  state.activeAdventure.history.push({ role: 'user', text: action });
  AdventureStorage.updateHistory(state.activeAdventure.id, state.activeAdventure.history);

  // Esconder sugestões anteriores enquanto carrega a nova rodada
  if (dom.actionSuggestions) dom.actionSuggestions.classList.add('hidden');
  setLoading(true);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setup: state.activeAdventure.setup,
        message: action,
        history: state.activeAdventure.history
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao processar turno.');

    appendMessage('dm', data.reply);
    state.activeAdventure.history.push({ role: 'model', text: data.reply });

    // Se Verge exigiu confirmação de teste de dado
    if (data.diceRequirement && data.diceRequirement.required) {
      AdventureStorage.updateHistory(
        state.activeAdventure.id,
        state.activeAdventure.history,
        state.activeAdventure.lastOptions || []
      );
      renderDiceChallenge(action, data.diceRequirement.risk);
      renderSidebar();
      return;
    }

    state.activeAdventure.lastOptions = data.options || [];

    if (data.status) {
      state.activeAdventure.status = data.status;
      renderCharacterSheet(data.status);
    }

    AdventureStorage.updateHistory(
      state.activeAdventure.id,
      state.activeAdventure.history,
      data.options || [],
      data.status || null
    );

    renderSuggestions(data.options || []);
    renderSidebar();

  } catch (err) {
    appendMessage('dm', `[Falha de conexão com Verge: ${err.message}]`);
  } finally {
    setLoading(false);
    dom.actionInput.focus();
  }
}

function exportCurrentChronicle() {
  const adv = state.activeAdventure;
  if (!adv || !adv.history || adv.history.length === 0) {
    alert('Nenhuma aventura selecionada para exportar.');
    return;
  }

  let doc = `# Crônica de Verge: ${adv.title}\n\n`;
  doc += `> **Cenário:** ${adv.setup.theme}\n`;
  doc += `> **Protagonista:** ${adv.setup.character}\n`;
  doc += `> **Estilo & Regras:** ${adv.setup.rules}\n`;
  doc += `> **Condição Final:** ${adv.status?.condition || 'Ileso'}\n`;
  doc += `> **Inventário:** ${adv.status?.inventory?.length ? adv.status.inventory.join(', ') : 'Nenhum item relevante'}\n`;
  doc += `> **Exportado em:** ${new Date().toLocaleString('pt-BR')}\n\n`;
  doc += `---\n\n`;

  let turnCounter = 1;
  adv.history.forEach((turn) => {
    if (turn.role === 'model') {
      doc += `### 🌌 Verge (Turno ${turnCounter})\n\n${turn.text.trim()}\n\n`;
      turnCounter++;
    } else {
      doc += `### 🗡️ Você\n\n> *${turn.text.trim()}*\n\n`;
    }
  });

  const blob = new Blob([doc], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeTitle = adv.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  a.href = url;
  a.download = `verge-${safeTitle}-${Date.now()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Event Listeners
dom.btnNewAdventure.addEventListener('click', () => {
  showSetupPanel();
  closeMobileSidebar();
});

if (dom.btnToggleSidebar) {
  dom.btnToggleSidebar.addEventListener('click', openMobileSidebar);
}

if (dom.btnCloseSidebar) {
  dom.btnCloseSidebar.addEventListener('click', closeMobileSidebar);
}

if (dom.sidebarOverlay) {
  dom.sidebarOverlay.addEventListener('click', closeMobileSidebar);
}

if (dom.toggleDiceRule) {
  dom.toggleDiceRule.addEventListener('change', () => {
    updateRulesInputValue();
  });
}

if (dom.btnRefreshPresets) {
  dom.btnRefreshPresets.addEventListener('click', fetchNewAiPresets);
}

dom.setupForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const theme = dom.themeInput.value.trim();
  const character = dom.charInput.value.trim();
  const rules = dom.rulesInput.value.trim();
  const useDice = Boolean(dom.toggleDiceRule ? dom.toggleDiceRule.checked : true);

  if (!theme || !character) return;

  const setup = { theme, character, rules, useDice };
  setLoading(true);

  try {
    const res = await fetch('/api/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setup })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao inicializar o mundo.');

    const newAdventure = AdventureStorage.create(
      data.title,
      setup,
      data.opening,
      data.options || [],
      data.status || { condition: 'Ileso', inventory: [] }
    );
    selectAdventure(newAdventure.id);

  } catch (err) {
    alert(`Erro ao iniciar mundo: ${err.message}`);
  } finally {
    setLoading(false);
  }
});

dom.actionForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submitAction(dom.actionInput.value);
});

if (dom.btnExport) {
  dom.btnExport.addEventListener('click', exportCurrentChronicle);
}

if (dom.btnDeleteAdventure) {
  dom.btnDeleteAdventure.addEventListener('click', () => {
    if (!state.activeAdventure) return;
    if (confirm(`Deseja excluir permanentemente esta aventura ("${state.activeAdventure.title}")?`)) {
      const deletedId = state.activeAdventure.id;
      const remaining = AdventureStorage.delete(deletedId);
      if (remaining.length > 0) {
        selectAdventure(remaining[0].id);
      } else {
        showSetupPanel();
      }
      renderSidebar();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  checkApiStatus();
  renderSidebar();
  renderScenarioPresets();
  renderRulePresets();

  const activeId = AdventureStorage.getActiveId();
  if (activeId && AdventureStorage.getById(activeId)) {
    selectAdventure(activeId);
  } else {
    const all = AdventureStorage.getAll();
    if (all.length > 0) {
      selectAdventure(all[0].id);
    } else {
      showSetupPanel();
    }
  }
});
