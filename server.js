const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const API = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json';

let lastIssue = null;
let latestData = null;
const clients = new Set();

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

async function pollAPI() {
  try {
    const res = await fetch(API + '?t=' + Date.now(), {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const json = await res.json();

    if (!json?.data?.list?.length) return;

    const latest = json.data.list[0];
    const issue = latest.issueNumber;
    const number = parseInt(latest.number, 10);
    const side = number >= 5 ? 'BIG' : 'SMALL';

    const payload = {
      issue,
      number,
      side,
      time: Date.now()
    };

    latestData = payload;

    if (issue !== lastIssue) {
      lastIssue = issue;
      console.log('New Result →', side, number, issue);
      broadcast({ type: 'result', ...payload });
    }
  } catch (err) {
    console.error('Poll Error:', err.message);
  }
}

setInterval(pollAPI, 400);
pollAPI();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Client Connected:', clients.size);

  if (latestData) {
    ws.send(JSON.stringify({ type: 'result', ...latestData }));
  }

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client Disconnected:', clients.size);
  });
});

app.get('/', (req, res) => {
  res.send('David 30S Backend is Running');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server started on port', PORT);
});
