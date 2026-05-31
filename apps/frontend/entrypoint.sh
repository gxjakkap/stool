#!/bin/sh
cat <<EOF > /usr/share/nginx/html/env.js
window.ENV = {
  "VITE_API_ORIGIN": "${VITE_API_ORIGIN}"
};
EOF

exec "$@"