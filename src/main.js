import { Actor } from 'apify';
import { chromium } from 'playwright';

// Multi-language support for button text detection
const FOLLOW_TEXTS = [
  'Follow', 'follow', 'FOLLOW',
  'Seguir', 'seguir',           // Spanish, Portuguese
  'Suivre', 'suivre',           // French
  'Folgen', 'folgen',           // German
  'Segui', 'segui',             // Italian
  'Volgen', 'volgen',           // Dutch
  'Følg', 'følg',               // Danish, Norwegian
  'Följa', 'följa',             // Swedish
  'Seuraa', 'seuraa',           // Finnish
  'Obserwuj', 'obserwuj',       // Polish
  'Sledovat', 'sledovat',       // Czech
  'Takip Et', 'takip et',       // Turkish
  'Ακολούθησε',                 // Greek
  'Подписаться',                // Russian
  'フォローする',                // Japanese
  '팔로우',                      // Korean
  '关注', '關注',                // Chinese (Simplified/Traditional)
  'متابعة',                     // Arabic
  'עקוב',                       // Hebrew
  'ติดตาม',                     // Thai
  'Theo dõi',                   // Vietnamese
];

const FOLLOWING_TEXTS = [
  'Following', 'following', 'FOLLOWING',
  'Siguiendo', 'siguiendo',     // Spanish
  'Seguindo', 'seguindo',       // Portuguese
  'Abonné', 'abonné',           // French
  'Abonniert', 'abonniert',     // German
  'Segui già', 'segui già',     // Italian
  'Volgend', 'volgend',         // Dutch
  'Følger', 'følger',           // Danish, Norwegian
  'Följer', 'följer',           // Swedish
  'Seurataan', 'seurataan',     // Finnish
  'Obserwujesz',                // Polish
  'Sledujete',                  // Czech
  'Takip Ediyorsun',            // Turkish
  'Ακολουθείς',                 // Greek
  'Подписки',                   // Russian
  'フォロー中',                  // Japanese
  '팔로잉',                      // Korean
  '正在关注', '正在關注',        // Chinese
  'متابَع',                     // Arabic
  'עוקב/ת',                     // Hebrew
  'กำลังติดตาม',                // Thai
  'Đang theo dõi',              // Vietnamese
];

const REQUESTED_TEXTS = [
  'Requested', 'requested', 'REQUESTED',
  'Solicitado', 'solicitado',   // Spanish, Portuguese
  'Demandé', 'demandé',         // French
  'Angefragt', 'angefragt',     // German
  'Richiesto', 'richiesto',     // Italian
  'Aangevraagd',                // Dutch
  'Anmodet', 'Forespurt',       // Danish, Norwegian
  'Begärd', 'begärd',           // Swedish
  'Pyydetty',                   // Finnish
  'Wysłano prośbę',             // Polish
  'Požadováno',                 // Czech
  'İstendi',                    // Turkish
  'Αίτημα',                     // Greek
  'Запрошено',                  // Russian
  'リクエスト済み',              // Japanese
  '요청됨',                      // Korean
  '已请求', '已請求',            // Chinese
  'تم الطلب',                   // Arabic
  'נשלחה בקשה',                 // Hebrew
  'ส่งคำขอแล้ว',                // Thai
  'Đã yêu cầu',                 // Vietnamese
];

// Initialize the actor on the Apify platform
await Actor.init();

