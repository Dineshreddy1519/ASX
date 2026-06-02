import razorpay
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Booking

class CreateOrderView(APIView):
    def post(self, request):
        data = request.data
        amount = int(data.get('amount', 0))
        pay_mode = data.get('pay_mode', 'secure') # Now defaults to secure
        
        try:
            # ==========================================
            # PATH A: PAY ON SPOT (BYPASS GATEWAY)
            # ==========================================
            if pay_mode == 'spot':
                Booking.objects.create(
                    name=data.get('name'),
                    phone=data.get('phone'),
                    email=data.get('email'),
                    package_name=data.get('package'),
                    booking_date=data.get('date'),
                    amount=0, 
                    status='Confirmed - Pay on Spot'
                )
                
                return Response({
                    'success': True,
                    'payment_required': False, 
                    'message': 'Booking confirmed for Pay on Spot.'
                }, status=status.HTTP_200_OK)

            # ==========================================
            # PATH B: SECURE SPOT (REQUIRES RAZORPAY)
            # ==========================================
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            
            # Amount is passed from JS as 499, multiply by 100 for paise
            order_amount = amount * 100 
            order_currency = 'INR'
            order_receipt = f"asx_{data.get('phone')}"

            razorpay_order = client.order.create(dict(
                amount=order_amount,
                currency=order_currency,
                receipt=order_receipt,
                payment_capture='1'
            ))

            Booking.objects.create(
                name=data.get('name'),
                phone=data.get('phone'),
                email=data.get('email'),
                package_name=data.get('package'),
                booking_date=data.get('date'),
                amount=amount, # Will record as 499 in database
                razorpay_order_id=razorpay_order['id'],
                status='Pending'
            )

            return Response({
                'success': True,
                'payment_required': True,
                'order_id': razorpay_order['id'],
                'amount': order_amount,
                'currency': order_currency
            }, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"Backend Error: {str(e)}") 
            return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)