from django.conf import settings
import redis

redis_conn = redis.StrictRedis(
    decode_responses=True,
    **settings.FIRESIDE_REDIS_CONF
)
