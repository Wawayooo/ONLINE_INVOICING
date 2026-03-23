import json
import hashlib
import secrets
from base64 import b64encode, b64decode
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend


class InvoiceEncryption:   
    @staticmethod
    def _derive_key(room_hash: str, salt: bytes = None) -> tuple:
        if salt is None:
            salt = secrets.token_bytes(16)
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        key = b64encode(kdf.derive(room_hash.encode()))
        return key, salt
    
    @staticmethod
    def encrypt_data(data: dict, room_hash: str) -> str:
        try:
            json_data = json.dumps(data, default=str)
            
            key, salt = InvoiceEncryption._derive_key(room_hash)
            
            cipher = Fernet(key)
            
            encrypted = cipher.encrypt(json_data.encode())
            
            combined = salt + encrypted
            return b64encode(combined).decode('utf-8')
        
        except Exception as e:
            raise ValueError(f"Encryption failed: {str(e)}")
    
    @staticmethod
    def decrypt_data(encrypted_string: str, room_hash: str) -> dict:
        try:
            combined = b64decode(encrypted_string.encode('utf-8'))
            
            salt = combined[:16]
            encrypted = combined[16:]
            
            key, _ = InvoiceEncryption._derive_key(room_hash, salt)
            
            cipher = Fernet(key)
            
            decrypted = cipher.decrypt(encrypted)
            
            return json.loads(decrypted.decode('utf-8'))
        
        except Exception as e:
            raise ValueError(f"Decryption failed: Invalid room hash or corrupted data")
    
    @staticmethod
    def generate_signature(room_hash: str, data_hash: str) -> str:
        combined = f"{room_hash}:{data_hash}:{secrets.token_hex(16)}"
        return hashlib.sha256(combined.encode()).hexdigest()


def prepare_seller_data(seller):
    return {
        'fullname': seller.fullname,
        'email': seller.email or '',
        'phone': seller.phone or '',
        'social_media': seller.social_media or '',
        'profile_picture_url': seller.profile_picture.url if seller.profile_picture else '',
    }


def prepare_buyer_data(buyer):
    return {
        'fullname': buyer.fullname,
        'email': buyer.email or '',
        'phone': buyer.phone or '',
        'social_media': buyer.social_media or '',
        'profile_picture_url': buyer.profile_picture.url if buyer.profile_picture else '',
    }


def prepare_invoice_data(invoice):
    return {
        'invoice_date': str(invoice.invoice_date),
        'due_date': str(invoice.due_date) if invoice.due_date else '',
        'description': invoice.description,
        'quantity': invoice.quantity,
        'unit_price': str(invoice.unit_price),
        'line_total': str(invoice.line_total),
        'payment_method': invoice.payment_method,
        'status': invoice.status,
        'buyer_approved_at': str(invoice.buyer_approved_at) if invoice.buyer_approved_at else '',
        'buyer_paid_at': str(invoice.buyer_paid_at) if invoice.buyer_paid_at else '',
        'seller_confirmed_at': str(invoice.seller_confirmed_at) if invoice.seller_confirmed_at else '',
    }


def prepare_items_data(invoice):
    items = []
    for item in invoice.items.all():
        items.append({
            'product_name': item.product_name,
            'description': item.description or '',
            'quantity': item.quantity,
            'unit_price': str(item.unit_price),
            'line_total': str(item.line_total),
        })
    
    if not items:
        items = [{
            'product_name': invoice.description,
            'description': '',
            'quantity': invoice.quantity,
            'unit_price': str(invoice.unit_price),
            'line_total': str(invoice.line_total),
        }]
    
    return {'items': items, 'total_amount': str(invoice.total_amount() if invoice.items.exists() else invoice.line_total)}
