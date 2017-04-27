from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver

from accounts.models import User


class ParticipantManager(models.Manager):
    def from_request(self, request, create=False):
        return self.from_user_or_session(
            request.user,
            request.session,
            create=create
        )

    def from_user_or_session(self, user, session, create=False):
        if user.is_authenticated():
            return self.get(user=user)
        else:
            if session.session_key is None:
                session.save()
            if create:
                participant, _ = self.get_or_create(
                    session_key=session.session_key
                )
            else:
                participant = self.get(
                    session_key=session.session_key
                )
            return participant


class Participant(models.Model):
    user = models.OneToOneField('accounts.User', blank=True, null=True,
                                related_name='participant')
    session_key = models.CharField(max_length=32, blank=True, null=True)
    name = models.CharField(max_length=64, blank=True, null=True)

    def get_display_name(self):
        if self.name is None:
            if self.user_id:
                return self.user.get_short_name()
        return self.name

    objects = ParticipantManager()


@receiver(post_save, sender=User)
def create_participant_for_user(sender, instance, created, **kwargs):
    if created:
        Participant.objects.create(
            user=instance,
            name=instance.get_short_name()
        )
    else:
        instance.participant.name = instance.get_short_name()
        instance.participant.save()
