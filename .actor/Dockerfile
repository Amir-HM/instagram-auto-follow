# Pin to a base image tag that bundles the EXACT Playwright version we use
# (node 20 + Playwright 1.56.1). The rolling ":20" tag drifts to newer
# Playwright/Chromium builds that don't match our pinned npm package, causing
# "Executable doesn't exist" launch failures.
FROM apify/actor-node-playwright-chrome:20-1.56.1

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
