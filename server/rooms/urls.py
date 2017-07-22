# flake8: noqa
from django.conf.urls import url

from . import views

urlpatterns = [
    url(r'^$', views.CreateRoomView.as_view(), name='create'),
    url(r'^(?P<room_id>\w+)/$', views.RoomView.as_view(), name='room'),
    url(r'^(?P<room_id>\w+)/join/$', views.JoinRoomView.as_view(), name='join'),
    url(r'^(?P<room_id>\w+)/messages/$', views.RoomMessagesView.as_view(), name='messages'),
    url(r'^(?P<room_id>\w+)/recordings/$', views.RoomRecordingsView.as_view(), name='recordings'),
    url(r'^(?P<room_id>\w+)/participants/$', views.RoomParticipantsView.as_view(), name='users'),
    url(r'^(?P<room_id>\w+)/participants/(?P<participant_id>\d+)/name/$', views.ChangeNameView.as_view(), name='change_name'),
    url(r'^(?P<room_id>\w+)/actions/(?P<name>\w+)/$', views.RoomActionView.as_view(), name='action'),
]