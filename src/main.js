import { Actor } from 'apify';
import { chromium } from 'playwright';

// Initialize the actor on the Apify platform
await Actor.init();

try {
  // Get input
  const input = await Actor.getInput() || {};
  const {
    sessionCookie,
    usersToFollow = [],
    maxFollowsPerRun = 20,
    delayBetweenFollows = 45,
    randomDelayVariation = 15,
    accountType = 'mature',
    useCleanedInput = false,
    scrapFromProfile,
    scrapFromPost,
    maxScrapesToFollow = 50,
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
  logger.info(`Delay between follows: ${delayBetweenFollows}s (±${randomDelayVariation}s)`);

  // Initialize storage
  const dataset = await Actor.openDataset();
  const kvStore = await Actor.openKeyValueStore();

  // Load cleaned input if requested
  let targetUsers = [...usersToFollow];
  if (useCleanedInput) {
    try {
      const cleaned = await kvStore.getValue('CLEANED_INPUT');
      if (cleaned) {
        targetUsers = JSON.parse(cleaned);
        logger.info(`Loaded ${targetUsers.length} users from cleaned input`);
      }
    } catch (e) {
      logger.warning('Could not load cleaned input, using provided users');
    }
  }

  // Scrape users from profile if provided
  if (scrapFromProfile) {
    logger.info(`Scraping followers from profile: ${scrapFromProfile}`);
    const scrapedUsers = await scrapeProfileFollowers(
      scrapFromProfile,
      sessionCookie,
      maxScrapesToFollow
    );
    targetUsers = [...targetUsers, ...scrapedUsers];
    logger.info(`Added ${scrapedUsers.length} users from profile scraping`);
  }

  // Scrape users from post if provided
  if (scrapFromPost) {
    logger.info(`Scraping likers from post: ${scrapFromPost}`);
    const scrapedUsers = await scrapePostLikers(
      scrapFromPost,
      sessionCookie,
      maxScrapesToFollow
    );
    targetUsers = [...targetUsers, ...scrapedUsers];
    logger.info(`Added ${scrapedUsers.length} users from post scraping`);
  }

  // Remove duplicates
  targetUsers = [...new Set(targetUsers)];
  logger.info(`Total unique users to process: ${targetUsers.length}`);

  // Limit to maxFollowsPerRun
  const usersToFollowThisRun = targetUsers.slice(0, maxFollowsPerRun);
  logger.info(`Will follow ${usersToFollowThisRun.length} users in this run`);

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.createBrowserContext();
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

  // Navigate to Instagram
  await page.goto('https://www.instagram.com', { waitUntil: 'networkidle' });

  let followCount = 0;
  let alreadyFollowingCount = 0;
  let failedCount = 0;
  let rateLimited = false;
  const results = [];

  // Process each user
  for (const username of usersToFollowThisRun) {
    try {
      logger.info(`Processing user: ${username}`);

      // Navigate to user profile
      const profileUrl = `https://www.instagram.com/${username}/`;
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {
        throw new Error('Profile not found');
      });

      // Wait for page to load
      await page.waitForTimeout(2000);

      // Check if profile exists and is not private
      const profileExists = await page.evaluate(() => {
        return document.querySelector('h2') !== null;
      });

      if (!profileExists) {
        throw new Error('Profile not found or is private');
      }

      // Look for Follow button
      const followButton = await page.$('button:has-text("Follow")');

      if (!followButton) {
        // Check if already following
        const alreadyFollowingButton = await page.$('button:has-text("Following")');
        if (alreadyFollowingButton) {
          results.push({
            username,
            status: 'already_following',
            success: false,
            reason: 'Already following',
            timestamp: new Date().toISOString(),
            runDate: new Date().toISOString(),
            accountType,
          });
          alreadyFollowingCount++;
          logger.info(`${username}: Already following`);
        } else {
          throw new Error('Follow button not found');
        }
      } else {
        // Click Follow button
        await followButton.click();
        await page.waitForTimeout(1000);

        // Verify follow was successful
        const confirmFollowing = await page.$('button:has-text("Following")');
        if (confirmFollowing) {
          results.push({
            username,
            status: 'followed',
            success: true,
            reason: 'Successfully followed',
            timestamp: new Date().toISOString(),
            runDate: new Date().toISOString(),
            accountType,
          });
          followCount++;
          logger.info(`${username}: Successfully followed`);
        } else {
          throw new Error('Follow action did not complete');
        }
      }

      // Add delay between follows (with random variation)
      const randomDelay = (Math.random() - 0.5) * 2 * randomDelayVariation;
      const actualDelay = (delayBetweenFollows + randomDelay) * 1000;
      logger.info(`Waiting ${Math.round(actualDelay / 1000)}s before next follow`);
      await page.waitForTimeout(Math.max(actualDelay, 5000)); // Minimum 5s delay

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

  // Calculate remaining users
  const remainingUsers = targetUsers.slice(maxFollowsPerRun);

  // Save cleaned input for next run
  if (remainingUsers.length > 0) {
    await kvStore.setValue('CLEANED_INPUT', JSON.stringify(remainingUsers));
    logger.info(`Saved ${remainingUsers.length} users for next run`);
  }

  // Save results
  for (const result of results) {
    await dataset.pushData(result);
  }

  // Add summary
  const summary = {
    type: 'summary',
    totalProcessed: usersToFollowThisRun.length,
    followCount,
    alreadyFollowingCount,
    failedCount,
    rateLimited,
    remainingUsers: remainingUsers.length,
    removedSuccessfully: followCount,
    timestamp: new Date().toISOString(),
  };

  await dataset.pushData(summary);

  logger.info('=== SUMMARY ===');
  logger.info(`Total processed: ${summary.totalProcessed}`);
  logger.info(`Successfully followed: ${followCount}`);
  logger.info(`Already following: ${alreadyFollowingCount}`);
  logger.info(`Failed: ${failedCount}`);
  logger.info(`Remaining users for next run: ${remainingUsers.length}`);
  if (rateLimited) {
    logger.warning('Rate limit detected - actor stopped');
  }

  logger.info('=== CLEANED INPUT FOR NEXT RUN ===');
  logger.info(JSON.stringify(remainingUsers));

  logger.info('Instagram Auto Follow Actor finished');

  // Exit the actor
  await Actor.exit();
} catch (error) {
  console.error('Fatal error:', error);
  await Actor.exit();
}

/**
 * Scrape followers from a public Instagram profile
 */
async function scrapeProfileFollowers(profileUsername, sessionCookie, maxToScrape) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  const followers = [];

  try {
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

    const profileUrl = `https://www.instagram.com/${profileUsername}/`;
    await page.goto(profileUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click followers count to open followers modal
    const followersLink = await page.$('a[href*="followers"]');
    if (followersLink) {
      await followersLink.click();
      await page.waitForTimeout(1000);

      // Scroll through followers list and collect usernames
      const followersList = await page.$('[role="dialog"]');
      if (followersList) {
        let previousHeight = 0;
        let currentHeight = 0;

        while (followers.length < maxToScrape) {
          currentHeight = await page.evaluate(() => {
            const listContainer = document.querySelector('[role="dialog"] div');
            return listContainer ? listContainer.scrollHeight : 0;
          });

          if (currentHeight === previousHeight) break;

          await page.evaluate(() => {
            const listContainer = document.querySelector('[role="dialog"] div');
            if (listContainer) listContainer.scrollTop = listContainer.scrollHeight;
          });

          await page.waitForTimeout(500);
          previousHeight = currentHeight;
        }

        // Extract usernames
        const usernames = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('[role="dialog"] a[title]'));
          return links.map(link => link.textContent.trim()).filter(name => name && name.length > 0);
        });

        followers.push(...usernames.slice(0, maxToScrape));
      }
    }
  } catch (error) {
    console.warn(`Error scraping followers from ${profileUsername}: ${error.message}`);
  } finally {
    await browser.close();
  }

  return followers;
}

