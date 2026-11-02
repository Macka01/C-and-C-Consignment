#!/bin/sh
# Docker sets HOSTNAME to the container name. Next.js standalone listens on
# process.env.HOSTNAME, so without this the host port 43123 resets.
export HOSTNAME=0.0.0.0
export PORT="${PORT:-43123}"
cd /app
exec node server.js
