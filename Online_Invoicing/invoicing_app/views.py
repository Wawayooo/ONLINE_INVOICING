from django.shortcuts import render

# Create your views here.

from django.shortcuts import redirect, render, get_object_or_404
from .models import Room

def create_invoice(request):
    room = Room.objects.create()
    return redirect(f"/room/{room.id}/")

def room_page(request, room_id):
    room = get_object_or_404(Room, id=room_id)
    return render(request, "room.html", {"room": room})
