FROM node:18-alpine

ARG COMMIT_SHA=dev
ENV COMMIT_SHA=$COMMIT_SHA

WORKDIR /app
COPY . .
RUN npm install

CMD ["npm", "start"]
