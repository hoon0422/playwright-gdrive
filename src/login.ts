import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npm run login <user_data_dir>');
    process.exit(1);
  }

  const userDataDir = path.resolve(process.cwd(), args[0]);

  console.log(`Using user data directory: ${userDataDir}`);

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  console.log('Launching browser for login...');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: ['--start-maximized'],
    viewport: null,
  });

  const page = context.pages()[0] || await context.newPage();
  
  console.log('Navigating to Google Accounts...');
  await page.goto('https://accounts.google.com/');

  console.log('Please log in to your Google account.');
  console.log('The session will be saved to the specified directory.');
  console.log('Close the browser window when you are finished.');

  // Keep the script running until the browser is closed
  await new Promise<void>((resolve) => {
    context.on('close', () => {
      console.log('Browser closed. Session saved.');
      resolve();
    });
  });
}

main().catch(console.error);
