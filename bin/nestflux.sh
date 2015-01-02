#!/bin/sh

set -e

MYDIR=$(dirname $0)
. $MYDIR/../settings.sh
node $MYDIR/../index.js