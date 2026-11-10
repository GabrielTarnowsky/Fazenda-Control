/**
 * PONTE LOCAL SERIAL -> WEBSOCKET PARA A BALANÇA ALFA INSTRUMENTOS 3102C.S
 * 
 * USO (Opcional - Caso não queira usar a Web Serial API nativa do Chrome/Edge):
 * 1. Instale as dependências:
 *    npm install serialport ws
 * 2. Execute no terminal do Windows/Linux conectado à balança:
 *    node alfa3102-bridge.js COM3 9600
 * 3. O Fazenda Control se conectará automaticamente em ws://localhost:8080
 */

const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const { WebSocketServer } = require("ws");

const portName = process.argv[2] || "COM3";
const baudRate = parseInt(process.argv[3] || "9600", 10);
const wsPort = 8080;

console.log(`=======================================================`);
console.log(`   FAZENDA CONTROL — PONTE SERIAL ALFA 3102C.S`);
console.log(`=======================================================`);
console.log(`Conectando à porta serial: ${portName} a ${baudRate} bps 8N1...`);

const serialPort = new SerialPort({
  path: portName,
  baudRate: baudRate,
  dataBits: 8,
  stopBits: 1,
  parity: "none",
  autoOpen: true
});

const parser = serialPort.pipe(new ReadlineParser({ delimiter: "\r\n" }));
const wss = new WebSocketServer({ port: wsPort });

console.log(`Servidor WebSocket pronto em ws://localhost:${wsPort}`);

const clients = new Set();

wss.on("connection", (ws) => {
  console.log("-> Fazenda Control conectado à ponte!");
  clients.add(ws);

  ws.on("close", () => {
    console.log("<- Fazenda Control desconectado.");
    clients.delete(ws);
  });
});

parser.on("data", (line) => {
  const cleanLine = line.trim();
  if (!cleanLine) return;

  // Repassa o telegrama da balança para todos os navegadores conectados
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(cleanLine);
    }
  }
});

serialPort.on("open", () => {
  console.log(`✓ Porta serial ${portName} aberta com sucesso! Aguardando pesagens...`);
});

serialPort.on("error", (err) => {
  console.error(`Erro na porta serial ${portName}:`, err.message);
});
