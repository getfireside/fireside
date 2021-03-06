# -*- coding: utf-8 -*-
# Generated by Django 1.10.6 on 2017-04-11 11:02
from __future__ import unicode_literals

from django.db import migrations, models
import rooms.models.room


class Migration(migrations.Migration):

    dependencies = [
        ('rooms', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelManagers(
            name='room',
            managers=[
            ],
        ),
        migrations.RenameField(
            model_name='message',
            old_name='data',
            new_name='payload',
        ),
        migrations.AlterField(
            model_name='room',
            name='id',
            field=models.CharField(default=rooms.models.room.RoomManager.generate_id, max_length=6, primary_key=True, serialize=False),
        ),
    ]
