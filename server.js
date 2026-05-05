const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static("public"));

const questions = [
  {
    question: "O que caracteriza o modelo de franquia?",
    answers: { a: "Venda de produtos sem marca definida", b: "Uso de uma marca e modelo de negócio já estabelecido", c: "Criação de empresas independentes sem padrão", d: "Venda apenas por meio digital" },
    correct: "b"
  },
  {
    question: "Qual é uma obrigação do franqueado dentro do sistema de franquias?",
    answers: { a: "Criar sua própria marca", b: "Seguir os padrões definidos pela franqueadora", c: "Não pagar taxas", d: "Trabalhar sem contrato" },
    correct: "b"
  },
  {
    question: "Uma das principais vantagens das franquias é:",
    answers: { a: "Total liberdade de gestão", b: "Ausência de custos", c: "Uso de uma marca já reconhecida", d: "Falta de concorrência" },
    correct: "c"
  },
  {
    question: "Qual é uma desvantagem do modelo de franquia?",
    answers: { a: "Alto nível de autonomia", b: "Baixo investimento inicial", c: "Dependência das regras da franqueadora", d: "Falta de suporte" },
    correct: "c"
  },
  {
    question: "O que define o modelo multiplataforma?",
    answers: { a: "Atuação em apenas um canal de vendas", b: "Uso exclusivo de lojas físicas", c: "Presença em diferentes canais e plataformas integradas", d: "Venda apenas por redes sociais" },
    correct: "c"
  },
  {
    question: "Qual é uma vantagem do modelo multiplataforma?",
    answers: { a: "Menor alcance de público", b: "Redução da presença digital", c: "Maior alcance e flexibilidade para o cliente", d: "Eliminação de custos" },
    correct: "c"
  },
  {
    question: "Qual empresa é um exemplo de franquia citado no trabalho?",
    answers: { a: "Amazon", b: "Netflix", c: "McDonald's", d: "Google" },
    correct: "c"
  },
  {
    question: "Qual empresa utiliza fortemente o modelo multiplataforma, permitindo acesso em diversos dispositivos?",
    answers: { a: "McDonald's", b: "Netflix", c: "Subway", d: "Burger King" },
    correct: "b"
  }
];

// --- Estado do jogo ---
let roomPin = generatePin();
let players = {};   // socketId → { name, score, answered }
let hostId = null;  // socketId do host
let currentQuestion = -1;
let started = false;

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getPlayersList() {
  return Object.values(players);
}

function broadcastPlayers() {
  io.emit("updatePlayers", getPlayersList());
}

// --- Conexões Socket.IO ---
io.on("connection", (socket) => {
  console.log("Conectado:", socket.id);

  // ===== HOST =====
  socket.on("hostJoin", () => {
    hostId = socket.id;
    console.log("Host entrou:", socket.id, "| PIN:", roomPin);
    socket.emit("roomPin", roomPin);
    socket.emit("updatePlayers", getPlayersList());
  });

  // ===== PLAYER =====
  socket.on("joinGame", ({ name, pin }) => {
    // Valida PIN
    if (pin !== roomPin) {
      socket.emit("joinError", "PIN inválido! Tente novamente.");
      return;
    }

    if (!name || name.trim() === "") {
      socket.emit("joinError", "Digite seu nome!");
      return;
    }

    // Registra jogador
    players[socket.id] = {
      name: name.trim(),
      score: 0,
      answered: false
    };

    console.log("Player entrou:", name.trim(), "| Total:", Object.keys(players).length);

    // Avisa o player que entrou
    socket.emit("joinedGame", { pin: roomPin });

    // Avisa TODOS (host + players) sobre a nova lista
    broadcastPlayers();

    // Se o jogo já começou, manda a pergunta atual
    if (started && currentQuestion >= 0) {
      socket.emit("newQuestion", {
        index: currentQuestion,
        total: questions.length,
        question: questions[currentQuestion]
      });
    }
  });

  // ===== HOST INICIA QUIZ =====
  socket.on("startQuiz", () => {
    if (Object.keys(players).length === 0) {
      socket.emit("errorMessage", "Nenhum jogador conectado!");
      return;
    }

    started = true;
    currentQuestion = 0;

    for (let id in players) {
      players[id].answered = false;
    }

    console.log("Quiz iniciado!");
    io.emit("quizStarted");
    io.emit("newQuestion", {
      index: currentQuestion,
      total: questions.length,
      question: questions[currentQuestion]
    });
  });

  // ===== HOST PRÓXIMA PERGUNTA =====
  socket.on("nextQuestion", () => {
    currentQuestion++;

    if (currentQuestion >= questions.length) {
      console.log("Quiz terminado!");
      io.emit("quizEnded", getPlayersList());
      return;
    }

    for (let id in players) {
      players[id].answered = false;
    }

    console.log("Pergunta", currentQuestion + 1);
    io.emit("newQuestion", {
      index: currentQuestion,
      total: questions.length,
      question: questions[currentQuestion]
    });
  });

  // ===== PLAYER RESPONDE =====
  socket.on("submitAnswer", ({ answer, timeLeft }) => {
    const player = players[socket.id];
    if (!player || player.answered) return;

    player.answered = true;

    const correct = questions[currentQuestion].correct;
    const isCorrect = (answer === correct);

    if (isCorrect) {
      player.score += 200 + (timeLeft * 80);
    }

    // Resultado individual pro player
    socket.emit("answerResult", {
      correct: isCorrect,
      correctAnswer: correct
    });

    // Leaderboard atualizado pra todos
    io.emit("leaderboardUpdate", getPlayersList());
  });

  // ===== NOVO QUIZ (host quer recomeçar) =====
  socket.on("newQuiz", () => {
    roomPin = generatePin();
    players = {};
    currentQuestion = -1;
    started = false;

    console.log("Novo quiz! Novo PIN:", roomPin);

    io.emit("resetGame");
    socket.emit("roomPin", roomPin);
  });

  // ===== DESCONECTOU =====
  socket.on("disconnect", () => {
    if (players[socket.id]) {
      console.log("Player saiu:", players[socket.id].name);
      delete players[socket.id];
      broadcastPlayers();
    }
    if (socket.id === hostId) {
      console.log("Host desconectou");
      hostId = null;
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta http://localhost:${PORT}`);
});

