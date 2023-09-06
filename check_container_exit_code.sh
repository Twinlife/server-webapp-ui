error_code=$(docker container inspect -f '{{.State.ExitCode}}' usine-webapp-twinlife)
if [ $? -ne $error_code ]; then
  echo "exit code ($error_code)"
  exit 1
fi