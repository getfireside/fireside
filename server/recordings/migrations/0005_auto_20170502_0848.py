# -*- coding: utf-8 -*-
# Generated by Django 1.11 on 2017-05-02 08:48
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('recordings', '0004_auto_20170419_1648'),
    ]

    operations = [
        migrations.AlterField(
            model_name='recording',
            name='filesize',
            field=models.BigIntegerField(blank=True, default=0, null=True),
        ),
    ]
