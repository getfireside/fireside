from django.shortcuts import render
from time import time

def index(request):
    return render(request, 'index.html')

def ntp(request):
    return str(time())