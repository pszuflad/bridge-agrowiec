#!/bin/bash
cd /home/admin/private_apps/bridge/parsers || exit 1
sed -n '500,560p' adapter.cjs
