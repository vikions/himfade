import { expect, test } from '@playwright/test';

test('Nado-first demo flow stays separate from proof', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByText('THE ETERNAL BULL')).toBeVisible();
  await expect(page.getByRole('button', { name: /FADE ON NADO/ })).toBeVisible();
  await page.getByLabel('USD notional').fill('25');
  await expect(page.getByText('SHORT ETH').first()).toBeVisible();
  await page.locator('[aria-label="Execution venue"]').getByRole('button', { name: /PACIFICA/ }).click();
  await expect(page.getByRole('button', { name: /FADE ON PACIFICA/ })).toBeVisible();
  await page.getByRole('button', { name: /FADE ON PACIFICA/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('review.png'), fullPage: true });
  await expect(page.getByText('Missing builder code — demo only')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm and sign' }).click();
  await expect(page.getByText('DEMO — NOT PROTOCOL PROOF')).toBeVisible();
  await page.getByRole('link', { name: /Open proof/ }).click();
  await expect(page.getByText('Pacifica attributed fill')).toContainText('incomplete');
  await expect(page.getByText('Demo receipts exist locally')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('proof.png'), fullPage: true });
});
