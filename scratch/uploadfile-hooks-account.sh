#!/bin/bash
# Re-aplica menu global Upload File quando contas novas são criadas.
/usr/local/directadmin/scripts/ensure-uploadfile-global.sh >/dev/null 2>&1 || true
exit 0
