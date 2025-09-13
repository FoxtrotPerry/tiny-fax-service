rm direct_test \
  && docker buildx build --platform linux/arm64 -f Dockerfile -t tinyfax-builder . \
  && docker create --name tmp tinyfax-builder \
  && docker cp tmp:/opt/direct_test ./direct_test \
  || docker rm tmp
