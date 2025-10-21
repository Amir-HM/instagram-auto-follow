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
      try {
        await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      } catch (error) {
        throw new Error('Failed to navigate to profile URL');
      }

      // Wait for page to load
      await page.waitForTimeout(2000);

      // Check if profile exists - use multiple detection methods
      const profileExists = await page.evaluate(() => {
        // Method 1: Check for profile name header
        const profileHeader = document.querySelector('h2');
        // Method 2: Check for Instagram home icon (indicates logged in on valid profile)
        const homeIcon = document.querySelector('svg[aria-label="Home"]');
        // Method 3: Check for any main content area
        const mainContent = document.querySelector('main');
        // Method 4: Check for profile section
        const profileSection = document.querySelector('section');
        
        return !!(profileHeader || mainContent || profileSection);
      });

      if (!profileExists) {
        throw new Error('Profile not found or is private');
      }

      logger.info(`Profile found for ${username}, looking for action button...`);

      // Look for action button - use locator for better resilience
      let actionButton = null;
      let actionButtonFound = false;
      
      try {
        // Strategy 1: Try to find button with locator using text
        const buttonLocator = page.locator(`button:has-text("${actionButtonText}"), button:has-text("${actionButtonText.toLowerCase()}")`).first();
        const count = await buttonLocator.count().catch(() => 0);
        
        if (count > 0) {
          logger.info(`Found action button using text locator for "${actionButtonText}"`);
          actionButton = buttonLocator;
          actionButtonFound = true;
        }
      } catch (e) {
        logger.warning(`Strategy 1 failed: ${e.message}`);
      }
      
      // Strategy 2: Look for button by aria-label
      if (!actionButtonFound) {
        try {
          const ariaButtonLocator = page.locator(`button[aria-label*="${actionButtonText}"]`).first();
          const count = await ariaButtonLocator.count().catch(() => 0);
          
          if (count > 0) {
            logger.info(`Found action button using aria-label for "${actionButtonText}"`);
            actionButton = ariaButtonLocator;
            actionButtonFound = true;
          }
        } catch (e) {
          logger.warning(`Strategy 2 failed: ${e.message}`);
        }
      }
      
      // Strategy 3: Search all buttons for text match
      if (!actionButtonFound) {
        try {
          const allButtons = await page.locator('button').all();
          logger.info(`Found ${allButtons.length} buttons total on page`);
          
          for (const btn of allButtons) {
            const text = await btn.textContent().catch(() => '');
            if (text.trim() === actionButtonText) {
              logger.info(`Found button with exact text match: "${text.trim()}"`);
              actionButton = btn;
              actionButtonFound = true;
              break;
            }
          }
        } catch (e) {
          logger.warning(`Strategy 3 failed: ${e.message}`);
        }
      }

      if (!actionButtonFound) {
        logger.info(`Action button "${actionButtonText}" not found, checking for opposite state...`);
        
        // Check for the opposite state (already in desired state)
        let oppositeButton = null;
        let oppositeButtonFound = false;
        
        try {
          const oppositeLocator = page.locator(`button:has-text("${targetButtonText}")`).first();
          const count = await oppositeLocator.count().catch(() => 0);
          
          if (count > 0) {
            logger.info(`Found opposite button: "${targetButtonText}" - already in desired state`);
            oppositeButton = oppositeLocator;
            oppositeButtonFound = true;
          }
        } catch (e) {
          logger.warning(`Could not find opposite button: ${e.message}`);
        }
        
        if (oppositeButtonFound) {
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
          // Take screenshot for debugging
          try {
            const debugPath = `debug-${username}-${Date.now()}.png`;
            await page.screenshot({ path: debugPath });
            logger.info(`Saved debug screenshot to ${debugPath}`);
          } catch (e) {
            logger.warning(`Could not save screenshot: ${e.message}`);
          }
          throw new Error('Action button not found on profile');
        }
      } else {
        logger.info(`Found action button for ${username}, clicking...`);
        
        try {
          // Click action button
          await actionButton.click();
          await page.waitForTimeout(1500);

          // Verify action was successful by checking for the opposite button
          let confirmButton = null;
          let confirmFound = false;
          
          try {
            const confirmLocator = page.locator(`button:has-text("${targetButtonText}")`).first();
            const count = await confirmLocator.count().catch(() => 0);
            
            if (count > 0) {
              confirmButton = confirmLocator;
              confirmFound = true;
            }
          } catch (e) {
            logger.warning(`Could not verify action completion: ${e.message}`);
          }
          
          if (confirmFound) {
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
            throw new Error(`${action} action did not complete - verification button not found`);
          }
        } catch (clickError) {
          logger.error(`Error clicking action button: ${clickError.message}`);
          throw clickError;
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
