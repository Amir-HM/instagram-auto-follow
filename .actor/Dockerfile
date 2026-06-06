# Pin to a base image tag that bundles the EXACT Playwright version we use
# (node 22 + Playwright 1.60.0). The rolling tags drift to newer
# Playwright/Chromium builds that don't match our pinned npm package, causing
# "Executable doesn't exist" launch failures. Node 22 is the current Active LTS
# (Node 20 reached end-of-life in April 2026).
FROM apify/actor-node-playwright-chrome:22-1.60.0

COPY --chown=myuser:myuser package*.json ./

RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --omit=optional --all || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version

COPY --chown=myuser:myuser . ./

LABEL com.apify.actBuildId=${ACT_BUILD_ID}

CMD ["npm", "start"]
