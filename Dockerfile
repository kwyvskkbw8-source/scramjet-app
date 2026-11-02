# Build Scramjet and its WASM rewriter.
FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential pkg-config curl ca-certificates git binaryen \
    && rm -rf /var/lib/apt/lists/*

ENV CARGO_HOME=/usr/local/cargo
ENV RUSTUP_HOME=/usr/local/rustup
ENV PATH=/usr/local/cargo/bin:$PATH

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain nightly --component rust-src --target wasm32-unknown-unknown
RUN cargo install wasm-bindgen-cli --version 0.2.105 --locked
RUN cargo install --git https://github.com/r58playz/wasm-snip

RUN corepack enable && corepack prepare pnpm@12.17.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile
RUN cd packages/core/rewriter/wasm && bash build.sh
RUN pnpm exec rspack build --mode production
RUN pnpm --filter @mercuryworkshop/scramjet-demo build

# Small runtime image: only the built frontend and Wisp server are needed.
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN npm install --omit=dev --no-audit --no-fund @mercuryworkshop/wisp-js@0.4.1
COPY --from=build /app/packages/demo/dist ./public
COPY server.mjs ./server.mjs
ENV PORT=10000
EXPOSE 10000
CMD ["node", "server.mjs"]
