#!/usr/bin/env python3
"""Traduz lote JSON [["id","text"],...] → {"id":"translation",...}"""
import json
import os
import sys

import argostranslate.settings
import argostranslate.translate as translate

argostranslate.settings.package_data_dir = os.environ.get(
    "VD_ARGOS_DATA", "/opt/vd-translate/share"
)

items = json.load(sys.stdin)
out = {}
for item in items:
    row_id, text = item[0], (item[1] or "").strip()
    if not text or len(text) > 2000:
        continue
    try:
        translated = translate.translate(text, "pt", "en").strip()
        if translated and translated != text:
            out[str(row_id)] = translated
    except Exception:
        pass

json.dump(out, sys.stdout)
