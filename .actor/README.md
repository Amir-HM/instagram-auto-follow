# Instagram Auto Follow Actor

Automatically follow Instagram accounts with smart pacing to avoid action blocks. Uses session cookies for authentication (no password storage required!).

## Features

- **Cookie-Based Authentication**: No need to store passwords - just paste your session cookie
- **Smart Pacing**: Configurable delays between follows with random variation to mimic human behavior
- **Account Type Support**: Different limits for new/high-activity accounts vs. mature accounts
- **Rate Limit Detection**: Automatically stops when Instagram rate limits are detected
- **Multi-Language Support**: Works with Instagram in 20+ languages
- **Proxy Support**: Residential proxy configuration for better success rates
- **Detailed Logging**: Track every action and get a comprehensive summary

## How to Get Your Instagram Session Cookie

1. **Open Instagram in your browser** and log in
2. **Open Developer Tools**:
   - Chrome/Edge: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Firefox: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)

3. **Navigate to the Cookies section**:
   - Chrome/Edge: Go to `Application` tab -> `Storage` -> `Cookies` -> `https://www.instagram.com`
   - Firefox: Go to `Storage` tab -> `Cookies` -> `https://www.instagram.com`

4. **Find the `sessionid` cookie** and copy its value (long string of letters and numbers)

5. **Paste it into the input** when running the actor

**Important**: Keep your session cookie private! It gives full access to your Instagram account.

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
- **delayBetweenFollows** (optional, default: 15): Time to wait between each follow action in seconds
- **randomDelayVariation** (optional, default: 5): Random variation added to delays (+-seconds)
- **accountType** (optional, default: mature): Either "new" (10-20/day) or "mature" (20-40/day)
- **useCleanedInput** (optional, default: false): Auto-uses cleaned input from previous run to skip already followed accounts
- **proxyConfiguration** (optional): Proxy settings - residential proxies recommended

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
   - Check the "Use Cleaned Input from Previous Run" option
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

The actor provides detailed results in the dataset:

### Per-User Results
- **username**: Instagram username
- **status**: One of `followed`, `requested`, `already_following`, or `failed`
- **success**: Boolean flag
- **reason**: Explanation of the result
- **timestamp**: When the action was performed

### Summary Entry
- **totalProcessed**: Total users attempted
- **successCount**: Successfully followed
- **requestedCount**: Follow requests sent (private accounts)
- **alreadyFollowingCount**: Users already being followed
- **failedCount**: Failed attempts
- **remainingUsers**: Number of users still left to follow

## Troubleshooting

### "Session cookie is expired or invalid"
- Your session cookie may have expired
- Get a fresh cookie from your browser

### "Rate limited - stopping actor"
- Instagram detected unusual activity
- Wait 24-48 hours before running again
- Try increasing delays in your next run

### "Profile not found"
- The username may not exist
- Check the spelling of the username
