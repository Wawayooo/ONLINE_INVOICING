import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Room, NegotiationHistory

class NegotiationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_hash = self.scope['url_route']['kwargs']['room_hash']
        self.room_group_name = f'negotiation_{self.room_hash}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Send current room state
        room_data = await self.get_room_data()
        await self.send(text_data=json.dumps({
            'type': 'room_state',
            'data': room_data
        }))

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')

        # Broadcast to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'negotiation_update',
                'message': data
            }
        )

    async def negotiation_update(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps(event['message']))

    @database_sync_to_async
    def get_room_data(self):
        try:
            room = Room.objects.get(room_hash=self.room_hash)
            return {
                'room_hash': room.room_hash,
                'is_buyer_assigned': room.is_buyer_assigned,
                'has_seller': hasattr(room, 'seller'),
                'has_buyer': hasattr(room, 'buyer'),
                'has_invoice': hasattr(room, 'invoice'),
                'invoice_status': room.invoice.status if hasattr(room, 'invoice') else None
            }
        except Room.DoesNotExist:
            return {'error': 'Room not found'}