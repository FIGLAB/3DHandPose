#!/bin/bash

trap killgroup SIGINT

killgroup(){
  kill 0
}

function prepend() { while read line; do echo "${1}${line}"; done; }

export FLASK_ENV=development
unbuffer python3 -u compute_server.py | prepend "[compute] " &
unbuffer ts-node app.ts | prepend "[frontend] " &
wait