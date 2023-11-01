
for port in {40000..40010}
do
 nohup node -r esm src/server.js $port &
 echo $port
done
