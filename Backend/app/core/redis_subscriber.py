import json
import asyncio
from app.core.redis import redis_client
from app.routes.ws import manager as chat_manager
from app.routes.presence_ws import manager as presence_manager

async def redis_listener():
    pubsub = redis_client.pubsub()
    await pubsub.psubscribe("chat:*")
    await pubsub.subscribe("global_presence")
    await pubsub.subscribe("conversation_changes")

    async for message in pubsub.listen():
        if message["type"] not in ["pmessage", "message"]:
            continue

        data = json.loads(message["data"])
        
        channel = message["channel"]
        channel_name = channel.decode('utf-8') if isinstance(channel, bytes) else channel
        
        if channel_name in ["global_presence", "conversation_changes"]:
            await presence_manager.broadcast_local(data)
        elif "chat_id" in data:
            # Send to LOCAL chat sockets only
            chat_id = data["chat_id"]
            await chat_manager.send_local(chat_id, data)
