from django.db import models

# Create your models here.

import uuid
from django.db import models

class Room(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

class Seller(models.Model):
    room = models.OneToOneField(Room, on_delete=models.CASCADE, related_name="seller")
    fullname = models.CharField(max_length=255)
    contact = models.CharField(max_length=255)
    profile_picture = models.ImageField(upload_to="profiles/sellers/", null=True, blank=True)

class Buyer(models.Model):
    room = models.OneToOneField(Room, on_delete=models.CASCADE, related_name="buyer")
    fullname = models.CharField(max_length=255)
    contact = models.CharField(max_length=255)
    profile_picture = models.ImageField(upload_to="profiles/buyers/", null=True, blank=True)

class Invoice(models.Model):
    room = models.OneToOneField(Room, on_delete=models.CASCADE, related_name="invoice")
    invoice_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    description = models.TextField()
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    line_total = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=50)
    status = models.CharField(max_length=50, default="Draft")
