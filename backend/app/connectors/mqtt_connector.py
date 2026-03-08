"""MQTT Connector für IoT-Sensoren und Smart-Home-Geräte."""

import json
import logging
from typing import Any, Callable

from app.connectors.base import BaseConnector

logger = logging.getLogger(__name__)


class MQTTConnector(BaseConnector):
    """Verbindung zu Geräten via MQTT."""

    def __init__(self, broker: str, port: int = 1883, topic_prefix: str = "energiemanager"):
        self.broker = broker
        self.port = port
        self.topic_prefix = topic_prefix
        self._client = None
        self._values: dict[str, Any] = {}
        self._callbacks: list[Callable] = []

    async def connect(self) -> bool:
        try:
            import paho.mqtt.client as mqtt

            self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
            self._client.on_message = self._on_message
            self._client.connect(self.broker, self.port)
            self._client.subscribe(f"{self.topic_prefix}/#")
            self._client.loop_start()
            logger.info("MQTT connected to %s:%d", self.broker, self.port)
            return True
        except Exception:
            logger.exception("MQTT connection failed")
            return False

    async def disconnect(self) -> None:
        if self._client:
            self._client.loop_stop()
            self._client.disconnect()
            self._client = None

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            topic = msg.topic.replace(f"{self.topic_prefix}/", "")
            self._values[topic] = payload
            for cb in self._callbacks:
                cb(topic, payload)
        except json.JSONDecodeError:
            self._values[msg.topic] = msg.payload.decode()

    async def read_values(self) -> dict[str, Any]:
        return dict(self._values)

    async def write_setpoint(self, key: str, value: Any) -> bool:
        if not self._client:
            return False
        topic = f"{self.topic_prefix}/set/{key}"
        self._client.publish(topic, json.dumps(value))
        return True

    async def is_connected(self) -> bool:
        return self._client is not None and self._client.is_connected()

    def on_value_update(self, callback: Callable) -> None:
        """Registriere einen Callback für Wert-Updates."""
        self._callbacks.append(callback)
