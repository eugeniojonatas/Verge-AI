import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let aiClient = null;
if (GEMINI_API_KEY && GEMINI_API_KEY.trim() !== '' && GEMINI_API_KEY !== 'sua_chave_api_aqui') {
  aiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

function buildSystemInstruction(setup = {}) {
  const theme = setup.theme || 'Aventura livre e misteriosa';
  const character = setup.character || 'Um andarilho de habilidades desconhecidas';
  const rules = setup.rules || 'Narrativo livre com foco em causa e efeito';

  return `Você é Verge, o Mestre de Jogo e Motor Narrativo de um RPG de texto procedural altamente imersivo.
O jogador definiu as seguintes premissas customizadas para o universo atual:

- CENÁRIO / TEMÁTICA: ${theme}
- PROTAGONISTA / PAPEL DO JOGADOR: ${character}
- ESTILO & REGRAS: ${rules}

DIRETRIZES FUNDAMENTAIS:
1. Adapte imediatamente vocabulário, atmosfera e perigos à temática informada.
2. Seja sensorial e detalhista, mantendo as respostas objetivas (2 a 4 parágrafos concisos).
3. Respeite as ações do jogador, narrando consequências lógicas e novos desafios.
4. NUNCA narre pelo jogador nem tome decisões por ele.
5. Conclua cada turno com o cenário em aberto e instigue a ação do jogador.
6. OBRIGATÓRIO: Ao final de toda resposta, sugira exatamente 3 opções de ações possíveis, dinâmicas e contrastantes para o protagonista tomar a seguir, separadas por barra vertical '|', estritamente no formato:
[OPCOES: Primeira ação | Segunda ação | Terceira ação]`;
}

function parseStoryResponse(rawText) {
  let text = rawText || '';
  let options = [];

  const optionsMatch = text.match(/\[(?:OPÇÕES|OPCOES|SUGESTÕES|SUGESTOES|ESCOLHAS):\s*(.+?)\]/i);
  if (optionsMatch) {
    options = optionsMatch[1]
      .split('|')
      .map(opt => opt.trim())
      .filter(opt => opt.length > 0);
    text = text.replace(/\[(?:OPÇÕES|OPCOES|SUGESTÕES|SUGESTOES|ESCOLHAS):\s*.+?\]/i, '').trim();
  }

  return { text, options };
}

async function generateStory(contents, systemInstruction) {
  if (!aiClient) {
    throw new Error('Chave GEMINI_API_KEY não configurada no arquivo .env.');
  }

  let lastError = null;
  for (const model of MODELS) {
    try {
      const response = await aiClient.models.generateContent({
        model,
        contents,
        config: { systemInstruction }
      });
      return response.text || 'O Mestre aguarda sua decisão...';
    } catch (err) {
      lastError = err;
      if (err.status === 400 || err.status === 401 || err.status === 403) {
        throw err;
      }
    }
  }
  throw lastError;
}

app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    aiConfigured: Boolean(aiClient)
  });
});

app.post('/api/init', async (req, res) => {
  try {
    const { setup } = req.body;
    if (!setup || !setup.theme) {
      return res.status(400).json({ error: 'Por favor, defina ao menos o tema ou cenário do mundo.' });
    }

    const systemInstruction = buildSystemInstruction(setup);
    const openingPrompt = `Descreva a cena de abertura imersiva deste mundo, apresentando a situação inicial imediata onde o protagonista se encontra e o primeiro dilema ou decisão que ele precisa tomar.

IMPORTANTE:
1. Na penúltima linha, forneça um título marcante para esta aventura:
[TITULO: Seu Título Aqui]
2. Na última linha, forneça 3 opções de ações iniciais instigantes:
[OPCOES: Opção 1 | Opção 2 | Opção 3]`;

    let rawOpening = await generateStory(openingPrompt, systemInstruction);
    let title = setup.theme.length > 30 ? setup.theme.slice(0, 30).trim() + '...' : setup.theme;

    const titleMatch = rawOpening.match(/\[TITULO:\s*(.+?)\]/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      rawOpening = rawOpening.replace(/\[TITULO:\s*.+?\]/i, '').trim();
    }

    const { text: opening, options } = parseStoryResponse(rawOpening);

    return res.json({ opening, title, options });
  } catch (error) {
    console.error('Erro em /api/init:', error);
    return res.status(500).json({
      error: error.message || 'Falha ao gerar o mundo inicial.'
    });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { setup, message, history } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Comando do jogador não pode estar vazio.' });
    }

    const systemInstruction = buildSystemInstruction(setup);

    let contents = [];
    if (Array.isArray(history)) {
      contents = history.slice(-8).map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }]
      }));
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const rawReply = await generateStory(contents, systemInstruction);
    const { text: reply, options } = parseStoryResponse(rawReply);

    return res.json({ reply, options });
  } catch (error) {
    console.error('Erro em /api/chat:', error);
    return res.status(500).json({
      error: error.message || 'Falha ao processar o turno da aventura.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Verge rodando na porta ${PORT} (http://localhost:${PORT})`);
});
