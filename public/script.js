const state = {
  setup: null,
  history: [],
  isLoading: false
};

const dom = {
  apiStatus: document.getElementById('api-status'),
  setupPanel: document.getElementById('setup-panel'),
  gamePanel: document.getElementById('game-panel'),
  setupForm: document.getElementById('setup-form'),
  themeInput: document.getElementById('theme-input'),
  charInput: document.getElementById('char-input'),
  rulesInput: document.getElementById('rules-input'),
  btnStart: document.getElementById('btn-start'),
  activeThemeLabel: document.getElementById('active-theme-label'),
  activeCharLabel: document.getElementById('active-char-label'),
  chatBox: document.getElementById('chat-box'),
  loading: document.getElementById('loading-indicator'),
  actionForm: document.getElementById('action-form'),
  actionInput: document.getElementById('action-input'),
  btnSend: document.getElementById('btn-send'),
  btnReset: document.getElementById('btn-reset')
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

function appendMessage(role, text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;

  if (role === 'player') {
    msgDiv.innerHTML = `
      <div class="author">Você</div>
      <div>${escapeHTML(text)}</div>
    `;
  } else {
    const paragraphs = text.split('\n').filter(p => p.trim() !== '');
    msgDiv.innerHTML = paragraphs.map(p => `<p>${escapeHTML(p)}</p>`).join('');
  }

  dom.chatBox.appendChild(msgDiv);
  dom.chatBox.scrollTop = dom.chatBox.scrollHeight;
}

function escapeHTML(str) {
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}

function setLoading(loading) {
  state.isLoading = loading;
  dom.loading.classList.toggle('hidden', !loading);
  dom.btnSend.disabled = loading;
  dom.actionInput.disabled = loading;
  if (dom.btnStart) dom.btnStart.disabled = loading;
}

dom.setupForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const theme = dom.themeInput.value.trim();
  const character = dom.charInput.value.trim();
  const rules = dom.rulesInput.value.trim();

  if (!theme || !character) return;

  state.setup = { theme, character, rules };
  state.history = [];
  dom.chatBox.innerHTML = '';

  setLoading(true);

  try {
    const res = await fetch('/api/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setup: state.setup })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao inicializar o mundo.');

    dom.setupPanel.classList.add('hidden');
    dom.gamePanel.classList.remove('hidden');

    dom.activeThemeLabel.textContent = `Cenário: ${theme}`;
    dom.activeCharLabel.textContent = `| Protagonista: ${character}`;

    appendMessage('dm', data.opening);
    state.history.push({ role: 'model', text: data.opening });

    dom.actionInput.focus();
  } catch (err) {
    alert(`Erro ao iniciar mundo: ${err.message}`);
  } finally {
    setLoading(false);
  }
});

dom.actionForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const action = dom.actionInput.value.trim();
  if (!action || state.isLoading) return;

  appendMessage('player', action);
  dom.actionInput.value = '';

  state.history.push({ role: 'user', text: action });
  setLoading(true);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setup: state.setup,
        message: action,
        history: state.history
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao processar turno.');

    appendMessage('dm', data.reply);
    state.history.push({ role: 'model', text: data.reply });

  } catch (err) {
    appendMessage('dm', `[Falha de conexão com o Mestre: ${err.message}]`);
  } finally {
    setLoading(false);
    dom.actionInput.focus();
  }
});

dom.btnReset.addEventListener('click', () => {
  if (confirm('Deseja encerrar esta aventura e criar um novo mundo?')) {
    dom.gamePanel.classList.add('hidden');
    dom.setupPanel.classList.remove('hidden');
    state.setup = null;
    state.history = [];
    dom.chatBox.innerHTML = '';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  checkApiStatus();
});
