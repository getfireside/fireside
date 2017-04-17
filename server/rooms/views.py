from datetime import datetime, timezone
from django.views.generic import DetailView

from rest_framework.views import APIView
from rest_framework.generics import ListCreateAPIView, ListAPIView
from rest_framework.permissions import BasePermission

from .models import Room, Participant, RoomMembership, Message
from .serializers import MembershipSerializer, MessageSerializer


class HasRoomAccess(BasePermission):
    def has_permission(self, request, view):
        try:
            room = request.room = \
                Room.objects.get(id=view.kwargs.get('room_id'))
        except Room.DoesNotExist:
            return False
        try:
            participant = request.participant = \
                Participant.objects.from_request(request)
        except Participant.DoesNotExist:
            return False
        request.participant = participant
        return room.can_access(participant)


class IsRoomAdmin(BasePermission):
    def has_permission(self, request, view):
        try:
            room = request.room = \
                Room.objects.get(id=view.kwargs.get('room_id'))
        except Room.DoesNotExist:
            return False
        try:
            participant = request.participant = \
                Participant.objects.from_request(request)
        except Participant.DoesNotExist:
            return False
        request.participant = participant
        return room.is_admin(participant)


class RoomView(DetailView):
    model = Room
    template_name = 'rooms/room.html'


class RoomMessagesView(ListCreateAPIView):
    permission_classes = (HasRoomAccess,)
    serializer_class = (MessageSerializer)

    def get_queryset(self):
        qs = Message.objects.filter(room_id=self.kwargs['room_id'])
        if 'until' in self.request.query_params:
            qs = qs.filter(
                timestamp__lt=datetime.fromtimestamp(
                    self.request.query_params['since'],
                    timezone.utc,
                ),
            )
        return qs


class RoomParticipantsView(ListAPIView):
    permission_classes = (HasRoomAccess,)
    serializer_class = MembershipSerializer

    def get_queryset(self):
        return RoomMembership.objects.filter(room_id=self.kwargs['room_id'])


class RoomActionView(APIView):
    permission_classes = (IsRoomAdmin,)

    def post(self, room_id):
        pass

# Create your views here.
