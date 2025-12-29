from django.urls import path
from . import views, multiple_invoice_views

urlpatterns = [
    #primary pages
    path('', views.landing_page, name='landing'),
    path('seller/create/', views.seller_create_page, name='seller_create'),
    
    # Multiple Invoice
    path("invoice/create/", multiple_invoice_views.create_multiple_invoice, name="create_multiple_invoice"),
    path('api/seller/<str:room_hash>/update-invoice/', multiple_invoice_views.seller_update_invoice, name='seller_update_invoice'),
    
    # Seller endpoints
    path('seller_room/<str:room_hash>/', views.seller_room_view, name='seller_room'),
    path("seller_authenticate/", views.seller_authenticate_view, name="seller_authenticate"),

    path("seller_room_authenticate/", views.seller_room_authenticate_view, name="seller_room_authenticate"),
    
    path('api/invoice/create/', views.create_invoice, name='create_invoice'),
    path('api/room/<str:room_hash>/', views.get_room, name='get_room'),
    path('api/room/<str:room_hash>/start-negotiation/', views.seller_start_negotiation, name='start_negotiation'),
    
    path('api/seller/<str:room_hash>/edit-invoice/', views.seller_edit_invoice, name='seller_edit_invoice'),
    path('api/seller/<str:room_hash>/edit-single-invoice/', views.seller_edit_single_invoice, name='seller_edit_single_invoice'),

    
    path('api/seller/<str:room_hash>/confirm-payment/', views.seller_confirm_payment, name='seller_confirm_payment'),
    
    # Buyer join page
    path('buyer_room/<str:room_hash>/', views.buyer_room_view, name='buyer_room'),

    # Buyer invoice page (requires both hashes)
    path('buyer_invoice_room/<str:room_hash>/<str:buyer_hash>/',
         views.buyer_invoice_room_view,
         name='buyer_invoice_room'),

    # Buyer API endpoints
    path('api/buyer/join/<str:room_hash>/', views.buyer_join_room, name='buyer_join_room'),
    path('api/buyer/<str:room_hash>/approve/', views.buyer_approve_invoice, name='buyer_approve'),
    path('api/buyer/<str:room_hash>/disapprove/', views.buyer_disapprove_invoice, name='buyer_disapprove'),
    path('api/buyer/<str:room_hash>/mark-paid/', views.buyer_mark_paid, name='buyer_mark_paid'),
    
    path('proof_transaction/<str:room_hash>/', views.proof_transaction_view, name='proof_transaction_view'),
    
    # Verification and download
    path('api/invoice/verify/<str:room_hash>/', views.verify_invoice, name='verify_invoice'),
    path('api/invoice/<str:room_hash>/download/', views.download_invoice_pdf, name='download_invoice'),
    path('api/invoice/update/<str:room_hash>/', views.update_invoice, name='update_invoice'),    
    
    # Download PDF
    path('proof_transaction/<str:room_hash>/pdf/', views.proof_of_transaction_pdf, name='proof_of_transaction_pdf'),
    
    # for database management during development
    path('alldata/', views.all_data_view, name='all_data'),
    path('alldata/delete/<uuid:room_id>/', views.delete_room, name='delete_room'),
]

