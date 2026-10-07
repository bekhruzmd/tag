import { test, expect } from "@playwright/test";
test("practice loop reaches a server-independent demo result without layout overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Hide and seek on your campus/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: /Try practice mode/ }).click();
  await expect(page.getByText("PRACTICE · SIMULATED PLAYERS")).toBeVisible();
  await page.getByRole("button", { name: "I’m ready", exact: true }).click();
  await page.getByRole("button", { name: /Start the game/ }).click();
  await expect(
    page.getByText("YOU ARE A SEEKER", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Practice a confirmed tag" }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("THE HUNT BEGINS", { exact: true })).toBeHidden({
    timeout: 5000,
  });
  for (let i = 0; i < 4; i++)
    await page
      .getByRole("button", { name: "Practice a confirmed tag" })
      .click();
  await expect(
    page.getByRole("heading", { name: /seekers take the win/i }),
  ).toBeVisible();
  await expect(page.getByText("Location sharing has stopped.")).toBeVisible();
  await page.getByRole("button", { name: "Back to base" }).click();
  await expect(
    page.getByRole("button", { name: "Create a game" }),
  ).toBeVisible();
});
test("join form does not enable participation without explicit consent", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Join with code" }).click();
  await page.getByLabel("Your callsign").fill("Taylor");
  await page.getByLabel("Room code").fill("ABC123");
  await expect(page.getByRole("button", { name: "Join lobby" })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Join lobby" })).toBeEnabled();
});
test("host can preview the safe-zone size while editing settings", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Try practice mode/ }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByText(/Safe zone 800 m across/)).toBeVisible();
  await page.getByLabel(/Starting radius/).fill("200");
  await expect(page.getByText(/Safe zone 400 m across/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
