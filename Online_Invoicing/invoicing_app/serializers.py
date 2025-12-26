from rest_framework import serializers
from .models import Room, Seller, Buyer, Invoice, NegotiationHistory, InvoiceItem

# ===============================
# SELLER CREATES INVOICE
# ===============================
class CreateInvoiceSerializer(serializers.Serializer):
    seller_fullname = serializers.CharField(max_length=255)
    seller_email = serializers.EmailField(required=False, allow_blank=True)
    seller_phone = serializers.CharField(required=False, allow_blank=True)
    seller_social_media = serializers.CharField(required=False, allow_blank=True)
    seller_profile_picture = serializers.ImageField(required=False, allow_null=True)

    # 🔑 Secret key fields
    seller_secret_key = serializers.CharField(write_only=True)
    seller_secret_key_confirm = serializers.CharField(write_only=True)

    invoice_date = serializers.DateField()
    due_date = serializers.DateField(required=False, allow_null=True)
    description = serializers.CharField()
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    payment_method = serializers.CharField(max_length=100)

    def validate(self, data):
        # Check secret key strength
        import re
        strong_regex = re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$')
        if not strong_regex.match(data['seller_secret_key']):
            raise serializers.ValidationError({
                "seller_secret_key": "Secret key must be at least 8 characters and include uppercase, lowercase, number, and special character."
            })

        # Check confirmation
        if data['seller_secret_key'] != data['seller_secret_key_confirm']:
            raise serializers.ValidationError({
                "seller_secret_key_confirm": "Secret key confirmation does not match."
            })

        return data

# ===============================
# BUYER JOINS ROOM
# ===============================
class BuyerJoinSerializer(serializers.Serializer):
    fullname = serializers.CharField(max_length=255)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    social_media = serializers.CharField(required=False, allow_blank=True)
    profile_picture = serializers.ImageField(required=False, allow_null=True)


# ===============================
# INVOICE SERIALIZER
# ===============================
# =============MULTI INVOICE SERIALIZER==================

class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = ['id', 'product_name', 'description', 'quantity', 'unit_price', 'line_total']
        read_only_fields = ['line_total']


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True)  # ✅ make writable
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'invoice_date',
            'due_date',
            'description',
            'payment_method',
            'status',
            'items',
            'total_amount',
        ]
        read_only_fields = ['status']

    def get_total_amount(self, obj):
        return sum(item.line_total for item in obj.items.all())

    def update(self, instance, validated_data):
        # Pop out items data
        items_data = validated_data.pop('items', None)

        # Update invoice fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update items if provided
        if items_data is not None:
            # Clear existing items and recreate (simplest approach)
            instance.items.all().delete()
            for item_data in items_data:
                InvoiceItem.objects.create(invoice=instance, **item_data)

        return instance

    
# =============SINGLE INVOICE SERIALIZER==================

class SingleInvoiceSerializer(serializers.ModelSerializer):
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'invoice_date',
            'due_date',
            'description',
            'quantity',
            'unit_price',
            'payment_method',
            'status',
            'total_amount',
        ]
        read_only_fields = ['status']

    def get_total_amount(self, obj):
        return obj.quantity * obj.unit_price


# ===============================
# SELLER SERIALIZER
# ===============================        

class SellerSerializer(serializers.ModelSerializer):
    profile_picture = serializers.ImageField(use_url=True)

    class Meta:
        model = Seller
        fields = ['fullname', 'email', 'phone', 'social_media', 'profile_picture']



# ===============================
# BUYER SERIALIZER
# ===============================
class BuyerSerializer(serializers.ModelSerializer):
    profile_picture = serializers.ImageField(use_url=True)
    class Meta:
        model = Buyer
        fields = ['buyer_hash', 'fullname', 'email', 'phone', 'social_media', 'profile_picture']


# ===============================
# NEGOTIATION HISTORY
# ===============================
class NegotiationHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = NegotiationHistory
        fields = ['action', 'actor', 'notes', 'created_at']


# ===============================
# ROOM DETAIL (MAIN RESPONSE)
# ===============================

class RoomDetailSerializer(serializers.ModelSerializer):
    seller = SellerSerializer(read_only=True)
    buyer = BuyerSerializer(read_only=True)
    history = NegotiationHistorySerializer(many=True, read_only=True)

    class Meta:
        model = Room
        fields = ['room_hash', 'is_buyer_assigned', 'seller', 'buyer', 'invoice', 'history']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        invoice = instance.invoice
        if invoice.description.strip().lower() == "multi-item invoice":
            data['invoice'] = InvoiceSerializer(invoice).data
            #print(f"Invoice: {data['invoice']}")
        else:
            data['invoice'] = SingleInvoiceSerializer(invoice).data
            #print(f"Invoice: {data['invoice']}")
        return data