<<<<<<< HEAD
# instagram-auto-follow
Apify actor for automatically following Instagram accounts with advanced scraping capabilities for profiles and posts
=======
# Instagram Auto Follow Actor

Automatically follow Instagram accounts with smart pacing to avoid action blocks. Uses session cookies for authentication (no password storage required!).

## Features

✅ **Cookie-Based Authentication**: No need to store passwords - just paste your session cookie  
✅ **Smart Pacing**: Configurable delays between follows with random variation to mimic human behavior  
✅ **Account Type Support**: Different limits for new/high-activity accounts vs. mature accounts  
✅ **Rate Limit Detection**: Automatically stops when Instagram rate limits are detected  
✅ **Human-like Behavior**: Random browsing actions mixed in to appear more natural  
✅ **Session Management**: Saves cookies for future runs  
✅ **Detailed Logging**: Track every action and get a comprehensive summary  
✅ **Privacy-Focused**: No personal data collection or external data transmission  

## How to Get Your Instagram Session Cookie

1. **Open Instagram in your browser** and log in
2. **Open Developer Tools**:
   - Chrome/Edge: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Firefox: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Safari: Enable Developer Menu in Preferences, then press `Cmd+Option+I`

3. **Navigate to the Cookies section**:
   - Chrome/Edge: Go to `Application` tab → `Storage` → `Cookies` → `https://www.instagram.com`
   - Firefox: Go to `Storage` tab → `Cookies` → `https://www.instagram.com`
   - Safari: Go to `Storage` tab → `Cookies` → `https://www.instagram.com`

4. **Find the `sessionid` cookie** and copy its value (long string of letters and numbers)

5. **Paste it into the input** when running the actor

⚠️ **Important**: Keep your session cookie private! It gives full access to your Instagram account.

## Recommended Settings (Safety First!)

### Brand New Accounts (First 2 weeks)
- **Max follows per run**: 5-10
- **Delay between follows**: 60-90 seconds
- **Daily limit**: 5-10 follows/day (spread across multiple runs)

### New Accounts (First 3 months)
- **Max follows per run**: 10-15
- **Delay between follows**: 45-60 seconds
- **Daily limit**: 10-15 follows/day (spread across 1-2 runs)

### Mature Accounts (3+ months old)
- **Max follows per run**: 15-25
- **Delay between follows**: 30-45 seconds
- **Daily limit**: 15-25 follows/day (spread across 1-2 runs)

### Aged Accounts (1+ years old)
- **Max follows per run**: 25-50
- **Delay between follows**: 20-30 seconds
- **Daily limit**: 25-50 follows/day (spread across 1-3 runs)

## Input Parameters

- **sessionCookie** (required, secret): Your Instagram session cookie (sessionid value from browser cookies)
- **accountType** (optional, default: mature): Account age/activity level — auto-sets safe daily follow limits
- **maxFollowsPerRun** (optional, default: 15): Maximum accounts to follow in this run (max 50, never exceed!)
- **delayBetweenFollows** (optional, default: 45): Time to wait between each follow in seconds (min 20s)
- **randomDelayVariation** (optional, default: 20): Random variation (±seconds) to mimic human behavior
- **useCleanedInput** (optional, default: false): Auto-uses cleaned input from previous run (removes already followed)
- **scrapFromProfile** (optional): Instagram username to scrape followers from and auto-follow
- **scrapFromPost** (optional): Instagram post URL to scrape likers from and auto-follow
- **maxScrapesToFollow** (optional, default: 200): Max followers/likers to scrape (1-500)
- **usersToFollow** (optional): Manual list of usernames to follow (processed in batches)

## Quick Start

1. **Get your session cookie** (see instructions above)
2. **Select your account type** to auto-set safe limits
3. **Input your data**:
   - Paste your session cookie
   - Add Instagram usernames to follow (optional)
   - OR use scraping to auto-generate follow list
