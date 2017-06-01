from django.apps import AppConfig


class RoomsConfig(AppConfig):
    name = 'rooms'
    def ready(self):
        # room event handlers won't register unless imported
        # import here to avoid circular imports
        from . import events