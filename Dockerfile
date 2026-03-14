# --- Stage 1: Build Vue app ---
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json yarn.lock ./
COPY patches/ patches/
RUN yarn install --frozen-lockfile

COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts env.d.ts ./
COPY public/ public/
COPY src/ src/
COPY shared/ shared/

ARG VITE_BUGSNAP_API
ENV VITE_BUGSNAP_API=$VITE_BUGSNAP_API

RUN yarn build

# --- Stage 2: Serve with nginx + SSL proxy ---
FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/nginx.conf /etc/nginx/nginx.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
# Substitute only $DOMAIN, leaving nginx variables ($host, $uri, etc.) intact
CMD ["/bin/sh", "-c", "envsubst '${DOMAIN}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
EXPOSE 80 443
