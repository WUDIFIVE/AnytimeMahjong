// Mahjong Server Entry Point
import express from 'express';
import cors from 'cors';
import * as http from 'http';
import * as WebSocket from 'ws';
import { RoomManager } from './room/manager';
import { setupWebSocketHandler } from './ws/handler';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

const roomManager = new RoomManager();
setupWebSocketHandler(wss, roomManager);

server.listen(port, () => {
  console.log('Mahjong server running on port ' + port);
});
