#!/bin/sh
THISDIR=$(cd "$(dirname "$0")"; pwd)
cd $THISDIR

VERSION=$(grep "version" package.json | sed 's/"version": "//g' | sed 's/",//g')

npm unpublish "node-bounce-handler@$VERSION"
npm publish .
