# Register your models here.
from django.contrib import admin
from .models import Booking

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    # These are the columns that will show up in your dashboard
    list_display = ('name', 'phone', 'package_name', 'booking_date', 'status')
    
    # Adds a filter sidebar to quickly sort by status or package
    list_filter = ('status', 'package_name')
    
    # Adds a search bar to find customers by name, email, or phone
    search_fields = ('name', 'email', 'phone')