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

let players = {};
let currentQuestion = -1;
let started = false;

io.on("connection", (socket) => {

  // player entra com nome
  socket.on("joinGame", ({ name }) => {
    players[socket.id] = {
      name,
      score: 0,
      answered: false
    };

    socket.join(GLOBAL_ROOM);

    io.to(GLOBAL_ROOM).emit("updatePlayers", Object.values(players));

    socket.emit("joinedGame");

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
    started = true;
    currentQuestion = 0;

    for (let id in players) {
      players[id].answered = false;
    }

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

    if (answer === correct) {
      let points = 200 + (timeLeft * 80);
      player.score += points;
    }

    io.to(GLOBAL_ROOM).emit("leaderboardUpdate", Object.values(players));
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.to(GLOBAL_ROOM).emit("updatePlayers", Object.values(players));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});