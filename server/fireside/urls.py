# flake8: noqa
from django.conf.urls import url, include
from django.conf import settings
from django.contrib import admin
import rooms.urls

urlpatterns = [
    url(r'^admin/', admin.site.urls),
    url(r'^rooms/', include(rooms.urls, namespace='rooms'))
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [
        url(r'^__debug__/', include(debug_toolbar.urls)),
    ]