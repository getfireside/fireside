# -*- coding: utf-8 -*-
# Generated by Django 1.10.6 on 2017-04-11 11:02
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('recordings', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='recording',
            options={'get_latest_by': 'created', 'ordering': ['-created']},
        ),
        migrations.AlterField(
            model_name='recording',
            name='participant',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='recordings', to='rooms.Participant'),
        ),
        migrations.AlterField(
            model_name='recording',
            name='room',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='recordings', to='rooms.Room'),
        ),
    ]