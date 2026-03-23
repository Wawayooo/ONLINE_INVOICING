"""
Serializers for Encrypted Invoice Records
"""
from rest_framework import serializers
from .models import EncryptedInvoiceRecord, Room


class EncryptedInvoiceRecordSerializer(serializers.ModelSerializer):
    """Serializer for encrypted invoice records"""
    room_hash = serializers.CharField(source='room.room_hash', read_only=True)
    
    class Meta:
        model = EncryptedInvoiceRecord
        fields = [
            'id',
            'room_hash',
            'encrypted_seller_data',
            'encrypted_buyer_data',
            'encrypted_invoice_data',
            'encrypted_items_data',
            'data_hash',
            'verification_signature',
            'finalized_at',
            'last_verified_at',
            'verification_count',
            'is_active',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'data_hash',
            'verification_signature',
            'finalized_at',
            'last_verified_at',
            'verification_count',
            'created_at',
        ]


class DecryptInvoiceSerializer(serializers.Serializer):
    """Serializer for decryption request"""
    room_hash = serializers.CharField(
        max_length=16,
        required=True,
        help_text="The room hash used to decrypt the invoice data"
    )
    
    def validate_room_hash(self, value):
        """Validate that the room hash exists"""
        if not value or len(value) != 16:
            raise serializers.ValidationError("Invalid room hash format")
        return value


class DecryptedInvoiceResponseSerializer(serializers.Serializer):
    """Serializer for decrypted invoice response"""
    success = serializers.BooleanField()
    message = serializers.CharField()
    data = serializers.DictField(required=False)
    seller = serializers.DictField(required=False)
    buyer = serializers.DictField(required=False)
    invoice = serializers.DictField(required=False)
    items = serializers.DictField(required=False)
    metadata = serializers.DictField(required=False)