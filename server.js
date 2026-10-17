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
  const useDice = setup.useDice !== false && (
    setup.useDice === true ||
    rules.toLowerCase().includes('d20') ||
    rules.toLowerCase().includes('dado')
  );

  let diceRulesText = '';
  if (useDice) {
    diceRulesText = `8. SISTEMA DE TESTES DE RISCO COM DADO D20 (REGRA ESPECIAL ATIVADA):
- QUANDO EXIGIR UM DADO: Sempre que o jogador tentar uma ação que envolva RISCO FÍSICO/MÁGICO REAL, PERIGO IMINENTE, INCERTEZA CRÍTICA, CONFLITO DIRETO, FURTIVIDADE SOB VIGILÂNCIA OU ALTO RISCO DE FRACASSO (e o comando dele AINDA NÃO contiver o resultado de um dado já rolado pelo sistema, como '[🎲 Verge rolou d20: X]'):
  NÃO resolva o desfecho nem narre o sucesso ou fracasso da ação ainda!
  Em vez disso, escreva 1 a 2 parágrafos tensos e atmosféricos alertando sobre o perigo e deixando claro que a ação é arriscada e exige um teste de d20.
  OBRIGATÓRIO: Termine a resposta com a tag exata:
  [EXIGE_DADO: Sim | Risco=Explicação curta e direta do perigo ou consequência caso o teste falhe]
  (Nesse caso, NÃO inclua a tag [OPCOES], pois a história fica em pausa aguardando a confirmação do jogador).

- QUANDO A AÇÃO JÁ TEM DADO ROLADO: Se o comando do jogador já contiver a rolagem feita pelo sistema (ex: '[🎲 Verge rolou d20: X (Resultado)]'):
  Interprete o valor numérico do dado de forma determinante na resolução da cena:
  * 20: Sucesso Crítico Espetacular (conquista o objetivo com maestria épica e vantagem extra);
  * 10 a 19: Sucesso Normal (alcança o objetivo proposto com determinação);
  * 2 a 9: Complicação Grave / Fracasso Parcial (consegue a custo alto ou falha sofrendo dano/dificuldade);
  * 1: Falha Crítica Desastrosa (consequência imediata catastrófica e reviravolta perigosa).
  Narre a cena completa, as consequências e conclua com as opções e status:
  [OPCOES: Opção 1 | Opção 2 | Opção 3]
  [STATUS: Condicao=... | Inventario=...]

- QUANDO NÃO EXIGIR DADO: Se a ação do jogador for MUNDANA ou SEM RISCO IMINENTE (ex: conversar casualmente, andar por áreas seguras, comer, inspecionar um ambiente tranquilo, pegar um item comum):
  NÃO exija dado. Narre normalmente e conclua com as opções e status usuais:
  [OPCOES: Opção 1 | Opção 2 | Opção 3]
  [STATUS: Condicao=... | Inventario=...]`;
  } else {
    diceRulesText = `8. SISTEMA DE AÇÃO LIVRE: Responda narrativamente respeitando a lógica da causa e efeito das escolhas do jogador.`;
  }

  return `Você é Verge, o condutor narrativo e árbitro de um RPG de texto procedural altamente imersivo.
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
6. OBRIGATÓRIO: Ao final de respostas que avançam a história, sugira exatamente 3 opções de ações possíveis para o protagonista tomar a seguir. As opções devem ser diretas, plausíveis, claras e práticas dentro da situação imediata (ações intuitivas e pés no chão típicas das melhores narrativas da cultura pop, sem ideias absurdas ou mirabolantes), no formato:
[OPCOES: Primeira ação | Segunda ação | Terceira ação]
7. OBRIGATÓRIO: Atualize a condição física/mental atual do protagonista (ex: Ileso, Ferido, Exausto, Adrenalisado) e a lista de itens relevantes que ele carrega (separados por vírgula), no formato estrito:
[STATUS: Condicao=Ileso | Inventario=Item 1, Item 2]
${diceRulesText}`;
}

