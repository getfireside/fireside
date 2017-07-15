FROM python:3.6-alpine

RUN apk add --no-cache build-base
RUN apk --update add --no-cache postgresql-client postgresql-dev libffi-dev musl-dev linux-headers

RUN mkdir -p /usr/src/server
WORKDIR /usr/src/server
ADD . /usr/src/server

RUN pip install -r requirements.txt
EXPOSE 8000
CMD [ "python", "manage.py", "runserver" ]