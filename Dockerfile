FROM node:lts-alpine
WORKDIR /app
COPY . /app
RUN npm --registry https://registry.npm.taobao.org install
EXPOSE 5283
CMD ["npm", "start"]
