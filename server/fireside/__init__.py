from django.conf import settings
import redis

redis_conn = redis.StrictRedis(**settings.FIRESIDE_REDIS_CONF, decode_responses=True)