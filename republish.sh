#!/bin/sh
THISDIR=$(cd "$(dirname "$0")"; pwd)
cd $THISDIR

VERSION=$(grep "version" package.json | sed 's/"version": "//g' | sed 's/",//g' | sed -e 's/[ \t]*//')

npm unpublish "node-bounce-handler@$VERSION"
npm publish .
