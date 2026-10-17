const STORAGE_ADVENTURES_KEY = 'verge_ai_adventures';
const STORAGE_ACTIVE_ID_KEY = 'verge_ai_active_id';

// Gerenciador de armazenamento das múltiplas aventuras
const AdventureStorage = {
  getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_ADVENTURES_KEY);
      if (raw) return JSON.parse(raw);

      // Migração suave caso o jogador tenha um save do modelo antigo
      const legacy = localStorage.getItem('verge_ai_active_adventure');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        const migrated = [{
          id: 'adv_' + Date.now(),
          title: parsed.setup?.theme ? parsed.setup.theme.slice(0, 28) : 'Aventura Anterior',
          setup: parsed.setup,
          history: parsed.history || [],
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

  create(title, setup, openingText) {
    const list = this.getAll();
    const newAdventure = {
      id: 'adv_' + Date.now(),
      title: title || setup.theme.slice(0, 28),
      setup,
      history: [
        { role: 'model', text: openingText }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    list.unshift(newAdventure);
    this.saveAll(list);
    this.setActiveId(newAdventure.id);
    return newAdventure;
  },

  updateHistory(id, newHistory) {
    const list = this.getAll();
    const index = list.findIndex(a => a.id === id);
    if (index !== -1) {
      list[index].history = newHistory;
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
  isLoading: false
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
  themeInput: document.getElementById('theme-input'),
  charInput: document.getElementById('char-input'),
  rulesInput: document.getElementById('rules-input'),
  btnStart: document.getElementById('btn-start'),

  activeTitleLabel: document.getElementById('active-title-label'),
  activeCharLabel: document.getElementById('active-char-label'),
  activeThemeLabel: document.getElementById('active-theme-label'),
  btnExport: document.getElementById('btn-export'),
  btnDeleteAdventure: document.getElementById('btn-delete-adventure'),
  chatBox: document.getElementById('chat-box'),
  loading: document.getElementById('loading-indicator'),
  actionForm: document.getElementById('action-form'),
  actionInput: document.getElementById('action-input'),
  btnSend: document.getElementById('btn-send')
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
  if (dom.btnStart) dom.btnStart.disabled = loading;
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

  dom.themeInput.value = '';
  dom.charInput.value = '';
  dom.themeInput.focus();

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

  dom.actionInput.focus();
  renderSidebar();
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
  doc += `> **Exportado em:** ${new Date().toLocaleString('pt-BR')}\n\n`;
  doc += `---\n\n`;

  let turnCounter = 1;
  adv.history.forEach((turn) => {
    if (turn.role === 'model') {
      doc += `### 🌌 Narrador (Turno ${turnCounter})\n\n${turn.text.trim()}\n\n`;
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

dom.setupForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const theme = dom.themeInput.value.trim();
  const character = dom.charInput.value.trim();
  const rules = dom.rulesInput.value.trim();

  if (!theme || !character) return;

  const setup = { theme, character, rules };
  setLoading(true);

  try {
    const res = await fetch('/api/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setup })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao inicializar o mundo.');

    const newAdventure = AdventureStorage.create(data.title, setup, data.opening);
    selectAdventure(newAdventure.id);

  } catch (err) {
    alert(`Erro ao iniciar mundo: ${err.message}`);
  } finally {
    setLoading(false);
  }
});

dom.actionForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const action = dom.actionInput.value.trim();
  if (!action || state.isLoading || !state.activeAdventure) return;

  appendMessage('player', action);
  dom.actionInput.value = '';

  state.activeAdventure.history.push({ role: 'user', text: action });
  AdventureStorage.updateHistory(state.activeAdventure.id, state.activeAdventure.history);

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
    AdventureStorage.updateHistory(state.activeAdventure.id, state.activeAdventure.history);
    renderSidebar();

  } catch (err) {
    appendMessage('dm', `[Falha de conexão com o Mestre: ${err.message}]`);
  } finally {
    setLoading(false);
    dom.actionInput.focus();
  }
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
