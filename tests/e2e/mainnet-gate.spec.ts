import { expect, test } from '@playwright/test';

test('mainnet interface fails closed while builder onboarding is pending', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByText('THE ETERNAL BULL')).toBeVisible();
  await expect(page.getByText('mainnet', { exact: true })).toBeVisible();
  await expect(page.getByText(/demo|testnet/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /FADE ON NADO/ })).toBeVisible();
  await page.getByLabel('USD notional').fill('25');
  await expect(page.getByText('SHORT ETH').first()).toBeVisible();
  await page.getByRole('button', { name: /FADE ON NADO/ }).click();
  await expect(page.locator('.execution-error')).toContainText('Nado builder configuration is pending');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('nado-gate.png'), fullPage: true });

  await page.locator('[aria-label="Execution venue"]').getByRole('button', { name: /PACIFICA/ }).click();
  await expect(page.getByRole('button', { name: /FADE ON PACIFICA/ })).toBeVisible();
  await page.getByRole('button', { name: /FADE ON PACIFICA/ }).click();
  await expect(page.locator('.execution-error')).toContainText('Pacifica builder configuration is pending');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('link', { name: /Proof/ }).click();
  await expect(page.getByText('inkMainnet')).toBeVisible();
  await expect(page.locator('.proof-card').filter({ hasText: 'Pacifica' }).getByText('mainnet', { exact: true })).toBeVisible();
  await expect(page.getByText('Pacifica attributed fill')).toContainText('incomplete');
  await page.screenshot({ path: testInfo.outputPath('proof.png'), fullPage: true });
});
