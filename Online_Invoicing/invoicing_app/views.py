from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.http import HttpResponse
from .models import Room, Seller, Buyer, Invoice, NegotiationHistory
from .serializers import (
    RoomDetailSerializer, CreateInvoiceSerializer, 
    BuyerJoinSerializer, InvoiceSerializer, SingleInvoiceSerializer
)

import uuid, secrets, hashlib
from decimal import Decimal
from django.utils import timezone

from django.views.decorators.csrf import csrf_exempt

from django.shortcuts import redirect, render
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from django.http import HttpResponse
from .reports.proof_transactions import build_proof_transaction_pdf
from django.contrib.auth.hashers import check_password, make_password

from decimal import Decimal, InvalidOperation
from django.db import transaction


def landing_page(request):
    return render(request, 'pages/landing_page.html')

def seller_create_page(request):
    return render(request, 'pages/seller_create_page.html')

@csrf_exempt
@api_view(['POST'])
def create_invoice(request):
    serializer = CreateInvoiceSerializer(data=request.data)
    if serializer.is_valid():
        data = serializer.validated_data

        room = Room.objects.create()

        seller = Seller(
            room=room,
            fullname=data['seller_fullname'],
            email=data.get('seller_email', ''),
            phone=data.get('seller_phone', ''),
            social_media=data.get('seller_social_media', ''),
            profile_picture=data.get('seller_profile_picture')
        )
        seller.set_secret_key(data['seller_secret_key'])
        seller.save()

        invoice = Invoice.objects.create(
            room=room,
            invoice_date=data['invoice_date'],
            due_date=data.get('due_date'),
            description=data['description'],
            quantity=data['quantity'],
            unit_price=data['unit_price'],
            payment_method=data['payment_method'],
            status='draft'
        )

        NegotiationHistory.objects.create(
            room=room,
            action='created',
            actor='seller',
            notes='Invoice created'
        )

        room_serializer = RoomDetailSerializer(room, context={'request': request})
        return Response({
            **room_serializer.data,
            "message": "Invoice created successfully",
            "room_hash": room.room_hash,   
            "seller_hash": room.seller_hash,  
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def get_room(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)
    serializer = RoomDetailSerializer(room, context={'request': request})
    return Response(serializer.data)

def seller_room_view(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)
    return render(request, 'seller_room.html', {
        'room_hash': room_hash,
        'room': room
    })

@api_view(['POST'])
def seller_start_negotiation(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)
    
    if not hasattr(room, 'seller'):
        return Response({'error': 'Seller not found'}, status=status.HTTP_404_NOT_FOUND)
    
    invoice = room.invoice
    invoice.status = 'negotiating'
    invoice.save()
    
    NegotiationHistory.objects.create(
        room=room,
        action='edited',
        actor='seller',
        notes='Negotiation started'
    )
    
    serializer = RoomDetailSerializer(room, context={'request': request})
    return Response(serializer.data)

from django.shortcuts import get_object_or_404, render
from .models import Room, Buyer

def buyer_room_view(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)
    return render(request, 'buyer_room.html', {
        'room_hash': room_hash
    })

def proof_of_transaction_pdf(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)
    serializer = RoomDetailSerializer(room)

    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="proof_transaction_{room.room_hash}.pdf"'

    return build_proof_transaction_pdf(response, serializer.data)

def buyer_invoice_room_view(request, room_hash, buyer_hash):
    room = get_object_or_404(Room, room_hash=room_hash)
    buyer = getattr(room, 'buyer', None)

    if not buyer or buyer.buyer_hash != buyer_hash:
        return render(request, 'buyer_invoice_room.html', {
            'room_hash': room_hash,
            'buyer_hash': buyer_hash,
            'unauthorized': True,
            'room': None
        })

    if room.invoice and room.invoice.status == 'finalized':
        return redirect('proof_transaction_view', room_hash=room_hash)

    return render(request, 'buyer_invoice_room.html', {
        'room_hash': room_hash,
        'buyer_hash': buyer_hash,
        'unauthorized': False,
        'room': room
    })
    
def proof_transaction_view(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)
    buyer = getattr(room, 'buyer', None)
     
    context = {
        'room_hash': room_hash,
        'buyer_hash': buyer.buyer_hash,
        'seller': room.seller,
        'buyer': room.buyer,
        'invoice': room.invoice,
        'shareable_link': request.build_absolute_uri(),
    }
    return render(request, 'proof_transaction.html', context)



def generate_buyer_room_hash():
    """Generate a unique irreversible hashed buyer ID"""
    unique_string = f"{uuid.uuid4()}{secrets.token_hex(16)}{timezone.now().isoformat()}"
    return hashlib.sha256(unique_string.encode()).hexdigest()[:16]

@csrf_exempt
@api_view(['POST'])
def buyer_join_room(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)

    if room.is_buyer_assigned:
        return Response(
            {'error': 'This room already has a buyer assigned'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = BuyerJoinSerializer(data=request.data)
    if serializer.is_valid():
        data = serializer.validated_data

        buyer = Buyer.objects.create(
            room=room,
            fullname=data['fullname'],
            email=data.get('email', ''),
            phone=data.get('phone', ''),
            social_media=data.get('social_media', ''),
            profile_picture=data.get('profile_picture'),
            buyer_hash=generate_buyer_room_hash()
        )

        room.is_buyer_assigned = True
        room.save()

        room_serializer = RoomDetailSerializer(room, context={'request': request})

        return Response({
            'room': room_serializer.data,
            'buyer_hash': buyer.buyer_hash,
            'redirect_url': f"/buyer_invoice_room/{room.room_hash}/{buyer.buyer_hash}/"
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


import logging
logger = logging.getLogger(__name__)

@require_http_methods(["POST"])
def seller_authenticate_view(request):
    raw_secret_key = request.POST.get("secret_key")
    if not raw_secret_key:
        return JsonResponse({"success": False, "error": "Secret key is required"}, status=400)

    try:
        from .models import Seller
        sellers = Seller.objects.exclude(secret_key__isnull=True)

        for seller in sellers:
            if check_password(raw_secret_key, seller.secret_key):
                request.session['authenticated_seller_id'] = seller.id
                logger.info(f"✓ Secret key authenticated: {seller.fullname}")

                return JsonResponse({
                    "success": True,
                    "next_step": "room_hash_required"
                })

        logger.warning("✗ Invalid secret key attempt")
        return JsonResponse({"success": False, "error": "Invalid secret key"}, status=401)

    except Exception as e:
        logger.exception(f"Authentication error: {str(e)}")
        return JsonResponse({"success": False, "error": "Server error occurred"}, status=500)
    
@require_http_methods(["POST"])
def seller_room_authenticate_view(request):
    room_hash = request.POST.get("room_hash")
    seller_id = request.session.get("authenticated_seller_id")

    if not seller_id:
        return JsonResponse({"success": False, "error": "No seller authenticated"}, status=403)
    if not room_hash:
        return JsonResponse({"success": False, "error": "Room hash is required"}, status=400)

    try:
        from .models import Seller
        seller = Seller.objects.select_related('room').filter(id=seller_id, room__room_hash=room_hash).first()

        if seller:
            request.session['authenticated_room_hash'] = room_hash
            logger.info(f"✓ Room hash verified for seller: {seller.fullname}")
            return JsonResponse({"success": True, "redirect_url": f"/seller_room/{room_hash}/"})

        logger.warning("✗ Invalid room hash attempt")
        return JsonResponse({"success": False, "error": "Invalid room hash"}, status=401)

    except Exception as e:
        logger.exception(f"Room authentication error: {str(e)}")
        return JsonResponse({"success": False, "error": "Server error occurred"}, status=500)

@api_view(['POST'])
def buyer_approve_invoice(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)
    buyer = getattr(room, 'buyer', None)

    if not buyer or request.data.get('buyer_hash') != buyer.buyer_hash:
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    invoice = room.invoice
    if invoice.status != 'draft':
        return Response({'error': 'Invoice not in draft state'}, status=status.HTTP_400_BAD_REQUEST)

    invoice.status = 'pending'
    invoice.buyer_approved_at = timezone.now()
    invoice.save()

    NegotiationHistory.objects.create(
        room=room,
        action='approved',
        actor='buyer',
        notes=f'Invoice {invoice.id} approved by {buyer.fullname}'
    )

    serializer = RoomDetailSerializer(room, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
def buyer_disapprove_invoice(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)
    buyer = getattr(room, 'buyer', None)

    if not buyer or request.data.get('buyer_hash') != buyer.buyer_hash:
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    notes = request.data.get('notes', 'Buyer disapproved')

    invoice = room.invoice
    invoice.status = 'negotiating'
    invoice.save()

    NegotiationHistory.objects.create(
        room=room,
        action='disapproved',
        actor='buyer',
        notes=notes
    )

    serializer = RoomDetailSerializer(room, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
def buyer_mark_paid(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)
    buyer = getattr(room, 'buyer', None)

    if not buyer or request.data.get('buyer_hash') != buyer.buyer_hash:
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    invoice = room.invoice
    if invoice.status != 'pending':
        return Response({'error': 'Invoice must be in pending status'}, status=status.HTTP_400_BAD_REQUEST)

    invoice.status = 'unconfirmed_payment'
    invoice.buyer_paid_at = timezone.now()
    invoice.save()

    NegotiationHistory.objects.create(
        room=room,
        action='paid',
        actor='buyer',
        notes=f'Buyer {buyer.fullname} marked invoice as paid'
    )

    serializer = RoomDetailSerializer(room, context={'request': request})
    return Response(serializer.data)

@api_view(['PUT'])
def seller_edit_invoice(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)
    invoice = room.invoice
    data = request.data or {}

    if 'items' in data and isinstance(data['items'], list):
        serializer = InvoiceSerializer(invoice, data=data, partial=True)
    else:
        serializer = SingleInvoiceSerializer(invoice, data=data, partial=True)

    if serializer.is_valid():
        with transaction.atomic():
            invoice = serializer.save()
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


@api_view(['PUT'])
def seller_edit_single_invoice(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)
    invoice = room.invoice
    data = request.data or {}

    def to_int(val):
        try:
            return int(val)
        except (TypeError, ValueError):
            return None

    def to_decimal(val):
        try:
            return Decimal(str(val))
        except (TypeError, InvalidOperation, ValueError):
            return None

    allowed = ['invoice_date', 'due_date', 'description', 'quantity', 'unit_price', 'payment_method']
    updated = False

    with transaction.atomic():
        for key in allowed:
            if key in data:
                if key == 'quantity':
                    coerced = to_int(data.get(key))
                    if coerced is None:
                        return Response({key: ['Invalid integer value']}, status=status.HTTP_400_BAD_REQUEST)
                    setattr(invoice, key, coerced)
                elif key == 'unit_price':
                    coerced = to_decimal(data.get(key))
                    if coerced is None:
                        return Response({key: ['Invalid decimal value']}, status=status.HTTP_400_BAD_REQUEST)
                    setattr(invoice, key, coerced)
                else:
                    setattr(invoice, key, data.get(key))
                updated = True

        if updated:
            invoice.status = 'draft'
            invoice.save()
            NegotiationHistory.objects.create(
                room=room,
                action='edited',
                actor='seller',
                notes='Invoice edited by seller (single-item)'
            )

    room_serializer = RoomDetailSerializer(room, context={'request': request})
    return Response(room_serializer.data)



@api_view(['POST'])
def buyer_mark_paid(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)
    invoice = room.invoice
    
    if invoice.status != 'pending':
        return Response(
            {'error': 'Invoice must be in pending status'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    invoice.status = 'unconfirmed_payment'
    invoice.buyer_paid_at = timezone.now()
    invoice.save()
    
    NegotiationHistory.objects.create(
        room=room,
        action='paid',
        actor='buyer',
        notes='Buyer marked as paid'
    )
    
    serializer = RoomDetailSerializer(room, context={'request': request})
    return Response(serializer.data)

@api_view(['POST'])
def seller_confirm_payment(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)
    invoice = room.invoice
    
    if invoice.status != 'unconfirmed_payment':
        return Response(
            {'error': 'Invoice must be in unconfirmed payment status'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    invoice.status = 'finalized'
    invoice.seller_confirmed_at = timezone.now()
    invoice.save()
    
    NegotiationHistory.objects.create(
        room=room,
        action='confirmed',
        actor='seller',
        notes='Seller confirmed payment received'
    )
    
    serializer = RoomDetailSerializer(room, context={'request': request})
    return Response({
        "success": True,
        "invoice_status": invoice.status,
        "redirect_url": f"/proof_transaction/{room.room_hash}/",
        "room": serializer.data
    })


from decimal import Decimal

@api_view(['POST'])
def update_invoice(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)

    if not hasattr(room, 'invoice'):
        return Response({'error': 'No invoice found for this room'}, status=status.HTTP_404_NOT_FOUND)

    invoice = room.invoice

    try:
        if 'invoice_date' in request.data:
            invoice.invoice_date = request.data['invoice_date']
        if 'due_date' in request.data:
            invoice.due_date = request.data['due_date']
        if 'description' in request.data:
            invoice.description = request.data['description']
        if 'quantity' in request.data:
            invoice.quantity = int(request.data['quantity'])
        if 'unit_price' in request.data:
            invoice.unit_price = Decimal(request.data['unit_price'])
        if 'payment_method' in request.data:
            invoice.payment_method = request.data['payment_method']

        invoice.status = 'draft'
        invoice.save()

        serializer = RoomDetailSerializer(room, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def verify_invoice(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)
    verification_key = request.query_params.get('key')
    
    if not verification_key or verification_key != room.verification_key:
        return Response(
            {'error': 'Invalid verification key'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    serializer = RoomDetailSerializer(room, context={'request': request})
    return Response(serializer.data)

@api_view(['GET'])
def download_invoice_pdf(request, room_hash):
    room = get_object_or_404(Room, room_hash=room_hash)
    
    if room.invoice.status != 'finalized':
        return Response(
            {'error': 'Invoice must be finalized'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    return Response({
        'message': 'PDF generation not implemented yet',
        'room_hash': room_hash,
        'verification_key': room.verification_key
    })
    
    
    
    
    
    
    
    
    
    
    
    
    
    

from django.shortcuts import render, get_object_or_404, redirect
from django.views.decorators.http import require_POST
from .models import Room, Seller, Buyer, Invoice, NegotiationHistory

def all_data_view(request):
    rooms = Room.objects.all().select_related('seller', 'buyer', 'invoice')
    return render(request, 'alldata.html', {'rooms': rooms})

@require_POST
def delete_room(request, room_id):
    room = get_object_or_404(Room, id=room_id)
    room.delete()
    return redirect('all_data')




