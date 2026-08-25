# syntax=docker/dockerfile:1
FROM golang:1.23-bookworm AS go-client
WORKDIR /src
RUN git clone --depth 1 https://github.com/0gfoundation/0g-storage-client.git .
RUN go build -o /out/0g-storage-client .

FROM node:22-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip poppler-utils \
  && pip3 install --break-system-packages pypdfium2 \
  && rm -rf /var/lib/apt/lists/*
COPY --from=go-client /out/0g-storage-client /usr/local/bin/0g-storage-client
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY backend ./
ENV BURSAR_GO_STORAGE_CLIENT=/usr/local/bin/0g-storage-client
ENV BURSAR_API_PORT=8787
EXPOSE 8787
CMD ["npx", "tsx", "src/index.ts"]