/**
 * Scrape likers from an Instagram post
 */
async function scrapePostLikers(postUrl, sessionCookie, maxToScrape) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  const likers = [];

  try {
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

    await page.goto(postUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click likes count to open likers modal
    const likesLink = await page.$('a[href*="liked_by"]');
    if (likesLink) {
      await likesLink.click();
      await page.waitForTimeout(1000);

      // Scroll through likers list and collect usernames
      const likersList = await page.$('[role="dialog"]');
      if (likersList) {
        let previousHeight = 0;
        let currentHeight = 0;

        while (likers.length < maxToScrape) {
          currentHeight = await page.evaluate(() => {
            const listContainer = document.querySelector('[role="dialog"] div');
            return listContainer ? listContainer.scrollHeight : 0;
          });

          if (currentHeight === previousHeight) break;

          await page.evaluate(() => {
            const listContainer = document.querySelector('[role="dialog"] div');
            if (listContainer) listContainer.scrollTop = listContainer.scrollHeight;
          });

          await page.waitForTimeout(500);
          previousHeight = currentHeight;
        }

        // Extract usernames
        const usernames = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('[role="dialog"] a[title]'));
          return links.map(link => link.textContent.trim()).filter(name => name && name.length > 0);
        });

        likers.push(...usernames.slice(0, maxToScrape));
      }
    }
  } catch (error) {
    console.warn(`Error scraping likers from post: ${error.message}`);
  } finally {
    await browser.close();
  }

  return likers;
}
