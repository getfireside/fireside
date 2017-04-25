# flake8: noqa
from django.conf.urls import url, include
from django.conf import settings
from django.contrib import admin
import rooms.urls
from . import views

urlpatterns = [
    url(r'^admin/', admin.site.urls),
    url(r'^rooms/', include(rooms.urls, namespace='rooms')),
    url(r'^$', views.index),
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [
        url(r'^__debug__/', include(debug_toolbar.urls)),
    ]