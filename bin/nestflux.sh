#!/bin/sh

set -e

MYDIR=$(dirname $0)
. $MYDIR/../settings.sh
nodejs $MYDIR/../index.js