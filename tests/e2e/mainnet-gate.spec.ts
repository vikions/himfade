import { expect, test } from '@playwright/test';

test('mainnet interface stays product-facing while execution is unavailable', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page.getByText('THE ETERNAL BULL')).toBeVisible();
  await expect(page.getByText('mainnet', { exact: true })).toBeVisible();
  await expect(page.getByText(/demo|testnet/i)).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /FADE ON NADO/ }),
  ).toBeVisible();
  await expect(
    page.getByText('Connect your Ink wallet to see your balance'),
  ).toBeVisible();
  await expect(page.getByText(/builder|fee units|appendix/i)).toHaveCount(0);
  await page.getByLabel('USD notional').fill('25');
  await expect(page.getByText('SHORT ETH').first()).toBeVisible();
  await page.getByRole('button', { name: /FADE ON NADO/ }).click();
  await expect(page.locator('.execution-error')).toContainText(
    'Nado trading is temporarily unavailable',
  );
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('nado-gate.png'),
    fullPage: true,
  });

  await page
    .locator('[aria-label="Execution venue"]')
    .getByRole('button', { name: /PACIFICA/ })
    .click();
  await expect(
    page.getByRole('button', { name: /FADE ON PACIFICA/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: /FADE ON PACIFICA/ }).click();
  await expect(page.locator('.execution-error')).toContainText(
    'Pacifica trading is temporarily unavailable',
  );
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('link', { name: /Proof/ }).click();
  await expect(page.getByText('No fills yet')).toHaveCount(2);
  await expect(page.getByText('Pacifica execution')).toContainText('waiting');
  await expect(page.getByText(/builder|fee units|appendix/i)).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('proof.png'),
    fullPage: true,
  });
});
