from django.urls import path
from . import views

urlpatterns = [
    path("create-invoice/", views.create_invoice, name="create_invoice"),
    path("room/<uuid:room_id>/", views.room_page, name="room_page"),
]
