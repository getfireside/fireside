from datetime import datetime, timezone
from django.views.generic import DetailView, View
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.db import IntegrityError
import json

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
    RoomConfigSerializer,
    EditNameSerializer
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
        return room.is_member(participant)


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
        membership = None
        participant = None
        try:
            participant = Participant.objects.from_request(self.request)
            membership = self.object.memberships.filter(
                participant=participant
            ).first()
        except Participant.DoesNotExist:
            pass

        owner_mem = self.object.memberships.filter(
            participant=self.object.owner
        ).first()

        ctx['config_json'] = json.dumps({
            "roomData": {
                "id": self.object.id,
                "owner": {
                    "id": self.object.owner.id,
                    "name": owner_mem.get_display_name() if owner_mem else None,
                    "role": "o",
                },
                "self": {
                    "id": participant.id if participant is not None else None,
                    "name": membership.get_display_name() if membership is not None else None,
                    "isNew": membership is None,
                    "onboardingComplete": (
                        membership is not None and
                        membership.onboarding_complete
                    )
                },
                "config": self.object.get_config(),
            },
            "opts": {
                "urls": {
                    "socket": self.object.get_full_socket_url(),
                    "join": self.object.get_join_url(),
                    "messages": self.object.get_messages_url(),
                    "recordings": self.object.get_recordings_url(),
                    "action": self.object.get_absolute_url() + "actions/:name/",
                    "changeName": self.object.get_absolute_url() + "participants/:uid/name/",
                },
            },
        })

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
            try:
                room.memberships.create(
                    participant=participant,
                    name=serializer.validated_data['name'],
                    role='o' if participant == room.owner else 'g',
                )
            except IntegrityError:
                return Response(
                    data={'error': 'Already joined!'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            return Response(
                data=serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        return Response({'uid': participant.id}, status=status.HTTP_200_OK)


class ChangeNameView(APIView):
    permission_classes = (HasRoomAccess,)

    def post(self, request, room_id, participant_id):
        participant = get_object_or_404(Participant, id=participant_id)
        if (
            participant != request.participant and not
            request.room.is_admin(request.participant)
        ):
            return Response(
                data="Must be admin to change other member's name",
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = EditNameSerializer(data=request.data,
            context={'participant': participant}
        )
        if serializer.is_valid():
            request.room.change_member_name(participant, serializer.validated_data['name'])
        else:
            return Response(
                data=serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        return Response({}, status=status.HTTP_200_OK)

class RoomMessagesView(ListAPIView):
    permission_classes = (HasRoomAccess,)
    serializer_class = MessageSerializer

    def post(self, request, **kwargs):
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            message = Message(**serializer.validated_data)
            message.participant = request.participant
            message.peer_id = request.room.peers.for_participant(request.participant).id
            print(message.__dict__)
            request.room.receive_event(message)
            return Response({
                'id': message.id,
                'timestamp': message.timestamp.timestamp() * 1000
            }, status=status.HTTP_200_OK)
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
        self.request.room.create_recording(**serializer.validated_data)

    def put(self, request, **kwargs):
        serializer = RecordingSerializer(data=request.data, many=True)
        if serializer.is_valid():
            self.request.room.update_recordings(
                serializer.validated_data,
                participant=request.participant
            )
            return Response(data="OK", status=status.HTTP_200_OK)
        else:
            return Response(
                data=serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
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

        # TODO: we need to validate the action data.
        # This means we'd need to look up the right serializer
        # for the action.
        # For now, let's just pass it through to the action without
        # validating.

        getattr(self.request.room, action_name)(
            target_peer_id=peer_id.hex,
            from_peer_id=self.request.room.peers.for_participant(
                self.request.participant
            ).id,
            from_participant=self.request.participant,
            data={k: v for k, v in self.request.data.items() if k != 'peer_id'},
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

    def pause_recording(self):
        return self.base_action('pause_recording')

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
