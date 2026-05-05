const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static("public"));

const questions = [
  {
    question: "O que caracteriza o modelo de franquia?",
    answers: {
      a: "Venda de produtos sem marca definida",
      b: "Uso de uma marca e modelo de negócio já estabelecido",
      c: "Criação de empresas independentes sem padrão",
      d: "Venda apenas por meio digital"
    },
    correct: "b"
  },
  {
    question: "Qual é uma obrigação do franqueado dentro do sistema de franquias?",
    answers: {
      a: "Criar sua própria marca",
      b: "Seguir os padrões definidos pela franqueadora",
      c: "Não pagar taxas",
      d: "Trabalhar sem contrato"
    },
    correct: "b"
  },
  {
    question: "Uma das principais vantagens das franquias é:",
    answers: {
      a: "Total liberdade de gestão",
      b: "Ausência de custos",
      c: "Uso de uma marca já reconhecida",
      d: "Falta de concorrência"
    },
    correct: "c"
  },
  {
    question: "Qual é uma desvantagem do modelo de franquia?",
    answers: {
      a: "Alto nível de autonomia",
      b: "Baixo investimento inicial",
      c: "Dependência das regras da franqueadora",
      d: "Falta de suporte"
    },
    correct: "c"
  },
  {
    question: "O que define o modelo multiplataforma?",
    answers: {
      a: "Atuação em apenas um canal de vendas",
      b: "Uso exclusivo de lojas físicas",
      c: "Presença em diferentes canais e plataformas integradas",
      d: "Venda apenas por redes sociais"
    },
    correct: "c"
  },
  {
    question: "Qual é uma vantagem do modelo multiplataforma?",
    answers: {
      a: "Menor alcance de público",
      b: "Redução da presença digital",
      c: "Maior alcance e flexibilidade para o cliente",
      d: "Eliminação de custos"
    },
    correct: "c"
  },
  {
    question: "Qual empresa é um exemplo de franquia citado no trabalho?",
    answers: {
      a: "Amazon",
      b: "Netflix",
      c: "McDonald's",
      d: "Google"
    },
    correct: "c"
  },
  {
    question: "Qual empresa utiliza fortemente o modelo multiplataforma, permitindo acesso em diversos dispositivos?",
    answers: {
      a: "McDonald's",
      b: "Netflix",
      c: "Subway",
      d: "Burger King"
    },
    correct: "b"
  }
];

const GLOBAL_ROOM = "GLOBAL";

// Gera PIN de 6 dígitos
function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

let roomPin = generatePin();
let players = {};
let currentQuestion = -1;
let started = false;

io.on("connection", (socket) => {

  // Host se conecta → entra na sala para receber updates e recebe o PIN
  socket.on("hostJoin", () => {
    socket.join(GLOBAL_ROOM);
    socket.emit("roomPin", roomPin);
    socket.emit("updatePlayers", Object.values(players));
    console.log("Host conectado. PIN: " + roomPin);
  });

  // Player entra com nome + PIN
  socket.on("joinGame", ({ name, pin }) => {
    // Valida PIN
    if (pin !== roomPin) {
      socket.emit("joinError", "PIN inválido! Tente novamente.");
      return;
    }

    players[socket.id] = {
      name,
      score: 0,
      answered: false
    };

    socket.join(GLOBAL_ROOM);

    io.to(GLOBAL_ROOM).emit("updatePlayers", Object.values(players));

    socket.emit("joinedGame", { pin: roomPin });

    console.log(name + " entrou na sala. Total: " + Object.keys(players).length);

    // se o jogo já começou, manda pergunta atual
    if (started && currentQuestion >= 0) {
      socket.emit("newQuestion", {
        index: currentQuestion,
        total: questions.length,
        question: questions[currentQuestion]
      });
    }
  });

  // host começa quiz
  socket.on("startQuiz", () => {
    if (Object.keys(players).length === 0) {
      socket.emit("joinError", "Nenhum jogador conectado!");
      return;
    }

    started = true;
    currentQuestion = 0;

    for (let id in players) {
      players[id].answered = false;
    }

    io.to(GLOBAL_ROOM).emit("quizStarted");
    io.to(GLOBAL_ROOM).emit("newQuestion", {
      index: currentQuestion,
      total: questions.length,
      question: questions[currentQuestion]
    });
  });

  // host próxima pergunta
  socket.on("nextQuestion", () => {
    currentQuestion++;

    if (currentQuestion >= questions.length) {
      io.to(GLOBAL_ROOM).emit("quizEnded", Object.values(players));
      return;
    }

    for (let id in players) {
      players[id].answered = false;
    }

    io.to(GLOBAL_ROOM).emit("newQuestion", {
      index: currentQuestion,
      total: questions.length,
      question: questions[currentQuestion]
    });
  });

  // player responde
  socket.on("submitAnswer", ({ answer, timeLeft }) => {
    const player = players[socket.id];
    if (!player) return;

    if (player.answered) return;
    player.answered = true;

    const correct = questions[currentQuestion].correct;
    const isCorrect = (answer === correct);

    if (isCorrect) {
      let points = 200 + (timeLeft * 80);
      player.score += points;
    }

    // Envia resultado individual para o player
    socket.emit("answerResult", {
      correct: isCorrect,
      correctAnswer: correct
    });

    io.to(GLOBAL_ROOM).emit("leaderboardUpdate", Object.values(players));
  });

  // host inicia novo quiz (gera novo PIN, reseta tudo)
  socket.on("newQuiz", () => {
    roomPin = generatePin();
    players = {};
    currentQuestion = -1;
    started = false;

    io.to(GLOBAL_ROOM).emit("resetGame");
    socket.emit("roomPin", roomPin);
    socket.emit("updatePlayers", []);

    console.log("Novo quiz. Novo PIN: " + roomPin);
  });

  socket.on("disconnect", () => {
    if (players[socket.id]) {
      delete players[socket.id];
      io.to(GLOBAL_ROOM).emit("updatePlayers", Object.values(players));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