function parseStoryResponse(rawText) {
  let text = rawText || '';
  let options = [];
  let status = null;
  let diceRequirement = null;

  // Extrai [EXIGE_DADO: Sim | Risco=...]
  const diceMatch = text.match(/\[EXIGE_DADO:\s*(?:Sim|True|1)?\s*(?:\|\s*Risco=([^\]]+))?\]/i);
  if (diceMatch) {
    const risk = diceMatch[1] ? diceMatch[1].trim() : 'Esta ação envolve perigo considerável e risco de consequências.';
    diceRequirement = {
      required: true,
      risk
    };
    text = text.replace(/\[EXIGE_DADO:\s*(?:Sim|True|1)?\s*(?:\|\s*Risco=[^\]]+)?\]/i, '').trim();
  }

  // Extrai [STATUS: Condicao=... | Inventario=...]
  const statusMatch = text.match(/\[STATUS:\s*Condi[çc][ãa]o=([^|]+)\s*\|\s*Invent[áa]rio=([^\]]+)\]/i);
  if (statusMatch) {
    const condition = statusMatch[1].trim();
    const inventory = statusMatch[2]
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0 && !item.toLowerCase().includes('nenhum'));
    status = { condition, inventory };
    text = text.replace(/\[STATUS:\s*Condi[çc][ãa]o=[^|]+\s*\|\s*Invent[áa]rio=[^\]]+\]/i, '').trim();
  }

  // Extrai [OPÇÕES: ...]
  const optionsMatch = text.match(/\[(?:OPÇÕES|OPCOES|SUGESTÕES|SUGESTOES|ESCOLHAS):\s*(.+?)\]/i);
  if (optionsMatch) {
    options = optionsMatch[1]
      .split('|')
      .map(opt => opt.trim())
      .filter(opt => opt.length > 0);
    text = text.replace(/\[(?:OPÇÕES|OPCOES|SUGESTÕES|SUGESTOES|ESCOLHAS):\s*.+?\]/i, '').trim();
  }

  return { text, options, status, diceRequirement };
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
      return response.text || 'Verge aguarda sua decisão...';
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

app.get('/api/generate-presets', async (req, res) => {
  try {
    const prompt = `Gere exatamente 3 cenários de RPG de mesa acessíveis, familiares e inspirados nos universos mais consagrados e amados da cultura pop mundial (por exemplo: Fantasia Medieval estilo Senhor dos Anéis/The Witcher, Apocalipse Zumbi estilo The Last of Us/Walking Dead, Velho Oeste estilo Red Dead Redemption, Piratas estilo Piratas do Caribe, Ficção Espacial estilo Star Wars/Guardiões da Galáxia, Mistério Sobrenatural anos 80 estilo Stranger Things, Cyberpunk urbano estilo Cyberpunk 2077, ou Aventura Arqueológica estilo Indiana Jones).

IMPORTANTE: NÃO crie conceitos bizarros, surrealistas, metafísicos ou 'viajados'. Os mundos devem ser divertidos, com clareza imediata, temas clássicos da cultura pop e perigos compreensíveis e pés no chão.

Para cada um dos 3 cenários, crie exatamente 3 arquétipos de personagens contextuais clássicos, com títulos claros e motivações intuitivas que qualquer jogador reconheça e queira jogar.

Retorne EXCLUSIVAMENTE um array JSON com exatamente 3 objetos, sem markdown ou texto extra, no seguinte formato estrito:
[
  {
    "id": "slug-curto",
    "icon": "emoji",
    "title": "Nome Curto do Universo (ex: Velho Oeste & Foras-da-Lei)",
    "summary": "Resumo instigante em 1 linha",
    "theme": "Descrição envolvente do cenário em 1 ou 2 frases acessíveis",
    "characters": [
      { "name": "Título do Personagem (ex: Pistoleiro Solitário)", "desc": "Breve histórico ou dilema clássico em 1 frase" },
      { "name": "Título do Personagem", "desc": "Breve histórico ou dilema clássico em 1 frase" },
      { "name": "Título do Personagem", "desc": "Breve histórico ou dilema clássico em 1 frase" }
    ],
    "defaultRule": "Estilo de narrativa e regras recomendado"
  }
]`;

    const raw = await generateStory(prompt, 'Você é um gerador de mundos e arquétipos de RPG inspirados na cultura pop consagrada. Crie universos familiares, pés no chão e empolgantes. Retorne APENAS um array JSON válido, sem markdown.');
    let cleanJson = raw.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
    }

    const parsed = JSON.parse(cleanJson);
    const presets = Array.isArray(parsed) ? parsed.slice(0, 3) : [];
    return res.json({ presets });
  } catch (error) {
    console.error('Erro em /api/generate-presets:', error);
    return res.status(500).json({ error: 'Falha ao gerar novos presets com IA.' });
  }
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
1. Na antepenúltima linha, forneça um título marcante para esta aventura:
[TITULO: Seu Título Aqui]
2. Na penúltima linha, forneça 3 opções de ações iniciais instigantes:
[OPCOES: Opção 1 | Opção 2 | Opção 3]
3. Na última linha, forneça a condição inicial do herói e 2 a 4 itens iniciais que ele carrega no corpo/bolsos:
[STATUS: Condicao=Ileso | Inventario=Item 1, Item 2]`;

    let rawOpening = await generateStory(openingPrompt, systemInstruction);
    let title = setup.theme.length > 30 ? setup.theme.slice(0, 30).trim() + '...' : setup.theme;

    const titleMatch = rawOpening.match(/\[TITULO:\s*(.+?)\]/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      rawOpening = rawOpening.replace(/\[TITULO:\s*.+?\]/i, '').trim();
    }

    const { text: opening, options, status } = parseStoryResponse(rawOpening);

    return res.json({
      opening,
      title,
      options,
      status: status || { condition: 'Ileso', inventory: [] }
    });
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
    const { text: reply, options, status, diceRequirement } = parseStoryResponse(rawReply);

    return res.json({ reply, options, status, diceRequirement });
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
