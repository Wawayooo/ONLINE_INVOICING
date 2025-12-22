from rest_framework import serializers
from .models import Room, Seller, Buyer, Invoice, NegotiationHistory


# ===============================
# SELLER CREATES INVOICE
# ===============================
class CreateInvoiceSerializer(serializers.Serializer):
    # Seller info
    seller_fullname = serializers.CharField(max_length=255)
    seller_email = serializers.EmailField(required=False, allow_blank=True)
    seller_phone = serializers.CharField(required=False, allow_blank=True)
    seller_social_media = serializers.CharField(required=False, allow_blank=True)
    seller_profile_picture = serializers.ImageField(required=False, allow_null=True)

    # Invoice info
    invoice_date = serializers.DateField()
    due_date = serializers.DateField(required=False, allow_null=True)
    description = serializers.CharField()
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    payment_method = serializers.CharField(max_length=100)


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
# INVOICE SERIALIZER (EDIT)
# ===============================
class InvoiceSerializer(serializers.ModelSerializer):
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
    class Meta:
        model = Seller
        fields = [
            'fullname',
            'email',
            'phone',
            'social_media',
            'profile_picture',
        ]
        extra_kwargs = {
            'fullname': {'required': True},
            'email': {'required': True},
            'phone': {'required': True},
            'social_media': {'required': True},
            'profile_picture': {'required': True},
        }


# ===============================
# BUYER SERIALIZER
# ===============================
class BuyerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Buyer
        fields = ['fullname', 'email', 'phone', 'social_media', 'profile_picture']
        extra_kwargs = {
            'fullname': {'required': True},
            'email': {'required': True},
            'phone': {'required': True},
            'social_media': {'required': True},
            'profile_picture': {'required': True},
        }



# ===============================
# NEGOTIATION HISTORY
# ===============================
class NegotiationHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = NegotiationHistory
        fields = [
            'action',
            'actor',
            'notes',
            'created_at',
        ]


# ===============================
# ROOM DETAIL (MAIN RESPONSE)
# ===============================
class RoomDetailSerializer(serializers.ModelSerializer):
    seller = SellerSerializer(read_only=True)
    buyer = serializers.SerializerMethodField()
    invoice = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = ['room_hash', 'is_buyer_assigned', 'seller', 'buyer', 'invoice']

    def get_buyer(self, obj):
        if hasattr(obj, 'buyer'):
            return {
                "fullname": obj.buyer.fullname,
                "email": obj.buyer.email,
                "phone": obj.buyer.phone,
                "social_media": obj.buyer.social_media,
                "profile_picture": obj.buyer.profile_picture.url if obj.buyer.profile_picture else None,
            }
        return None

    def get_invoice(self, obj):
        if hasattr(obj, 'invoice'):
            return {
                "invoice_date": obj.invoice.invoice_date,
                "due_date": obj.invoice.due_date,
                "description": obj.invoice.description,
                "quantity": obj.invoice.quantity,
                "unit_price": str(obj.invoice.unit_price),
                "line_total": str(obj.invoice.line_total),
                "payment_method": obj.invoice.payment_method,
                "status": obj.invoice.status,
                "seller": SellerSerializer(obj.seller).data if hasattr(obj, 'seller') else None
            }
        return None

