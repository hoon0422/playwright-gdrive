import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, type BrowserContext, type Page } from 'playwright';

const USER_DATA_DIR = path.join(process.cwd(), '.user_data');

async function main() {
  const args = process.argv.slice(2);
  const waitLogin = args.includes('--wait-login');
  const cleanArgs = args.filter(arg => arg !== '--wait-login');

  if (cleanArgs.length < 2) {
    console.error('Usage: bun run download <url1> [url2 ... url10] <output_dir> [--wait-login]');
    process.exit(1);
  }

  const outputDir = cleanArgs.pop()!;
  const targetUrls = cleanArgs;

  if (targetUrls.length > 10) {
    console.error('Error: Maximum 10 URLs allowed.');
    process.exit(1);
  }
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Launching browser...`);
  console.log(`User Data Dir: ${USER_DATA_DIR}`);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false, // Start non-headless for manual login if needed
    acceptDownloads: true,
    args: ['--start-maximized'],
    viewport: null,
  });

  try {
    // --- Login Check Phase ---
    // We use the first URL (or a generic one) to check for login status.
    // This ensures we are logged in before starting parallel downloads.
    const firstPage = context.pages()[0] || await context.newPage();
    const checkUrl = targetUrls[0]; // Use the first URL for login check

    console.log(`Checking login status with ${checkUrl}...`);
    await firstPage.goto(checkUrl, { waitUntil: 'domcontentloaded' });

    if (waitLogin) {
      console.log('Waiting for login... Please log in manually in the browser.');
      console.log('Press Enter in this terminal when you are ready to proceed...');
      await new Promise(resolve => process.stdin.once('data', resolve));
      
      // After manual login, we might need to reload or just proceed.
      // The parallel tasks will handle their own navigation.
    } else {
      // Check for login redirection
      if (firstPage.url().includes('accounts.google.com') || firstPage.url().includes('ServiceLogin')) {
        console.log('Login required. Please log in manually in the browser window.');
        console.log('Waiting for navigation to Google Drive/Docs...');
        
        // Wait until we are redirected back to a google drive/docs domain
        await firstPage.waitForURL(/.*(drive|docs)\.google\.com.*/, { timeout: 0 });
        console.log('Login detected. Proceeding...');
      }
    }
    
    // Close the check page if it's not needed, or just leave it.
    // We will create new pages for each task to ensure isolation and parallelism.
    await firstPage.close();

    // --- Parallel Download Phase ---
    console.log(`Starting downloads for ${targetUrls.length} URLs...`);
    
    const tasks = targetUrls.map(url => processUrl(context, url, outputDir));
    await Promise.all(tasks);
    
    console.log('All downloads completed.');

  } catch (error) {
    console.error('An error occurred during execution:', error);
  } finally {
    console.log('Closing browser...');
    await context.close();
  }
}

async function processUrl(context: BrowserContext, targetUrl: string, outputDir: string) {
  const page = await context.newPage();
  try {
    console.log(`[${targetUrl}] Processing...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    
    // Wait a bit for the page to settle
    await page.waitForTimeout(3000);

    const url = page.url();
    
    if (url.includes('/document/d/')) {
      await handleGoogleDoc(page, url, outputDir);
    } else if (url.includes('/spreadsheets/d/')) {
      await handleGoogleSheet(page, url, outputDir);
    } else if (url.includes('/presentation/d/')) {
      await handleGoogleSlide(page, url, outputDir);
    } else if (url.includes('/drive/folders/') || url.includes('/drive/u/0/folders/')) {
      await handleGoogleFolder(page, outputDir);
    } else {
      console.error(`[${targetUrl}] Unsupported URL type.`);
    }
    console.log(`[${targetUrl}] Done.`);
  } catch (error) {
    console.error(`[${targetUrl}] Error:`, error);
  } finally {
    await page.close();
  }
}

