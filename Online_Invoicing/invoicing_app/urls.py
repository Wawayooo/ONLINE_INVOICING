from django.urls import path
from . import views

urlpatterns = [
    #primary pages
    path('', views.landing_page, name='landing'),
    path('seller/create/', views.seller_create_page, name='seller_create'),
    
    # Seller endpoints
    path('seller_room/', views.seller_room_view, name='seller_room'),
    path('api/invoice/create/', views.create_invoice, name='create_invoice'),
    path('api/room/<str:room_hash>/', views.get_room, name='get_room'),
    path('api/room/<str:room_hash>/start-negotiation/', views.seller_start_negotiation, name='start_negotiation'),
    path('api/seller/<str:room_hash>/edit-invoice/', views.seller_edit_invoice, name='seller_edit_invoice'),
    path('api/seller/<str:room_hash>/confirm-payment/', views.seller_confirm_payment, name='seller_confirm_payment'),
    
    # Buyer endpoints
    path('buyer_room/', views.buyer_room_view, name='buyer_room'),
    path('api/buyer/join/<str:room_hash>/', views.buyer_join_room, name='buyer_join_room'),
    path('api/buyer/<str:room_hash>/approve/', views.buyer_approve_invoice, name='buyer_approve'),
    path('api/buyer/<str:room_hash>/disapprove/', views.buyer_disapprove_invoice, name='buyer_disapprove'),
    path('api/buyer/<str:room_hash>/mark-paid/', views.buyer_mark_paid, name='buyer_mark_paid'),
    
    # Verification and download
    path('api/invoice/verify/<str:room_hash>/', views.verify_invoice, name='verify_invoice'),
    path('api/invoice/<str:room_hash>/download/', views.download_invoice_pdf, name='download_invoice'),
    path('api/invoice/update/<str:room_hash>/', views.update_invoice, name='update_invoice'),    
    
    # for database management during development
    path('alldata/', views.all_data_view, name='all_data'),
    path('alldata/delete/<uuid:room_id>/', views.delete_room, name='delete_room'),
]

