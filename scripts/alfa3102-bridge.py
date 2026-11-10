"""
PONTE SERIAL -> WEBSOCKET EM PYTHON PARA BALANÇA ALFA INSTRUMENTOS 3102C.S
Para uso em Windows no curral caso não use a Web Serial API nativa do Chrome.

Como rodar no Windows:
1. pip install pyserial websockets asyncio
2. python alfa3102-bridge.py COM3 9600
"""

import sys
import asyncio
import serial
import websockets

PORT_NAME = sys.argv[1] if len(sys.argv) > 1 else "COM3"
BAUD_RATE = int(sys.argv[2]) if len(sys.argv) > 2 else 9600
WS_PORT = 8080

CONNECTED_CLIENTS = set()

async def websocket_handler(websocket):
    print("-> Fazenda Control conectado via WebSocket!")
    CONNECTED_CLIENTS.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        print("<- Fazenda Control desconectado.")
        CONNECTED_CLIENTS.remove(websocket)

async def read_serial_loop():
    try:
        ser = serial.Serial(PORT_NAME, BAUD_RATE, timeout=1)
        print(f"✓ Conectado à balança Alfa 3102C.S na porta {PORT_NAME} ({BAUD_RATE} bps 8N1)")
    except Exception as e:
        print(f"Erro ao abrir porta {PORT_NAME}: {e}")
        return

    loop = asyncio.get_event_loop()

    while True:
        line = await loop.run_in_executor(None, ser.readline)
        if line:
            decoded = line.decode('ascii', errors='ignore').strip()
            if decoded:
                for ws in list(CONNECTED_CLIENTS):
                    try:
                        await ws.send(decoded)
                    except:
                        pass

async def main():
    print("=======================================================")
    print("   FAZENDA CONTROL — PONTE SERIAL PYTHON ALFA 3102C.S")
    print(f"   Escutando em ws://localhost:{WS_PORT}")
    print("=======================================================")

    server = await websockets.serve(websocket_handler, "localhost", WS_PORT)
    await asyncio.gather(server.wait_closed(), read_serial_loop())

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nEncerrando ponte...")
