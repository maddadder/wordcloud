FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
COPY app.js /usr/share/nginx/html/app.js
COPY styles.css /usr/share/nginx/html/styles.css
COPY audio-worklet.js /usr/share/nginx/html/audio-worklet.js
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
