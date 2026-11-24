import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startHqServer} from './server.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
const runtime=await startHqServer({port:0,storageDir:false,autoAdvance:true});const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});const page=await context.newPage();
try {
 await page.goto(`${runtime.url}/accounts?record=${seedIDs.approvedAccount}`);await page.locator('.hq-account-workspace').waitFor();await page.locator('[role=tab][data-tab-key="contacts"]').click();await page.getByTestId('new-contact').click();const modal=page.locator('dialog.hq-customer-modal[open]');await modal.locator('[data-field-key="contactName"]').fill('크기변경 보존 시험');
 await page.setViewportSize({width:390,height:844});await modal.waitFor({timeout:3000});assert.equal(await modal.locator('[data-field-key="contactName"]').inputValue(),'크기변경 보존 시험');assert.equal(await page.locator('[role=tab][data-tab-key="contacts"]').getAttribute('aria-selected'),'true');
 await page.setViewportSize({width:1440,height:900});assert.equal(await modal.locator('[data-field-key="contactName"]').inputValue(),'크기변경 보존 시험');await page.screenshot({fullPage:true});assert.equal(await modal.locator('[data-field-key="contactName"]').inputValue(),'크기변경 보존 시험');console.log('PASS: resize and full page screenshot preserve contact draft');
} finally {await context.close();await browser.close();runtime.server.closeAllConnections();await runtime.close();}
