import json
from typing import Any

from app.core.redis import redis_client


async def publish_event(channel: str, data: dict[str, Any]) -> None:
    """Publish an event to a Redis Pub/Sub channel."""
    await redis_client.publish(channel, json.dumps(data))


async def subscribe(channel: str):
    """Subscribe to a Redis Pub/Sub channel. Yields parsed messages."""
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(channel)
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                yield json.loads(message["data"])
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