4. **Run the actor** and monitor the logs
5. **Check results** in the dataset

## Batch Processing

Want to follow 500 accounts safely? Here's the recommended approach:

1. **First Run**: 
   - Paste all 500 usernames in the input
   - Set maxFollowsPerRun to 10-15 (depends on account age)
   - Run the actor (processes first batch)
   
2. **Subsequent Runs**:
   - Check the "Use Cleaned Input from Previous Run" option ✓
   - Run again (automatically processes next batch from remaining accounts)
   - Repeat until all 500 are processed
   - Spread runs across multiple days to stay safe!

The actor automatically tracks which accounts have been followed and removes them from future runs.

## Safety Tips

1. **Start Slow**: Begin with lower daily limits and gradually increase
2. **Space Out Runs**: Don't run the actor multiple times in quick succession
3. **Mix Activities**: Use your account normally between runs
4. **Watch for Warnings**: If you see "Try again later" messages, stop immediately and wait 24-48 hours
5. **Schedule Runs**: Run during your typical active hours to appear more natural

## Output

The actor provides detailed results in the dataset with the following information:

### Per-User Results
Each user gets an individual entry with:
- **username**: Instagram username
- **status**: One of `followed`, `already_following`, or `failed`
- **success**: Boolean flag (true if successfully followed, false otherwise)
- **reason**: Explanation (e.g., "Already following", "Rate limited", "Profile not found")
- **timestamp**: When the action was performed
- **runDate**: ISO timestamp of the run
- **accountType**: Account type used in settings

### Summary Entry
A final summary entry includes:
- **type**: `summary`
- **totalProcessed**: Total users attempted
- **followCount**: Successfully followed
# Instagram Auto Follow Actor

Automatically follow Instagram accounts with smart pacing to avoid action blocks. Uses session cookies for authentication (no password storage required!).

## Features

✅ **Cookie-Based Authentication**: No need to store passwords - just paste your session cookie
✅ **Smart Pacing**: Configurable delays between follows with random variation to mimic human behavior
✅ **Account Type Support**: Different limits for new/high-activity accounts vs. mature accounts
✅ **Rate Limit Detection**: Automatically stops when Instagram rate limits are detected
✅ **Human-like Behavior**: Random browsing actions mixed in to appear more natural
✅ **Session Management**: Saves cookies for future runs
✅ **Detailed Logging**: Track every action and get a comprehensive summary
✅ **Privacy-Focused**: No personal data collection or external data transmission

## How to Get Your Instagram Session Cookie

1. **Open Instagram in your browser** and log in
2. **Open Developer Tools**:
   - Chrome/Edge: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Firefox: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Safari: Enable Developer Menu in Preferences, then press `Cmd+Option+I`

3. **Navigate to the Cookies section**:
   - Chrome/Edge: Go to `Application` tab → `Storage` → `Cookies` → `https://www.instagram.com`
   - Firefox: Go to `Storage` tab → `Cookies` → `https://www.instagram.com`
   - Safari: Go to `Storage` tab → `Cookies` → `https://www.instagram.com`

4. **Find the `sessionid` cookie** and copy its value (long string of letters and numbers)

5. **Paste it into the input** when running the actor

⚠️ **Important**: Keep your session cookie private! It gives full access to your Instagram account.

## Recommended Settings

### New or High-Activity Accounts
- **Max follows per day**: 10-20
- **Delay between follows**: 45-60 seconds

### Mature Accounts
- **Max follows per day**: 20-40
- **Delay between follows**: 30-45 seconds

## Input Parameters

- **sessionCookie** (required): Your Instagram session cookie (sessionid value from browser cookies)
- **usersToFollow** (required): Array of Instagram usernames to follow
- **maxFollowsPerRun** (optional, default: 20): Maximum number of accounts to follow in this run
- **delayBetweenFollows** (optional, default: 45): Time to wait between each follow action in seconds
- **randomDelayVariation** (optional, default: 15): Random variation added to delays (±seconds)
- **accountType** (optional, default: mature): Either "new" (10-20/day) or "mature" (20-40/day)
- **useCleanedInput** (optional, default: false): Auto-uses cleaned input from previous run to skip already followed accounts

