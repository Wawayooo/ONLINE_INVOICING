from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/negotiation/(?P<room_hash>\w+)/$', consumers.NegotiationConsumer.as_asgi()),
]