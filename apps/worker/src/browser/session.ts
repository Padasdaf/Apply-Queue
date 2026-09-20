import Browserbase from "@browserbasehq/sdk";
import { browserbase, Stagehand, type ModelName, type StagehandBrowser } from "@browserbasehq/stagehand";
import { env } from "../env.js";

export type BrowserSession = {
  browser: StagehandBrowser;
  stagehand: Stagehand;
  sessionId: string;
  liveViewUrl: string | null;
};

export async function createBrowserSession(): Promise<BrowserSession> {
  const browser = await browserbase.launch({
    apiKey: env.BROWSERBASE_API_KEY,
    keepAlive: true,
    api_timeout: 3600,
    browserSettings: { viewport: { width: 1440, height: 1000 }, blockAds: true },
  });
  const stagehand = await Stagehand.create({
    browser,
    apiKey: env.BROWSERBASE_API_KEY,
    model: { modelName: `openai/${env.OPENAI_MODEL}` as ModelName, apiKey: env.OPENAI_API_KEY },
    selfHeal: true,
    logging: { level: "info", format: "pretty" },
  });
  const sessionId = browser.sessionId;
  if (!sessionId) throw new Error("Browserbase created a browser without a session id.");

  let liveViewUrl: string | null = null;
  try {
    const sdk = new Browserbase({ apiKey: env.BROWSERBASE_API_KEY });
    const debug = await sdk.sessions.debug(sessionId);
    liveViewUrl = debug.debuggerFullscreenUrl;
  } catch (error) {
    console.warn("Could not create Browserbase live view URL", error);
  }
  return { browser, stagehand, sessionId, liveViewUrl };
}
