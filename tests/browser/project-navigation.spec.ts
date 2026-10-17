import { expect, type Page, test } from "@playwright/test";

const projectPath = "/projects/IIT-2627-002";

async function login(page: Page, email = "karen@iit.test") {
  await page.goto("/login");
  await page.getByRole("button", { name: "Mulai", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Kata sandi", { exact: true }).fill("iitrack-dev-2627");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Selamat datang/ }),
  ).toBeVisible();
}

function stageButton(page: Page, n: number) {
  return page.getByRole("button", { name: new RegExp(`^Stage ${n} `) });
}

async function openDivisions(page: Page) {
  await page
    .getByText("Ringkasan per divisi (bukan alur kerja)", { exact: true })
    .click();
}

function watchPageRequests(page: Page) {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname === projectPath &&
      request.method() === "GET"
    ) {
      requests.push(request.url());
    }
  });
  return requests;
}

test("stage selection updates the panel and URL without fetching the project again", async ({
  page,
}) => {
  await login(page);
  await page.goto(`${projectPath}?stage=6&context=uat`);
  await expect(stageButton(page, 6)).toHaveAttribute("aria-current", "step");
  const requests = watchPageRequests(page);

  for (const [n, heading] of [
    [1, "Initial Communication & Requirement Gathering"],
    [2, "Feasibility Evaluation & Planning"],
    [3, "Agreement"],
    [4, "Programmer / Tech Assignment"],
    [5, "Down Payment"],
    [6, "Project Execution & Monitoring"],
    [7, "Handover & Warranty"],
    [8, "Evaluation"],
    [9, "Documentation & Closure"],
  ] as const) {
    await stageButton(page, n).click();
    await expect(stageButton(page, n)).toHaveAttribute("aria-current", "step");
    await expect(page).toHaveURL(new RegExp(`stage=${n}&context=uat$`));
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
  expect(requests).toEqual([]);

  await page.reload();
  await expect(stageButton(page, 9)).toHaveAttribute("aria-current", "step");
});

test("division tabs keep stage and other URL parameters without fetching the project again", async ({
  page,
}) => {
  await login(page);
  await page.goto(`${projectPath}?stage=6&tab=pm&context=uat`);
  await openDivisions(page);
  const requests = watchPageRequests(page);

  for (const [name, key, content] of [
    ["Technology Dev", "tech", "Technical Progress"],
    ["Finance", "finance", "Project Financial Summary"],
    ["Project Manager", "pm", "Project Overview"],
  ]) {
    const tab = page.getByRole("tab", { name, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(
      page.locator("#tampilan-divisi").getByText(content, { exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`stage=6&tab=${key}&context=uat$`));
    await expect(stageButton(page, 6)).toHaveAttribute("aria-current", "step");
  }
  expect(requests).toEqual([]);
});

test("saving after changing stage refreshes the data and preserves the chosen panel", async ({
  page,
}) => {
  await login(page);
  await page.goto(`${projectPath}?stage=1&tab=tech&context=uat`);
  await stageButton(page, 6).click();
  await expect(stageButton(page, 6)).toHaveAttribute("aria-current", "step");
  await page
    .getByRole("button", { name: "Isi Latest Update", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Latest Update",
    exact: true,
  });
  const update = `Browser navigation regression ${Date.now()}`;
  await dialog.locator("textarea[name=text]").fill(update);
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText(`Latest update PM: ${update}`, { exact: true }).first(),
  ).toBeVisible();
  await expect(stageButton(page, 6)).toHaveAttribute("aria-current", "step");
  await expect(page).toHaveURL(/stage=6&tab=tech&context=uat$/);
  await page.reload();
  await expect(
    page.getByText(`Latest update PM: ${update}`, { exact: true }).first(),
  ).toBeVisible();
});

test("back and forward restore the replaced stage and division selection", async ({
  page,
}) => {
  await login(page);
  await page.goto(`${projectPath}?stage=1&tab=pm`);
  await stageButton(page, 7).click();
  await expect(stageButton(page, 7)).toHaveAttribute("aria-current", "step");
  await openDivisions(page);
  await page.getByRole("tab", { name: "Finance", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Finance", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Selamat datang/ }),
  ).toBeVisible();
  await page.goBack();
  await expect(stageButton(page, 7)).toHaveAttribute("aria-current", "step");
  await expect(page).toHaveURL(/stage=7&tab=finance$/);
  await openDivisions(page);
  await expect(
    page.getByRole("tab", { name: "Finance", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: /Selamat datang/ }),
  ).toBeVisible();
});

test("read-only users cannot gain editing actions by changing panels", async ({
  page,
}) => {
  await login(page, "admin@iit.test");
  await page.goto(`${projectPath}?stage=1`);
  await stageButton(page, 6).click();
  await expect(stageButton(page, 6)).toHaveAttribute("aria-current", "step");
  await expect(
    page.getByRole("button", { name: "Isi Latest Update", exact: true }),
  ).toHaveCount(0);
  await openDivisions(page);
  await page.getByRole("tab", { name: "Finance", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Finance", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: "Setujui Invoice", exact: true }),
  ).toHaveCount(0);
  await stageButton(page, 1).click();
  await expect(stageButton(page, 1)).toHaveAttribute("aria-current", "step");
  await expect(
    page.getByRole("button", { name: "Tandai Selesai", exact: true }),
  ).toHaveCount(0);
});

test("panel selection preserves the URL fragment and does not reset scroll", async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto(`${projectPath}?stage=1&context=uat#navigation-regression`);
  await expect(stageButton(page, 1)).toHaveAttribute("aria-current", "step");
  await page.evaluate(() => window.scrollTo(0, 100));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(100);
  await stageButton(page, 2).click();
  await expect(stageButton(page, 2)).toHaveAttribute("aria-current", "step");
  await expect(page).toHaveURL(/stage=2&context=uat#navigation-regression$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(100);
});
