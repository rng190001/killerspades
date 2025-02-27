const { sendEmail } = require('./src/Mailjet.js');

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

//Each room player counter
const roomPlayerCount = {};

//Get the id of each player in the rooms
const roomPlayerIds = {};
const roomPlayerIdsLong = {};
const roomBids = {};
const rooms = {};

 // handle requests to server
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('sendEmail', (email) => {
    const link = 'http://localhost:3000'
    sendEmail(email, link);
  });

  socket.on('joinRoom', async (roomId) => {
    socket.join(roomId);
    console.log(`User joined room ${roomId}`);
    // Notify room when someone joins
    socket.to(roomId).emit('message', `User ${socket.id.substring(0, 5)} has joined the room.`);
    const connections = await io.in(roomId).fetchSockets();
    var Ids = [];
    var longIds = [];
    connections.forEach(function (connection) {
        Ids.push(connection.id.substring(0,5));
        longIds.push(connection.id);
    });
    console.log( Ids)
    io.to(socket.id).emit('message', `User/s in room: ${Ids.toString()}`);
    io.to(socket.id).emit('username', socket.id.substring(0,5));
    roomPlayerIds[roomId] = Ids;
    roomPlayerIdsLong[roomId] = longIds;
    // set/ initialize a counter if one does not exist for the room already 
    if (!roomPlayerCount[roomId]){
      roomPlayerCount[roomId] = 0;
    }
    if (!rooms[roomId]) {
      rooms[roomId] = {
          playerIds: [],
          bidOrder: [],
          currentBidderIndex: 0,
      };
  }
  rooms[roomId].playerIds.push(socket.id);

    //io.to(socket.id).emit('playerIds', Ids);
  });

  socket.on('chatMessage', (data) => {
    console.log(data.room)
    console.log(data.text);
    io.to(data.room).emit('message', `${socket.id.substring(0,5)}: ${data.text}`);
  });

  socket.on('submitBid', ({ roomId, bid }) => {
      const bidData = { username: socket.id.substring(0,5), bid };
      if (!roomBids[roomId]) {
        roomBids[roomId] = [];
      }
      roomBids[roomId].push(bidData);
      rooms[roomId].currentBidderIndex = (rooms[roomId].currentBidderIndex + 1) % rooms[roomId].bidOrder.length;
      const nextBidderId = rooms[roomId].bidOrder[rooms[roomId].currentBidderIndex];
      io.to(nextBidderId).emit('bidTurn');
      console.log(roomBids[roomId]);
      io.to(roomId).emit('bidUpdate',roomBids[roomId]);
     });

  //deal the cards on the server
  //create the deck of cards
  const createDeck = () => {
        const suit = ["Diamonds ♦️", "Spades ♠️", "Hearts ❤️", "Clubs ♣️"];
        const numberRank = ["Ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Jack", "Queen", "King"];
        const deck = [];

        for (let s of suit){
            for (let nR of numberRank){
                deck.push(`${nR} of ${s}`)
            }
        }
        return shuffle(deck);
    }

    // Function to shuffle the deck of cards
    const shuffle = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    };

    // Function to deal cards to players
    const dealCards = (roomId, playerIds) => {
        const deck = createDeck();
        const numPlayers = playerIds.length;
        const numCardsPerPlayer = Math.floor(deck.length / numPlayers);

        const playersWithCards = [];
        for (let i = 0; i < numPlayers; i++) {
            const username = playerIds[i];
            const playerCards = deck.splice(0, numCardsPerPlayer);
            playersWithCards.push({
                username: username,
                cards: playerCards
            });
        }

         // Emit card data to all clients in the room
          io.to(roomId).emit('cardData', playersWithCards);
    };

    const selectDealer = (roomId, playerIds) => {
      // Generate a random number from 0 to 3
      const random = Math.floor(Math.random() * 4);
      // Set that index in the playerId array to be the dealer
      const dealer = playerIds[random];
      const dealerLong = roomPlayerIdsLong[roomId][random];
      console.log("dealer id:", dealerLong);
      console.log(dealer)
      

      const playerOrder = roomPlayerIdsLong[roomId];
      console.log("player order:", playerOrder);
      const dealerIndex = playerOrder.indexOf(dealerLong);
      console.log("dealer index:", dealerIndex)
      const bidOrder = playerOrder.slice(dealerIndex + 1).concat(playerOrder.slice(0, dealerIndex+1));
      let currentBidderIndex = 0;
      rooms[roomId].bidOrder = bidOrder;
      rooms[roomId].currentBidderIndex = currentBidderIndex;
      io.to(roomId).emit('dealerChosen', dealer);
      console.log("bid order:", bidOrder)
      io.to(bidOrder[0]).emit('bidTurn');
    };

  /** 
    // Count how many players are ready in a game room
  socket.on('playerReady', (roomId) =>{
    const playerUniqueIds = roomPlayerIds[roomId];
    // If a player clicks "Player Ready?", increment count of players that are ready
    roomPlayerCount[roomId] =  roomPlayerCount[roomId] + 1
    console.log(`User pressed button in ${roomId} roomPlayerCount[roomId] ${roomPlayerCount[roomId]}` );
    // Once the number of ready players = 4, reset the counter and indicate that all players are ready
    if (roomPlayerCount[roomId] === 4){
      io.to(roomId).emit("allPlayersReady")
      // Deal all the cards in the deck
      dealCards(roomId, playerUniqueIds);
      // Select the dealer for the game
      selectDealer(roomId, playerUniqueIds);
      roomPlayerCount[roomId] = 0
    }
  })
  */
  // Count how many players are ready in a game room
  socket.on('playerReady', (roomId) =>{
    const playerUniqueIds = roomPlayerIds[roomId];
    // If a player clicks "Player Ready?", increment count of players that are ready
    roomPlayerCount[roomId] =  roomPlayerCount[roomId] + 1
    console.log(`User pressed button in ${roomId} roomPlayerCount[roomId] ${roomPlayerCount[roomId]}` );
    // Once the number of ready players = 4, reset the counter and indicate that all players are ready
    if (roomPlayerCount[roomId] === 4){
      dealCards(roomId, playerUniqueIds);
      // Select the dealer for the game
      selectDealer(roomId, playerUniqueIds);
      roomPlayerCount[roomId] = 0
      
      io.to(roomId).emit("allPlayersReady")
      // Deal all the cards in the deck
      
    }
  })

  socket.on('leaveRoom', (roomId) => {
    socket.leave(roomId);
    console.log(`User left room ${roomId}`);
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
