import uuid
import hashlib
import secrets
from django.db import models
from django.utils import timezone
from django.db import models
from django.contrib.auth.hashers import make_password, check_password
import secrets

from django.contrib.auth.hashers import make_password, check_password
from django.db import models

def generate_room_hash():
    """Generate a unique irreversible hashed room ID"""
    unique_string = f"{uuid.uuid4()}{secrets.token_hex(16)}{timezone.now().isoformat()}"
    return hashlib.sha256(unique_string.encode()).hexdigest()[:16]

def generate_buyer_room_hash():
    """Generate a unique irreversible hashed room ID"""
    unique_string = f"{uuid.uuid4()}{secrets.token_hex(16)}{timezone.now().isoformat()}"
    return hashlib.sha256(unique_string.encode()).hexdigest()[:16]

def generate_verification_key():
    """Generate a unique verification key for invoice access"""
    return secrets.token_urlsafe(32)

class Room(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room_hash = models.CharField(max_length=16, unique=True, editable=False)
    seller_hash = models.CharField(max_length=255, unique=True, null=True, blank=True)
    verification_key = models.CharField(max_length=64, unique=True, editable=False)
    is_buyer_assigned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.room_hash:
            self.room_hash = generate_room_hash()
        if not self.verification_key:
            self.verification_key = generate_verification_key()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Room {self.room_hash}"

class Seller(models.Model):
    room = models.OneToOneField(Room, on_delete=models.CASCADE, related_name="seller")
    fullname = models.CharField(max_length=255)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    social_media = models.CharField(max_length=255, null=True, blank=True)
    profile_picture = models.ImageField(upload_to="profiles/sellers/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Hashed secret key
    secret_key = models.CharField(max_length=255, null=True, blank=True)

    def set_secret_key(self, raw_key: str):
        hashed = make_password(raw_key)
        self.secret_key = hashed
        if self.room_id:
            self.room.seller_hash = hashed
            self.room.save(update_fields=["seller_hash"])

    def check_secret_key(self, raw_key: str) -> bool:
        """Verify the seller's secret key against the stored hash."""
        if not self.secret_key:
            return False
        return check_password(raw_key, self.secret_key)

    def __str__(self):
        return f"Seller: {self.fullname}"

class Buyer(models.Model):
    room = models.OneToOneField(Room, on_delete=models.CASCADE, related_name="buyer")
    fullname = models.CharField(max_length=255)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    social_media = models.CharField(max_length=255, null=True, blank=True)
    profile_picture = models.ImageField(upload_to="profiles/buyers/", null=True, blank=True)
    buyer_hash = models.CharField(max_length=16, unique=True, default=generate_buyer_room_hash)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Buyer: {self.fullname}"

class Invoice(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('negotiating', 'Negotiating'),
        ('pending', 'Pending Invoice'),
        ('unconfirmed_payment', 'Unconfirmed Payment Invoice'),
        ('finalized', 'Finalized Paid Invoice'),
        ('rejected', 'Rejected'),
    ]

    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('gcash', 'GCash'),
        ('paypal', 'PayPal'),
        ('bank_transfer', 'Bank Transfer'),
        ('other', 'Other'),
    ]

    room = models.OneToOneField(Room, on_delete=models.CASCADE, related_name="invoice")
    invoice_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    description = models.TextField()
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    line_total = models.DecimalField(max_digits=10, decimal_places=2, editable=False)
    payment_method = models.CharField(max_length=50, choices=PAYMENT_METHOD_CHOICES)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='draft')
    
    # Tracking fields
    buyer_approved_at = models.DateTimeField(null=True, blank=True)
    buyer_paid_at = models.DateTimeField(null=True, blank=True)
    seller_confirmed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Auto-calculate line total
        self.line_total = self.quantity * self.unit_price
        super().save(*args, **kwargs)
        
    def total_amount(self): 
        """Sum of all line items""" 
        return sum(item.line_total for item in self.items.all())

    def __str__(self):
        return f"Invoice for Room {self.room.room_hash} - {self.status}"
    
class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="items")
    product_name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    line_total = models.DecimalField(max_digits=10, decimal_places=2, editable=False)

    def save(self, *args, **kwargs):
        self.line_total = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product_name} ({self.quantity} x {self.unit_price})"

class NegotiationHistory(models.Model):
    ACTION_CHOICES = [
        ('created', 'Invoice Created'),
        ('edited', 'Invoice Edited'),
        ('approved', 'Buyer Approved'),
        ('disapproved', 'Buyer Disapproved'),
        ('paid', 'Buyer Marked as Paid'),
        ('confirmed', 'Seller Confirmed Payment'),
    ]

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="history")
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    actor = models.CharField(max_length=10)  # 'seller' or 'buyer'
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.actor} - {self.action} at {self.created_at}"