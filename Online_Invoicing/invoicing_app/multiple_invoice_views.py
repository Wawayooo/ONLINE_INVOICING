from django.shortcuts import render, redirect
from django.utils import timezone
from .models import Room, Seller, Invoice, InvoiceItem

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Room, InvoiceItem, NegotiationHistory
from .serializers import InvoiceSerializer, RoomDetailSerializer

@api_view(['PUT'])
def seller_update_invoice(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)
    invoice = room.invoice

    serializer = InvoiceSerializer(invoice, data=request.data, partial=True)
    if serializer.is_valid():
        invoice = serializer.save()

        items_data = request.data.get('items')
        if items_data and isinstance(items_data, list):
            invoice.items.all().delete()
            for item in items_data:
                InvoiceItem.objects.create(
                    invoice=invoice,
                    product_name=item.get('product_name'),
                    description=item.get('description'),
                    quantity=item.get('quantity'),
                    unit_price=item.get('unit_price'),
                    line_total=float(item.get('quantity')) * float(item.get('unit_price'))
                )

        invoice.status = 'draft'
        invoice.save(update_fields=['status'])

        NegotiationHistory.objects.create(
            room=room,
            action='edited',
            actor='seller',
            notes='Invoice edited by seller'
        )

        room_serializer = RoomDetailSerializer(room, context={'request': request})
        return Response(room_serializer.data)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

def create_multiple_invoice(request):
    if request.method == "POST":
        room = Room.objects.create()

        seller = Seller.objects.create(
            room=room,
            fullname=request.POST.get("seller_fullname"),
            email=request.POST.get("seller_email"),
            phone=request.POST.get("seller_phone"),
            social_media=request.POST.get("seller_social_media"),
            profile_picture=request.FILES.get("seller_profile_picture"),
        )
        
        raw_secret = request.POST.get("seller_secret_key")
        if raw_secret:
            seller.set_secret_key(raw_secret)
            seller.save()
            
        invoice = Invoice.objects.create(
            room=room,
            invoice_date=request.POST.get("invoice_date") or timezone.now().date(),
            due_date=request.POST.get("due_date") or None,
            payment_method=request.POST.get("payment_method"),
            status=request.POST.get("status") or "draft",
            description="Multi-item invoice",
            quantity=0,
            unit_price=0,
            line_total=0,
        )

        items_count = int(request.POST.get("items-count", 0))
        for i in range(items_count):
            product_name = request.POST.get(f"items-{i}-product_name")
            description = request.POST.get(f"items-{i}-description")
            quantity = request.POST.get(f"items-{i}-quantity")
            unit_price = request.POST.get(f"items-{i}-unit_price")

            if product_name and quantity and unit_price:
                InvoiceItem.objects.create(
                    invoice=invoice,
                    product_name=product_name,
                    description=description,
                    quantity=int(quantity),
                    unit_price=float(unit_price),
                )

        return redirect("seller_room", room_hash=room.room_hash)

    return render(request, "seller_create_multiple_invoice_page.html")
  
