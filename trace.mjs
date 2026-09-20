export default async function run(page, ui) {
  // Headless Chromium will not actually grant display capture, but we can still
  // observe EXACTLY how far the host flow gets and what state it lands in.
  const home = await ui.snapshot();
  const shareRef = home.match(/@(e\d+) button "Share my screen/)?.[1];
  if (!shareRef) return { error: "share button not found", home };

  await ui.click(shareRef);
  await page.waitForTimeout(800);

  const hostView = await ui.snapshot({ full: true });

  // Now press "Start Sharing" and watch what happens.
  const before = await ui.snapshot();
  const startRef = before.match(/@(e\d+) button "Start Sharing"/)?.[1];

  let afterStart = null;
  if (startRef) {
    await ui.click(startRef);
    await page.waitForTimeout(3500);
    afterStart = await ui.snapshot({ full: true });
  }

  return { hostView, startRef: startRef ?? "NOT FOUND", afterStart };
}
