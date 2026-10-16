# Verge 🌌

Motor de RPG de texto procedural altamente customizável onde o jogador define o universo e as regras, e a inteligência artificial atua como o Mestre de Jogo adaptativo em tempo real.

---

## Como Funciona

1. **Definição Livre do Mundo**: Escolha livremente qualquer cenário (Cyberpunk, Sci-Fi espacial, Terror gótico, Faroeste fantástico), seu protagonista e o estilo narrativo.
2. **Geração Procedural**: Verge interpreta os parâmetros e gera o gancho de abertura imediato sem roteiros pré-definidos.
3. **Turnos Livres**: A cada resposta, você descreve sua ação livremente e Verge narra os desdobramentos, consequências e novos dilemas.

---

## Estrutura do Projeto

```
AI TB RPG/
├── public/                 # Interface do jogador
│   ├── index.html          # Estrutura HTML limpa
│   ├── style.css           # Estilização minimalista
│   └── script.js           # Gerenciamento de eventos e chamadas de API
├── .env.example            # Modelo de variáveis de ambiente
├── .gitignore              # Proteção de credenciais e dependências
├── package.json            # Configuração e dependências do Node.js
├── prompt-engine.md        # Diretrizes mestras do motor narrativo
├── README.md               # Documentação inicial
└── server.js               # Servidor Express com integração Gemini
```

---

## Como Executar

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure sua chave no `.env`:
   ```env
   PORT=3000
   GEMINI_API_KEY=sua_chave_do_google_ai_studio
   ```

3. Inicie o servidor:
   ```bash
   npm run dev
   ```

4. Acesse:
   [http://localhost:3000](http://localhost:3000)
