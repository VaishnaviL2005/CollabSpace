import json
import asyncio
from app.core.redis import redis_client
from app.routes.ws import manager

async def redis_listener():
    pubsub = redis_client.pubsub()
    await pubsub.psubscribe("chat:*")

    async for message in pubsub.listen():
        if message["type"] != "pmessage":
            continue

        data = json.loads(message["data"])
        chat_id = data["chat_id"]

        # Send to LOCAL sockets only
        await manager.send_local(chat_id, data)
