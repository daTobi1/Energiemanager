"""WebSocket für Echtzeit-Updates."""

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

connected_clients: list[WebSocket] = []


@router.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    """WebSocket-Endpunkt für Echtzeit-Energiedaten."""
    await websocket.accept()
    connected_clients.append(websocket)

    try:
        while True:
            # Halte Verbindung offen, empfange Client-Nachrichten
            data = await websocket.receive_text()
            # Client kann z.B. Filter setzen
            message = json.loads(data)
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        connected_clients.remove(websocket)


async def broadcast(data: dict) -> None:
    """Sende Daten an alle verbundenen WebSocket-Clients."""
    disconnected = []
    for client in connected_clients:
        try:
            await client.send_json(data)
        except Exception:
            disconnected.append(client)

    for client in disconnected:
        connected_clients.remove(client)
