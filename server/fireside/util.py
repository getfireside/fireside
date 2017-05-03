import datetime
from rest_framework.serializers import Field, ValidationError


class TimestampField(Field):
    def to_internal_value(self, value):
        if not isinstance(value, str) and not isinstance(value, int):
            raise ValidationError('Incorrect input type.')
        return datetime.datetime.fromtimestamp(int(value) / 1000)

    def to_representation(self, value):
        return int(value.timestamp() * 1000)