try {
  // Get input - with fallback for local testing
  let input = await Actor.getInput() || {};

  // For local testing, allow input from environment variables
  if (Object.keys(input).length === 0 && process.env.APIFY_TEST_INPUT) {
    input = JSON.parse(process.env.APIFY_TEST_INPUT);
  }

  const {
    sessionCookie,
    usersToFollow = [],
    maxFollowsPerRun = 20,
    delayBetweenFollows = 15,
    randomDelayVariation = 5,
    accountType = 'mature',
    useCleanedInput = false,
    proxyConfiguration,
  } = input;

  // Validate required input
  if (!sessionCookie) {
    throw new Error('sessionCookie is required');
  }

  const logger = {
    info: (msg) => console.log(`[INFO] ${msg}`),
    error: (msg) => console.error(`[ERROR] ${msg}`),
    warning: (msg) => console.warn(`[WARNING] ${msg}`),
  };

  logger.info('Instagram Auto Follow Actor started');
  logger.info(`Account type: ${accountType}`);
  logger.info(`Max follows per run: ${maxFollowsPerRun}`);
  logger.info(`Delay between follows: ${delayBetweenFollows}s (+-${randomDelayVariation}s)`);

  // Initialize storage
  const dataset = await Actor.openDataset();
  const keyValueStore = await Actor.openKeyValueStore();

  // Handle useCleanedInput - load from previous run if enabled
  let targetUsers = [...usersToFollow];
  if (useCleanedInput) {
    const cleanedInput = await keyValueStore.getValue('CLEANED_INPUT');
    if (cleanedInput && cleanedInput.usersToFollow && cleanedInput.usersToFollow.length > 0) {
      logger.info(`Using cleaned input from previous run: ${cleanedInput.usersToFollow.length} users`);
      targetUsers = cleanedInput.usersToFollow;
    } else {
      logger.warning('useCleanedInput enabled but no cleaned input found, using provided list');
    }
  }

  logger.info(`Total users to process: ${targetUsers.length}`);

  // Configure proxy if provided
  let proxySettings = null;
  if (proxyConfiguration) {
    const proxyConfig = await Actor.createProxyConfiguration(proxyConfiguration);
    if (proxyConfig) {
      const proxyUrl = await proxyConfig.newUrl();
      logger.info(`Using proxy: ${proxyUrl.replace(/:[^:@]+@/, ':****@')}`);

      // Parse proxy URL to extract credentials (format: http://username:password@host:port)
      const proxyUrlObj = new URL(proxyUrl);
      proxySettings = {
        server: `${proxyUrlObj.protocol}//${proxyUrlObj.host}`,
        username: proxyUrlObj.username,
        password: proxyUrlObj.password,
      };
      logger.info(`Proxy server: ${proxySettings.server}, username: ${proxySettings.username}`);
    }
  }

  // Launch Chromium browser with anti-detection
  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1920,1080',
    ],
  };

  if (proxySettings) {
    launchOptions.proxy = proxySettings;
  }

  logger.info('Launching Chromium browser...');
  const browser = await chromium.launch(launchOptions);

  // Create context with realistic browser settings
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  const page = await context.newPage();

  // Remove webdriver flag to avoid detection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // Also hide automation indicators
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });

  // Listen for console messages to debug
  page.on('console', msg => {
    if (msg.type() === 'error') {
      logger.warning(`Browser console error: ${msg.text()}`);
    }
  });

  // Listen for failed requests
  page.on('requestfailed', request => {
    logger.warning(`Request failed: ${request.url()} - ${request.failure()?.errorText}`);
  });

  // Log response status for main document requests
  page.on('response', response => {
    const url = response.url();
    if (url.includes('instagram.com') && !url.includes('.js') && !url.includes('.css') && !url.includes('.png') && !url.includes('.jpg')) {
      logger.info(`Response: ${response.status()} ${response.statusText()} - ${url.substring(0, 80)}`);
    }
  });

  // Set session cookie
  await context.addCookies([
    {
      name: 'sessionid',
      value: sessionCookie,
      domain: '.instagram.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);

  logger.info('Session cookie set');

  // Navigate to Instagram with lenient timeout (longer for proxies)
  try {
    await page.goto('https://www.instagram.com', { waitUntil: 'networkidle', timeout: 60000 });
    logger.info('Instagram home page loaded successfully');
  } catch (e) {
    logger.warning('Instagram home page load timeout, continuing anyway...');
  }

  // Check if we're on the login page (session might be invalid)
  const currentUrl = page.url();
  logger.info(`Current URL: ${currentUrl}`);
  if (currentUrl.includes('/accounts/login')) {
    logger.warning('Redirected to login page - session cookie may be invalid or expired');
  }

  let followCount = 0;
  let alreadyFollowingCount = 0;
  let requestedCount = 0;
  let failedCount = 0;
  let rateLimited = false;
  const results = [];
  const remainingUsers = [];

  // Limit to maxFollowsPerRun
  const usersToProcessThisRun = targetUsers.slice(0, maxFollowsPerRun);
  const usersNotProcessed = targetUsers.slice(maxFollowsPerRun);
  logger.info(`Will follow ${usersToProcessThisRun.length} users in this run`);

  // Process each user
  for (const username of usersToProcessThisRun) {
    try {
      logger.info(`Processing user: ${username}`);

      // Navigate to user profile (longer timeout for residential proxies)
      const profileUrl = `https://www.instagram.com/${username}/`;
      logger.info(`Navigating to: ${profileUrl}`);
      try {
        await page.goto(profileUrl, { waitUntil: 'networkidle', timeout: 60000 });
        logger.info(`Page loaded for ${username}`);
      } catch (error) {
        logger.warning(`Navigation timeout for ${username}, checking if page loaded anyway...`);
      }

      // Debug: Log current URL and page title
      const pageUrl = page.url();
      const pageTitle = await page.title().catch(() => 'unknown');
      logger.info(`Current URL: ${pageUrl}`);
      logger.info(`Page title: ${pageTitle}`);

      // Check for login redirect
      if (pageUrl.includes('/accounts/login')) {
        throw new Error('Session expired - redirected to login page');
      }

      // Wait for Instagram to load profile content
      logger.info(`Waiting for profile to fully load...`);
      await page.waitForTimeout(5000);

      // Debug: Log page HTML length to see if content loaded
      const htmlLength = await page.evaluate(() => document.body?.innerHTML?.length || 0).catch(() => 0);
      logger.info(`Page HTML length: ${htmlLength} characters`);

      // Additional wait for specific profile elements to be present
      try {
        await page.waitForSelector('h2', { timeout: 5000 }).catch(() => null);
      } catch (e) {
        logger.warning(`Timeout waiting for profile name`);
      }

      // Check if profile exists - use multiple detection methods
      const profileExists = await page.evaluate(() => {
        // Method 1: Check for profile name header
        const profileHeader = document.querySelector('h2');
        // Method 2: Check for any main content area
        const mainContent = document.querySelector('main');
        // Method 3: Check for profile section
        const profileSection = document.querySelector('section');

        return !!(profileHeader || mainContent || profileSection);
      }).catch(() => false);

      if (!profileExists) {
        logger.warning(`Profile detection failed, but continuing anyway to check for buttons...`);
      } else {
        logger.info(`Profile found for ${username}`);
      }

      logger.info(`Looking for Follow button...`);

      // Helper function to check if text matches any Follow button text
      // Use startsWith for Following/Requested since button text may include icon text like "FollowingDown chevron icon"
      const isFollowingText = (text) => FOLLOWING_TEXTS.some(t => text.trim().startsWith(t));
      const isRequestedText = (text) => REQUESTED_TEXTS.some(t => text.trim().startsWith(t));
      // For Follow button, check exact match OR startsWith but NOT if it's Following/Requested
      const isFollowText = (text) => {
        const trimmed = text.trim();
        const matchesFollow = FOLLOW_TEXTS.some(t => trimmed === t || trimmed.startsWith(t + ' '));
        return matchesFollow && !isFollowingText(text) && !isRequestedText(text);
      };

      // Look for Follow button - use locator for better resilience
      let actionButton = null;
      let actionButtonFound = false;

      // Strategy 1: Search all buttons AND elements with role="button" (Instagram uses divs with role="button")
      try {
        const allButtons = await page.locator('button, [role="button"]').all();
        logger.info(`Found ${allButtons.length} buttons/role buttons total on page`);

        // Debug: Log all button texts to understand what's on the page
        const allButtonTexts = [];
        for (let i = 0; i < allButtons.length; i++) {
          const btn = allButtons[i];
          try {
            const text = await btn.textContent().catch(() => '');
            const trimmedText = text.trim();
            if (trimmedText && trimmedText.length < 50) {
              allButtonTexts.push(trimmedText);
            }
          } catch (e) {
            // Skip
          }
        }
        logger.info(`Button texts found: ${JSON.stringify(allButtonTexts)}`);

        for (let i = 0; i < allButtons.length; i++) {
          const btn = allButtons[i];
          try {
            const text = await btn.textContent().catch(() => '');
            const trimmedText = text.trim();

            // Check if it's a Follow button (not Following or Requested)
            if (isFollowText(trimmedText) && !isFollowingText(trimmedText) && !isRequestedText(trimmedText)) {
              logger.info(`Found Follow button at index ${i} with text: "${trimmedText}"`);
              actionButton = btn;
              actionButtonFound = true;
              break;
            }
          } catch (e) {
            // Skip this button
          }
        }

        if (!actionButtonFound) {
          logger.info(`Strategy 1 failed - no Follow button found among ${allButtons.length} buttons`);
        }
      } catch (e) {
        logger.warning(`Strategy 1 error: ${e.message}`);
      }

      // Strategy 2: Try locator with common Follow texts (including role="button" elements)
      if (!actionButtonFound) {
        try {
          for (const followText of FOLLOW_TEXTS.slice(0, 10)) { // Try first 10 common ones
            // Try both button and role="button" elements
            const buttonLocator = page.locator(`button:has-text("${followText}"), [role="button"]:has-text("${followText}")`).first();
            const count = await buttonLocator.count().catch(() => 0);

            if (count > 0) {
              const text = await buttonLocator.textContent().catch(() => '');
              if (isFollowText(text) && !isFollowingText(text)) {
                logger.info(`Found Follow button using locator for "${followText}"`);
                actionButton = buttonLocator;
                actionButtonFound = true;
                break;
              }
            }
          }

          if (!actionButtonFound) {
            logger.info(`Strategy 2 failed - no Follow button found with text locators`);
          }
        } catch (e) {
          logger.warning(`Strategy 2 error: ${e.message}`);
        }
      }

      if (!actionButtonFound) {
        logger.info(`Follow button not found, checking if already following...`);

        // Check if already following or requested (multi-language support)
        let alreadyInState = false;
        let stateType = null;

        try {
          const allButtons = await page.locator('button, [role="button"]').all();
          for (const btn of allButtons) {
            const text = await btn.textContent().catch(() => '');
            const trimmedText = text.trim();

            if (isFollowingText(trimmedText)) {
              alreadyInState = true;
              stateType = 'already_following';
              logger.info(`Found Following button with text: "${trimmedText}" - already following this user`);
              break;
            } else if (isRequestedText(trimmedText)) {
              alreadyInState = true;
              stateType = 'already_requested';
              logger.info(`Found Requested button with text: "${trimmedText}" - already sent follow request`);
              break;
            }
          }
        } catch (e) {
          logger.warning(`Could not check follow state: ${e.message}`);
        }

        if (alreadyInState) {
          const statusText = stateType === 'already_following' ? 'Already following' : 'Already requested';
          logger.info(`${username}: ${statusText}`);
          results.push({
            username,
            status: stateType,
            success: false,
            reason: statusText,
            timestamp: new Date().toISOString(),
            runDate: new Date().toISOString(),
            accountType,
          });
          alreadyFollowingCount++;
        } else {
          // Take screenshot for debugging
          try {
            const debugPath = `debug-${username}-${Date.now()}.png`;
            await page.screenshot({ path: debugPath });
            logger.info(`Saved debug screenshot to ${debugPath}`);
          } catch (e) {
            logger.warning(`Could not save screenshot: ${e.message}`);
          }
          remainingUsers.push(username);
          throw new Error('Follow button not found on profile');
        }
      } else {
        logger.info(`Clicking Follow button for ${username}...`);

        try {
          // Click Follow button
          await actionButton.click();
          await page.waitForTimeout(5000); // Wait longer for Instagram UI to update

          // Verify follow was successful by checking for "Following" or "Requested" (multi-language)
          let confirmFound = false;
          let wasFollowRequest = false;

          try {
            const allButtons = await page.locator('button, [role="button"]').all();
            logger.info(`Found ${allButtons.length} buttons/role buttons after click, checking states...`);

            // Log all button texts for debugging
            const buttonTexts = [];
            for (const btn of allButtons) {
              const text = await btn.textContent().catch(() => '');
              const trimmedText = text.trim();
              if (trimmedText) buttonTexts.push(trimmedText);

              if (isFollowingText(trimmedText)) {
                confirmFound = true;
                logger.info(`Found Following button with text: "${trimmedText}" - follow confirmed`);
                break;
              } else if (isRequestedText(trimmedText)) {
                confirmFound = true;
                wasFollowRequest = true;
                logger.info(`Found Requested button with text: "${trimmedText}" - follow request sent (private account)`);
                break;
              }
            }

            if (!confirmFound) {
              logger.info(`Button texts found: ${buttonTexts.slice(0, 10).join(', ')}`);
              // Check if original Follow button is gone (might mean success)
              const followStillExists = buttonTexts.some(t => isFollowText(t) && !isFollowingText(t));
              if (!followStillExists) {
                logger.info(`Follow button no longer visible - assuming success`);
                confirmFound = true;
              } else {
                logger.warning(`Could not verify follow - Follow button still present`);
              }
            }
          } catch (e) {
            logger.warning(`Could not verify follow completion: ${e.message}`);
          }

          if (confirmFound) {
            const successStatus = wasFollowRequest ? 'requested' : 'followed';
            const successMessage = wasFollowRequest ? 'Follow request sent' : 'Successfully followed';
            logger.info(`${username}: ${successMessage}`);
            results.push({
              username,
              status: successStatus,
              success: true,
              reason: successMessage,
              timestamp: new Date().toISOString(),
              runDate: new Date().toISOString(),
              accountType,
            });
            if (wasFollowRequest) {
              requestedCount++;
            }
            followCount++;
          } else {
            remainingUsers.push(username);
            throw new Error('follow action did not complete - verification button not found');
          }
        } catch (clickError) {
          logger.error(`Error clicking Follow button: ${clickError.message}`);
          throw clickError;
        }
      }

      // Add delay between follows (with random variation)
      const randomDelay = (Math.random() - 0.5) * 2 * randomDelayVariation;
      const actualDelay = (delayBetweenFollows + randomDelay) * 1000;

      if (actualDelay > 0) {
        logger.info(`Waiting ${Math.round(actualDelay / 1000)}s before next follow`);
        await page.waitForTimeout(Math.max(actualDelay, 100)); // Minimum 100ms for safety
      } else {
        logger.info(`No delay between follows`);
      }

    } catch (error) {
      logger.error(`Error processing ${username}: ${error.message}`);

      // Check for rate limiting
      if (error.message.includes('rate') || error.message.includes('429')) {
        rateLimited = true;
        results.push({
          username,
          status: 'failed',
          success: false,
          reason: 'Rate limited',
          timestamp: new Date().toISOString(),
          runDate: new Date().toISOString(),
          accountType,
        });
        logger.warning('Rate limit detected, stopping actor');
        // Add remaining users to the list for next run
        const currentIndex = usersToProcessThisRun.indexOf(username);
        remainingUsers.push(...usersToProcessThisRun.slice(currentIndex + 1));
        break;
      }

      results.push({
        username,
        status: 'failed',
        success: false,
        reason: error.message,
        timestamp: new Date().toISOString(),
        runDate: new Date().toISOString(),
        accountType,
      });
      failedCount++;
    }
  }

  // Close browser
  await browser.close();

  // Save results
  for (const result of results) {
    await dataset.pushData(result);
  }

  // Save cleaned input for next run (users not yet followed)
  const cleanedUsers = [...remainingUsers, ...usersNotProcessed];
  await keyValueStore.setValue('CLEANED_INPUT', {
    usersToFollow: cleanedUsers,
    lastUpdated: new Date().toISOString(),
  });
  logger.info(`Saved ${cleanedUsers.length} users to CLEANED_INPUT for next run`);

  // Add summary
  const summary = {
    type: 'summary',
    action: 'follow',
    totalProcessed: usersToProcessThisRun.length,
    successCount: followCount,
    requestedCount,
    alreadyFollowingCount,
    failedCount,
    remainingUsers: cleanedUsers.length,
    rateLimited,
    timestamp: new Date().toISOString(),
  };

  await dataset.pushData(summary);

  logger.info('=== SUMMARY ===');
  logger.info(`Total processed: ${summary.totalProcessed}`);
  logger.info(`Successfully followed: ${followCount - requestedCount}`);
  logger.info(`Follow requests sent: ${requestedCount}`);
  logger.info(`Already following: ${alreadyFollowingCount}`);
  logger.info(`Failed: ${failedCount}`);
  logger.info(`Remaining for next run: ${cleanedUsers.length}`);
  if (rateLimited) {
    logger.warning('Rate limit detected - actor stopped');
  }

  logger.info('Instagram Auto Follow Actor finished');

  // Exit the actor
  await Actor.exit();
} catch (error) {
  console.error('Fatal error:', error);
  await Actor.exit();
}
