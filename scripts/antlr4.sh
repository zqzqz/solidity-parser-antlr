#!/bin/zsh

set -o errexit

echo $CLASSPATH

alias antlr4='java -Xmx500M -cp "/home/zqz/Documents/contest/solidity-parser-antlr/solidity-antlr4/antlr4.jar:$CLASSPATH" org.antlr.v4.Tool'

antlr4 -Dlanguage=JavaScript solidity-antlr4/Solidity.g4 -o lib

mv lib/solidity-antlr4/* src/lib/

rmdir lib/solidity-antlr4

sed -i.bak -e 's/antlr4\/index/\.\.\/antlr4\/index/g' src/lib/*.js

find src/lib -name '*.js.bak' -delete