## Quick Start

1. **Get your session cookie** (see instructions above)
2. **Input your data**:
   - Paste your session cookie
   - Add Instagram usernames to follow
   - Adjust delays if needed (default is safe)
3. **Run the actor** and monitor the logs
4. **Check results** in the dataset

## Batch Processing

Want to follow 500 accounts but only do 20 at a time? Here's the easy way:

1. **First Run**:
   - Paste all 500 usernames in the input
   - Run the actor (will process first 20)

2. **Subsequent Runs**:
   - Check the "Use Cleaned Input from Previous Run" option ✓
   - Run again (will automatically process the next 20 from remaining 480)
   - Repeat until done!

The actor automatically tracks which accounts have been followed and removes them from future runs.

## Safety Tips

1. **Start Slow**: Begin with lower daily limits and gradually increase
2. **Space Out Runs**: Don't run the actor multiple times in quick succession
3. **Mix Activities**: Use your account normally between runs
4. **Watch for Warnings**: If you see "Try again later" messages, stop immediately and wait 24-48 hours
5. **Schedule Runs**: Run during your typical active hours to appear more natural

## Output

The actor provides detailed results in the dataset with the following information:

### Per-User Results
Each user gets an individual entry with:
- **username**: Instagram username
- **status**: One of `followed`, `already_following`, or `failed`
- **success**: Boolean flag (true if successfully followed, false otherwise)
- **reason**: Explanation (e.g., "Already following", "Rate limited", "Profile not found")
- **timestamp**: When the action was performed
- **runDate**: ISO timestamp of the run
- **accountType**: Account type used in settings

### Summary Entry
A final summary entry includes:
- **type**: `summary`
- **totalProcessed**: Total users attempted
- **followCount**: Successfully followed
- **alreadyFollowingCount**: Users already being followed
- **failedCount**: Failed attempts
- **rateLimited**: Whether rate limiting was encountered
- **remainingUsers**: Number of users still left to follow
- **removedSuccessfully**: Number of accounts that were successfully followed

## Automated Input Cleaning

After each run, the actor automatically creates a **cleaned input list** that excludes all successfully followed accounts. This is saved in the run's key-value storage as `CLEANED_INPUT`.

### How to Use Cleaned Input

1. **After your first run**, check the logs for the "CLEANED INPUT FOR NEXT RUN" section
2. **Copy the cleaned input JSON** provided in the logs
3. **Use it as your input** for the next run
4. **Repeat** - This prevents re-processing already followed accounts!

**Example:**
- Run 1: Follow first 10 → Creates cleaned list with remaining 40 accounts
- Run 2: Use cleaned input → Follow next 10 from the remaining 40
- Run 3: Use new cleaned input → Continue with remaining 30

This way, you can safely paste your entire follow list once and let the actor process it in batches!

## Logs

The actor prints detailed results in the logs showing every action taken, including any errors or rate limits encountered.

## Legal & Safety

- **No password storage**: Uses only session cookies
- **No credential theft**: No interaction with Instagram servers beyond normal API calls
- **Respect Instagram's ToS**: This tool is for account management only
- **Use responsibly**: Don't use this to spam or engage in malicious activity

## Troubleshooting

### "Session cookie is expired or invalid"
- Your session cookie may have expired
- Get a fresh cookie from your browser (see instructions above)

### "Rate limited - stopping actor"
- Instagram detected unusual activity
- Wait 24-48 hours before running again
- Try increasing delays in your next run

### "Profile not found"
- The username may not exist
- Check the spelling of the username
- The profile may be private (can't follow private accounts through this method)

---

**Made with ❤️ for Instagram account management automation**
