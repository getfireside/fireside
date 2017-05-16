from datetime import datetime, timezone
from django.views.generic import DetailView, View
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import ListCreateAPIView, ListAPIView
from rest_framework.permissions import BasePermission

from .models import Room, Participant, RoomMembership, Message
from .serializers import (
    MembershipSerializer,
    MessageSerializer,
    PeerActionSerializer,
    JoinRoomSerializer,
    RoomConfigSerializer
)
from recordings.serializers import RecordingSerializer


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
    pk_url_kwarg = 'room_id'
    context_object_name = 'room'

    def get_context_data(self, **ctx):
        ctx = super().get_context_data(**ctx)
        # TODO refactor me
        ctx['self_uid'] = None
        try:
            participant = Participant.objects.from_request(self.request)
        except Participant.DoesNotExist:
            pass
        else:
            if self.object.memberships.filter(
                participant=participant
            ).exists():
                ctx['self_uid'] = participant.id
        return ctx


class CreateRoomView(View):
    def post(self, request):
        participant = Participant.objects.from_request(request, create=True)
        room = Room.objects.create_with_owner(participant)
        return HttpResponseRedirect(room.get_absolute_url())


class JoinRoomView(APIView):
    def post(self, request, room_id):
        room = get_object_or_404(Room, id=room_id)
        participant = Participant.objects.from_request(request, create=True)
        serializer = JoinRoomSerializer(data=request.data,
            context={'participant': participant}
        )
        if serializer.is_valid():
            mem = room.memberships.create(
                participant=participant,
                name=serializer.validated_data['name'],
                role='o' if participant == room.owner else 'g',
            )
        else:
            return Response(
                data=serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        return Response({'uid': mem.id}, status=status.HTTP_200_OK)


class RoomMessagesView(ListAPIView):
    permission_classes = (HasRoomAccess,)
    serializer_class = MessageSerializer

    def post(self, request, **kwargs):
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            message = Message(**serializer.validated_data)
            message.participant = request.participant
            message.peer_id = request.room.get_peer_id(request.participant)
            print(message.__dict__)
            request.room.receive_event(message)
            return Response({'id': message.id}, status=status.HTTP_200_OK)
        else:
            return Response(
                data=serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

    def get_queryset(self):
        qs = self.request.room.messages.all()
        if 'until' in self.request.query_params:
            qs = qs.filter(
                timestamp__lt=datetime.fromtimestamp(
                    int(self.request.query_params['until']) / 1000,
                    timezone.utc,
                ),
            )
        return qs

class RoomRecordingsView(ListCreateAPIView):
    permission_classes = (HasRoomAccess,)
    serializer_class = RecordingSerializer

    def get_queryset(self):
        return self.request.room.recordings.all()

    def perform_create(self, serializer):
        serializer.save(
            room=self.request.room,
            participant=self.request.participant,
        )


class RoomParticipantsView(ListAPIView):
    permission_classes = (HasRoomAccess,)
    serializer_class = MembershipSerializer

    def get_queryset(self):
        return RoomMembership.objects.filter(room_id=self.kwargs['room_id'])


class RoomActionView(APIView):
    permission_classes = (IsRoomAdmin,)

    def base_action(self, action_name):
        serializer = PeerActionSerializer(
            data=self.request.data,
            context={'room': self.request.room}
        )
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
            ),
            from_participant=self.request.participant
        )
        return Response(data='OK', status=status.HTTP_200_OK)

    def send_action(self, action_name, data):
        return self.request.room.send(
            self.request.room.message('action', data)
        )

    def update_config(self):
        serializer = RoomConfigSerializer(self.request.room.config,
            data=self.request.data,
            partial=True
        )
        if not serializer.is_valid():
            return Response(
                data=serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        self.request.room.set_config(serializer.validated_data)
        return Response(data='OK', status=status.HTTP_200_OK)

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
