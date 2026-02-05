from fastapi import FastAPI, WebSocket
from dotenv import load_dotenv
from app.core.config import settings
from app.ws.meeting_ws import handle_meeting_ws

load_dotenv()

app = FastAPI()


@app.get("/health")
def health():
    return {"ok": True, "env": settings.APP_ENV}


@app.websocket(settings.WS_PATH)
async def meeting_ws(ws: WebSocket):
    await handle_meeting_ws(ws)
