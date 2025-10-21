import { Actor } from 'apify';
import { chromium } from 'playwright';

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
    delayBetweenFollows = 45,
    randomDelayVariation = 15,
    accountType = 'mature',
    action = 'follow', // 'follow' or 'unfollow'
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
  logger.info(`Action: ${action}`);
  logger.info(`Max actions per run: ${maxFollowsPerRun}`);
  logger.info(`Delay between actions: ${delayBetweenFollows}s (±${randomDelayVariation}s)`);

  // Initialize storage
  const dataset = await Actor.openDataset();

  // Use provided users list
  let targetUsers = [...usersToFollow];
  logger.info(`Total users to process: ${targetUsers.length}`);

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

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

  // Navigate to Instagram with lenient timeout
  try {
    await page.goto('https://www.instagram.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (e) {
    logger.warning('Instagram home page load timeout, continuing anyway...');
  }

  let followCount = 0;
  let alreadyFollowingCount = 0;
  let unfollowCount = 0;
  let failedCount = 0;
  let rateLimited = false;
  const results = [];

  // Determine action and button text
  const actionButtonText = action === 'follow' ? 'Follow' : 'Following';
  const targetButtonText = action === 'follow' ? 'Following' : 'Follow';
  const actionName = action === 'follow' ? 'followed' : 'unfollowed';

  // Limit to maxFollowsPerRun
  const usersToProcessThisRun = targetUsers.slice(0, maxFollowsPerRun);
  logger.info(`Will ${action} ${usersToProcessThisRun.length} users in this run`);

  // Process each user
  for (const username of usersToProcessThisRun) {
    try {
      logger.info(`Processing user: ${username}`);

      // Navigate to user profile
      const profileUrl = `https://www.instagram.com/${username}/`;
      logger.info(`Navigating to: ${profileUrl}`);
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {
        throw new Error('Failed to navigate to profile URL');
      });

      // Wait for page to load
      await page.waitForTimeout(2000);

      // Check if profile exists - look for username in header or profile info
      const profileExists = await page.evaluate(() => {
        // Check for various profile indicators
        const header = document.querySelector('header');
        const profileName = document.querySelector('h2');
        const profileInfo = document.querySelector('[class*="ProfileInfoSection"]');
        return !!(header || profileName || profileInfo);
      });

      if (!profileExists) {
        throw new Error('Profile not found or is private');
      }

      logger.info(`Profile found for ${username}, looking for action button...`);

      // Look for action button with multiple selector strategies
      let actionButton = null;
      
      // Strategy 1: Direct text match with has-text
      actionButton = await page.$(`button:has-text("${actionButtonText}")`).catch(() => null);
      
      // Strategy 2: Look for button by aria-label
      if (!actionButton) {
        const ariaLabel = action === 'follow' ? 'Follow' : 'Following';
        actionButton = await page.$(`button[aria-label*="${ariaLabel}"]`).catch(() => null);
      }
      
      // Strategy 3: Search all buttons for text content
      if (!actionButton) {
        actionButton = await page.evaluate((buttonText) => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.find(btn => btn.textContent.trim() === buttonText) || null;
        }, actionButtonText).then(el => el ? page.$(`.button-like-element`) : null).catch(() => null);
      }

      if (!actionButton) {
        // Check for the opposite state (already in desired state)
        let oppositeButton = await page.$(`button:has-text("${targetButtonText}")`).catch(() => null);
        
        if (!oppositeButton) {
          oppositeButton = await page.$(`button[aria-label*="${action === 'follow' ? 'Following' : 'Follow'}"]`).catch(() => null);
        }
        
        if (oppositeButton) {
          const statusText = action === 'follow' ? 'Already following' : 'Not following';
          logger.info(`${username}: ${statusText}`);
          results.push({
            username,
            status: action === 'follow' ? 'already_following' : 'not_following',
            success: false,
            reason: statusText,
            timestamp: new Date().toISOString(),
            runDate: new Date().toISOString(),
            accountType,
          });
          alreadyFollowingCount++;
        } else {
          throw new Error('Action button not found on profile');
        }
      } else {
        logger.info(`Found action button for ${username}, clicking...`);
        // Click action button
        await actionButton.click();
        await page.waitForTimeout(1500);

        // Verify action was successful by checking for the opposite button
        let confirmButton = await page.$(`button:has-text("${targetButtonText}")`).catch(() => null);
        
        if (!confirmButton) {
          confirmButton = await page.$(`button[aria-label*="${action === 'follow' ? 'Following' : 'Follow'}"]`).catch(() => null);
        }
        
        if (confirmButton) {
          const successStatus = action === 'follow' ? 'followed' : 'unfollowed';
          logger.info(`${username}: Successfully ${actionName}`);
          results.push({
            username,
            status: successStatus,
            success: true,
            reason: `Successfully ${actionName}`,
            timestamp: new Date().toISOString(),
            runDate: new Date().toISOString(),
            accountType,
          });
          if (action === 'follow') {
            followCount++;
          } else {
            unfollowCount++;
          }
        } else {
          throw new Error(`${action} action did not complete`);
        }
      }

      // Add delay between actions (with random variation)
      const randomDelay = (Math.random() - 0.5) * 2 * randomDelayVariation;
      const actualDelay = (delayBetweenFollows + randomDelay) * 1000;
      
      if (actualDelay > 0) {
        logger.info(`Waiting ${Math.round(actualDelay / 1000)}s before next action`);
        await page.waitForTimeout(Math.max(actualDelay, 100)); // Minimum 100ms for safety
      } else {
        logger.info(`No delay between actions`);
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

  // Add summary
  const summary = {
    type: 'summary',
    action,
    totalProcessed: usersToProcessThisRun.length,
    successCount: action === 'follow' ? followCount : unfollowCount,
    alreadyActionedCount: alreadyFollowingCount,
    failedCount,
    rateLimited,
    timestamp: new Date().toISOString(),
  };

  await dataset.pushData(summary);

  logger.info('=== SUMMARY ===');
  logger.info(`Action: ${action}`);
  logger.info(`Total processed: ${summary.totalProcessed}`);
  logger.info(`Successfully ${actionName}: ${summary.successCount}`);
  logger.info(`Already ${actionName}: ${alreadyFollowingCount}`);
  logger.info(`Failed: ${failedCount}`);
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
