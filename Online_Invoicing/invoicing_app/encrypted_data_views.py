"""
Views for Encrypted Invoice Records
"""
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
import json

from .models import Room, Invoice, Seller, Buyer, EncryptedInvoiceRecord
from .encryption_utils import (
    InvoiceEncryption,
    prepare_seller_data,
    prepare_buyer_data,
    prepare_invoice_data,
    prepare_items_data,
)
from .encrypted_data_serializers import (
    EncryptedInvoiceRecordSerializer,
    DecryptInvoiceSerializer,
    DecryptedInvoiceResponseSerializer,
)

@csrf_exempt
@transaction.atomic
def create_encrypted_invoice(request, room_hash):
    try:
        room = get_object_or_404(Room, room_hash=room_hash)
        invoice = get_object_or_404(Invoice, room=room, status='finalized')
        seller = get_object_or_404(Seller, room=room)
        buyer = get_object_or_404(Buyer, room=room)
        
        if hasattr(room, 'encrypted_invoice'):
            return JsonResponse({
                'success': False,
                'message': 'Encrypted invoice already exists for this room',
                'encrypted_invoice_id': str(room.encrypted_invoice.id)
            }, status=400)
        
        seller_data = prepare_seller_data(seller)
        buyer_data = prepare_buyer_data(buyer)
        invoice_data = prepare_invoice_data(invoice)
        items_data = prepare_items_data(invoice)
        
        encrypted_seller = InvoiceEncryption.encrypt_data(seller_data, room_hash)
        encrypted_buyer = InvoiceEncryption.encrypt_data(buyer_data, room_hash)
        encrypted_invoice = InvoiceEncryption.encrypt_data(invoice_data, room_hash)
        encrypted_items = InvoiceEncryption.encrypt_data(items_data, room_hash)
        
        encrypted_record = EncryptedInvoiceRecord.objects.create(
            room=room,
            encrypted_seller_data=encrypted_seller,
            encrypted_buyer_data=encrypted_buyer,
            encrypted_invoice_data=encrypted_invoice,
            encrypted_items_data=encrypted_items,
        )
        
        encrypted_record.data_hash = encrypted_record.generate_data_hash()
        
        encrypted_record.verification_signature = InvoiceEncryption.generate_signature(
            room_hash,
            encrypted_record.data_hash
        )
        
        encrypted_record.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Invoice encrypted and stored successfully',
            'encrypted_invoice_id': str(encrypted_record.id),
            'room_hash': room_hash,
            'finalized_at': encrypted_record.finalized_at.isoformat(),
        })
    
    except Invoice.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'Invoice not found or not finalized'
        }, status=404)
    
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Error creating encrypted invoice: {str(e)}'
        }, status=500)
        

def view_encrypted_invoice(request, id):
    try:
        room = get_object_or_404(Room, id=id) 
        encrypted_record = get_object_or_404(EncryptedInvoiceRecord, room=room)

        context = {
            'room_id': str(room.id),  
            'room_hash': room.room_hash,  
            'encrypted_record': encrypted_record,
            'encrypted_data': {
                'seller': (encrypted_record.encrypted_seller_data or '')[:50] + '...',
                'buyer': (encrypted_record.encrypted_buyer_data or '')[:50] + '...',
                'invoice': (encrypted_record.encrypted_invoice_data or '')[:50] + '...',
                'items': (encrypted_record.encrypted_items_data or '')[:50] + '...',
            },
            'data_hash': encrypted_record.data_hash,
            'verification_signature': encrypted_record.verification_signature,
            'finalized_at': encrypted_record.finalized_at,
            'verification_count': encrypted_record.verification_count,

            'history': room.history.all(),
            'multi_item_history': room.multi_item_history.all(),
        }

        return render(request, 'encrypted_data.html', context)

    except EncryptedInvoiceRecord.DoesNotExist:
        return render(request, 'encrypted_invoice_not_found.html', {
            'room_id': str(id),
            'message': 'No encrypted invoice found for this room'
        })
    except Exception as e:
        return render(request, 'error.html', {'error': str(e)})


@api_view(['POST'])
def decrypt_invoice_api(request, room_hash):
    try:
        room = get_object_or_404(Room, room_hash=room_hash)
        encrypted_record = get_object_or_404(EncryptedInvoiceRecord, room=room)
        
        serializer = DecryptInvoiceSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Invalid request data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user_room_hash = serializer.validated_data['room_hash']
        
        if user_room_hash != room_hash:
            return Response({
                'success': False,
                'message': 'Invalid room hash - authentication failed'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        if not encrypted_record.verify_integrity():
            return Response({
                'success': False,
                'message': 'Data integrity check failed - data may have been tampered with'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            seller_data = InvoiceEncryption.decrypt_data(
                encrypted_record.encrypted_seller_data,
                user_room_hash
            )
            buyer_data = InvoiceEncryption.decrypt_data(
                encrypted_record.encrypted_buyer_data,
                user_room_hash
            )
            invoice_data = InvoiceEncryption.decrypt_data(
                encrypted_record.encrypted_invoice_data,
                user_room_hash
            )
            items_data = InvoiceEncryption.decrypt_data(
                encrypted_record.encrypted_items_data,
                user_room_hash
            )
            
            encrypted_record.increment_verification()
            
            return Response({
                'success': True,
                'message': 'Invoice decrypted successfully',
                'seller': seller_data,
                'buyer': buyer_data,
                'invoice': invoice_data,
                'items': items_data,
                'metadata': {
                    'finalized_at': encrypted_record.finalized_at.isoformat(),
                    'verification_count': encrypted_record.verification_count,
                    'last_verified_at': encrypted_record.last_verified_at.isoformat() if encrypted_record.last_verified_at else None,
                    'data_hash': encrypted_record.data_hash,
                }
            })
        
        except ValueError as e:
            return Response({
                'success': False,
                'message': 'Decryption failed - invalid room hash or corrupted data'
            }, status=status.HTTP_401_UNAUTHORIZED)
    
    except EncryptedInvoiceRecord.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Encrypted invoice not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error processing request: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@require_http_methods(["GET"])
def encrypted_invoice_status(request, room_hash):
    try:
        room = get_object_or_404(Room, room_hash=room_hash)
        
        if hasattr(room, 'encrypted_invoice'):
            encrypted_record = room.encrypted_invoice
            return JsonResponse({
                'exists': True,
                'encrypted_invoice_id': str(encrypted_record.id),
                'finalized_at': encrypted_record.finalized_at.isoformat(),
                'verification_count': encrypted_record.verification_count,
                'is_active': encrypted_record.is_active,
            })
        else:
            return JsonResponse({
                'exists': False,
                'message': 'No encrypted invoice found for this room'
            })
    
    except Room.DoesNotExist:
        return JsonResponse({
            'exists': False,
            'message': 'Room not found'
        }, status=404)