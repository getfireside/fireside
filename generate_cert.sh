#!/bin/sh
mkdir -p certs
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 -keyout /certs/cert.key -out /usr/local/etc/nginx/certs/cert.crt