const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

// salas
let rooms = {};

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

io.on("connection", (socket) => {

  // HOST cria sala
  socket.on("createRoom", () => {
    const pin = generatePin();

    rooms[pin] = {
      hostId: socket.id,
      players: {},
      currentQuestion: -1,
      started: false
    };

    socket.join(pin);
    socket.emit("roomCreated", pin);
  });

  // PLAYER entra na sala
  socket.on("joinRoom", ({ pin, name }) => {
    if (!rooms[pin]) {
      socket.emit("errorMessage", "Sala não encontrada!");
      return;
    }

    rooms[pin].players[socket.id] = {
      name,
      score: 0,
      answered: false
    };

    socket.join(pin);

    io.to(pin).emit("updatePlayers", Object.values(rooms[pin].players));
    socket.emit("joinedRoom", pin);
  });

  // HOST começa quiz
  socket.on("startQuiz", (pin) => {
    if (!rooms[pin]) return;
    rooms[pin].started = true;
    rooms[pin].currentQuestion = 0;

    // reset answered
    for (let id in rooms[pin].players) {
      rooms[pin].players[id].answered = false;
    }

    io.to(pin).emit("newQuestion", {
      index: 0,
      total: questions.length,
      question: questions[0]
    });
  });

  // HOST próxima pergunta
  socket.on("nextQuestion", (pin) => {
    if (!rooms[pin]) return;

    rooms[pin].currentQuestion++;

    if (rooms[pin].currentQuestion >= questions.length) {
      io.to(pin).emit("quizEnded", Object.values(rooms[pin].players));
      return;
    }

    for (let id in rooms[pin].players) {
      rooms[pin].players[id].answered = false;
    }

    const qIndex = rooms[pin].currentQuestion;

    io.to(pin).emit("newQuestion", {
      index: qIndex,
      total: questions.length,
      question: questions[qIndex]
    });
  });

  // PLAYER responde
  socket.on("submitAnswer", ({ pin, answer, timeLeft }) => {
    if (!rooms[pin]) return;

    const player = rooms[pin].players[socket.id];
    if (!player) return;

    if (player.answered) return;
    player.answered = true;

    const qIndex = rooms[pin].currentQuestion;
    const correct = questions[qIndex].correct;

    if (answer === correct) {
      // pontuação por tempo (máx 1000)
      let points = 200 + (timeLeft * 80);
      player.score += points;
    }

    io.to(pin).emit("leaderboardUpdate", Object.values(rooms[pin].players));
  });

  // desconectar
  socket.on("disconnect", () => {
    for (let pin in rooms) {
      if (rooms[pin].players[socket.id]) {
        delete rooms[pin].players[socket.id];
        io.to(pin).emit("updatePlayers", Object.values(rooms[pin].players));
      }

      // se host saiu, fecha sala
      if (rooms[pin].hostId === socket.id) {
        io.to(pin).emit("errorMessage", "O host saiu. Sala encerrada.");
        delete rooms[pin];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});