function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}${ms}`;
}

function sanitizeFilename(name: string) {
  // Remove invalid characters: < > : " / \ | ? * and control characters
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
}

async function getPageTitle(page: Page) {
  let title = await page.title();
  // Remove common suffixes
  title = title.replace(/ - Google (Docs|Sheets|Slides|Drive)$/, '');
  return sanitizeFilename(title);
}

async function downloadFile(page: Page, exportUrl: string, destPath: string) {
  console.log(`Initiating download from: ${exportUrl}`);
  
  const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
  
  // Trigger download
  try {
    await page.goto(exportUrl);
  } catch (error) {
    // Ignore errors caused by navigation being aborted by download
  }

  const download = await downloadPromise;
  console.log(`Download started: ${download.suggestedFilename()}`);
  
  await download.saveAs(destPath);
  console.log(`Saved to: ${destPath}`);
}

async function handleGoogleDoc(page: Page, url: string, outputDir: string) {
  console.log('Detected Google Doc.');
  const title = await getPageTitle(page);
  const timestamp = getTimestamp();
  const filename = `${title}_${timestamp}.docx`;
  const finalPath = path.join(outputDir, filename);

  // Extract ID
  const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error('Could not extract Doc ID');
  const id = match[1];
  
  const exportUrl = `https://docs.google.com/document/d/${id}/export?format=docx`;
  
  await downloadFile(page, exportUrl, finalPath);
}

async function handleGoogleSheet(page: Page, url: string, outputDir: string) {
  console.log('Detected Google Sheet.');
  const title = await getPageTitle(page);
  const timestamp = getTimestamp();
  const filename = `${title}_${timestamp}.xlsx`;
  const finalPath = path.join(outputDir, filename);

  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error('Could not extract Sheet ID');
  const id = match[1];
  
  const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  
  await downloadFile(page, exportUrl, finalPath);
}

async function handleGoogleSlide(page: Page, url: string, outputDir: string) {
  console.log('Detected Google Slide.');
  const title = await getPageTitle(page);
  const timestamp = getTimestamp();
  const filename = `${title}_${timestamp}.pptx`;
  const finalPath = path.join(outputDir, filename);

  const match = url.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error('Could not extract Slide ID');
  const id = match[1];
  
  const exportUrl = `https://docs.google.com/presentation/d/${id}/export/pptx`;
  
  await downloadFile(page, exportUrl, finalPath);
}

async function handleGoogleFolder(page: Page, outputDir: string) {
  console.log('Detected Google Drive Folder.');
  
  // Wait for the main content to load
  await page.waitForSelector('div[role="main"]', { timeout: 10000 });

  const title = await getPageTitle(page);
  const timestamp = getTimestamp();
  const folderName = `${title}_${timestamp}`;
  
  // We will download the zip to a temp file in outputDir, then extract to outputDir/folderName
  const zipFilename = `${folderName}.zip`;
  const zipPath = path.join(outputDir, zipFilename);
  const extractPath = path.join(outputDir, folderName);

  console.log('Attempting to open folder actions menu...');
  
  // Strategy 1: Look for "More actions" button (3 dots)
  const moreActionsBtn = page.locator('button[aria-label="More actions"]');
  // Strategy 2: Click the folder title (H1)
  const folderTitleBtn = page.locator('h1');

  let menuOpened = false;

  if (await moreActionsBtn.isVisible()) {
      console.log('Found "More actions" button. Clicking...');
      await moreActionsBtn.click();
      menuOpened = true;
  } else if (await folderTitleBtn.isVisible()) {
      console.log('Found folder title. Clicking...');
      await folderTitleBtn.click();
      menuOpened = true;
  } else {
      // Fallback
      const headerBtn = page.locator('div[role="banner"] button[aria-haspopup="true"], div[role="main"] button[aria-haspopup="true"]').first();
      if (await headerBtn.isVisible()) {
          console.log('Found a potential menu button. Clicking...');
          await headerBtn.click();
          menuOpened = true;
      }
  }

  if (!menuOpened) {
      throw new Error('Could not find a way to open the folder actions menu.');
  }

  // Wait for menu to appear
  const downloadMenuItem = page.locator('div[role="menuitem"]:has-text("Download")');
  
  try {
      await downloadMenuItem.waitFor({ timeout: 5000 });
  } catch (e) {
      console.log('Download menu item not found immediately. Trying to find it in submenus or checking if menu actually opened.');
      throw new Error('Download option not found in the menu.');
  }
  
  console.log('Found Download option. Clicking...');
  
  const downloadPromise = page.waitForEvent('download', { timeout: 300000 }); 
  await downloadMenuItem.click();
  
  console.log('Waiting for zip generation and download (this may take a while)...');
  const download = await downloadPromise;
  
  console.log(`Downloading zip to: ${zipPath}`);
  await download.saveAs(zipPath);
  
  // Unzip
  console.log('Unzipping...');
  const zip = new AdmZip(zipPath);
  
  // Ensure extract directory exists
  if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
  }

  zip.extractAllTo(extractPath, true);
  console.log(`Extracted to: ${extractPath}`);
  
  // Cleanup zip
  fs.unlinkSync(zipPath);
  console.log('Removed temporary zip file.');
}

main();
