import datetime
from rest_framework.serializers import Field


class TimestampField(Field):
    def to_internal_value(self, value):
        return datetime.datetime.fromtimestamp(value / 1000)

    def to_representation(self, value):
        return int(value.timestamp() * 1000)
