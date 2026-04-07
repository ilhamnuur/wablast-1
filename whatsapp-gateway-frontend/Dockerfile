# Stage 1: Build the React Application
FROM node:20-alpine as build
WORKDIR /app

# Pass the API URL as building argument
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve the build using Nginx
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
# Copy custom Nginx configuration to handle React Router navigation
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
