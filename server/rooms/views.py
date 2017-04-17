from datetime import datetime, timezone
from django.views.generic import DetailView

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import ListCreateAPIView, ListAPIView
from rest_framework.permissions import BasePermission

from .models import Room, Participant, RoomMembership, Message
from .serializers import (
    MembershipSerializer,
    MessageSerializer,
    PeerActionSerializer
)


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
        qs = self.request.room.messages.all()
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

    def base_action(self, action_name):
        serializer = PeerActionSerializer(data=self.request.data, context={'room': self.request.room})
        if not serializer.is_valid():
            return Response(
                data=serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        peer_id = serializer.validated_data['peer_id']
        getattr(self.request.room, action_name)(
            target_peer_id=peer_id.hex,
            from_peer_id=self.request.room.get_peer_id(
                self.request.participant
            )
        )
        return Response(status=status.HTTP_200_OK)

    def send_action(self, action_name, data):
        return self.request.room.send(
            self.request.room.message('action', data)
        )

    def start_recording(self):
        return self.base_action('start_recording')

    def stop_recording(self):
        return self.base_action('stop_recording')

    def kick(self):
        # TODO: implement kick
        raise NotImplementedError

    def post(self, request, room_id, name):
        if not self.request.room.is_valid_action(name):
            return Response(
                data='No such action exists',
                status=status.HTTP_400_BAD_REQUEST
            )

        return getattr(self, name)()
