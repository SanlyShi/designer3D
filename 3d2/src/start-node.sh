#!/bin/bash

#exit;

#启server
num=$(ps -ef | grep "node -r esm src/entry.js" | grep -v grep |wc -l)
if [ $num = 0 ];then
   echo 'node proccess not found, ready to start'
   cd /data/www/zwdcservice-sandbox2/3d2
   nohup node -r esm src/entry.js >> /tmp/serverlog-task.log 2>&1 &
fi
echo 'started node process'
