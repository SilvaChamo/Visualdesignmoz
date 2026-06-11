#!/usr/bin/env python3
import base64
import os
import sys

import argostranslate.settings
import argostranslate.translate as translate

argostranslate.settings.package_data_dir = os.environ.get(
    "VD_ARGOS_DATA", "/opt/vd-translate/share"
)

text = base64.b64decode(sys.argv[1]).decode("utf-8")
print(translate.translate(text, "pt", "en"), end="")
