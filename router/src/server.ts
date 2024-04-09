import express from 'express';
import http from 'http';
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
let sockets: string[] = [];
let connections: Map<string, string> = new Map<string, string>();
io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);
  sockets.push(socket.id);
  //if (sockets.length > 2) sockets.shift();
  console.log(sockets);
  // Relay WebRTC offers, answers, and ICE candidates to peers
  socket.on('offer', ({ offer, to }: { offer: any, to: string }) => {
      connections.set(socket.id, to);
      socket.to(to).emit('offer', { offer, from: socket.id });
  });
  socket.on("otherPlayer", () => {
    console.log(sockets);
    // for (const s of sockets) {
    //   if (s !== socket.id) {
    //     socket.emit("player", s);
    //     break;
    //   }
    // }
    socket.emit("player", sockets.filter(s => s !== socket.id));
  }) 
  socket.on('answer', ({ answer, to }) => {
    connections.set(socket.id, to);
    socket.to(to).emit('answer', { answer, from: socket.id });
  });

  socket.on('candidate', ({ candidate, to }) => {
    socket.to(to).emit('candidate', { candidate, from: socket.id });
  });
  socket.on("data", (data) => {
    const to = connections.get(socket.id)!;
    socket.to(to).emit("data", data);
  });
  socket.on('disconnect', () => {
    console.log('user disconnected');
    connections.delete(socket.id);
    if (sockets.includes(socket.id)) {
      sockets.splice(sockets.indexOf(socket.id), 1);
    }
  });
});
/*
The biggest challenge we faced was designing an algorithm that protected both players but kept latency low. We got over it by persevering and opting to use program-managed temporary accounts to sign ordered blocks sent between the players.  We only involved the chain if a dispute was raised. At that point, the game is paused until the dispute is solved. We also had to build the game engine in pure typescript, which was much harder than using existing game libraries. 
*/

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});