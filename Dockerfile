FROM oven/bun:latest

WORKDIR /opt

COPY src ./src
COPY setup ./setup
COPY package.json .
COPY bun.lock .

RUN bun install
RUN bun build --compile --minify --target=bun-linux-arm64 src/testing/directConnectTest.ts --outfile /opt/direct_test
