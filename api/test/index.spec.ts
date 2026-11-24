import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sample = {
  date: "2026-01-02", theme: "Fredag", drink: "Whiskey Sour",
  url: "video.mp4", photo: "photo.jpeg", note: "En fredagsdrink",
  ingredients: "6 cl whiskey;3 cl citronjuice", steps: "Skaka med is;Sila upp",
  taste: "2/5,3/5,0/5,2/5,0/5", servings: 1,
};
function request(path: string, method = "GET", body?: unknown, key?: string) {
  const headers = new Headers();
  if (key !== undefined) headers.set("X-Admin-Key", key);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  return SELF.fetch(`https://example.test${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function create(overrides = {}) {
  const response = await request("/drinks", "POST", { ...sample, ...overrides }, env.ADMIN_KEY);
  expect(response.status).toBe(201);
  return (await response.json<{ id: number }>()).id;
}
async function list() {
  const response = await request("/drinks");
  expect(response.status).toBe(200);
  return response.json<Array<Omit<typeof sample, "servings"> & { servings: number | number[]; id: number }>>();
}
beforeEach(async () => {
  // Test schema matches the columns currently used by the API.
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS drinks (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, theme TEXT, drink TEXT NOT NULL, video_url TEXT NOT NULL, photo_url TEXT, note TEXT, ingredients TEXT, steps TEXT, taste TEXT, servings INTEGER NOT NULL DEFAULT 1)`);
});

describe("public API", () => {
  it("returns an empty JSON list without authentication", async () => {
    const response = await request("/drinks");
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toEqual([]);
  });
  it("returns newest first with frontend field names and intact recipe separators", async () => {
    const oldId = await create({ date: "2025-01-01" });
    const newId = await create({ date: "2026-01-01" });
    expect(await list()).toEqual([{ ...sample, date: "2026-01-01", id: newId }, { ...sample, date: "2025-01-01", id: oldId }]);
  });
  it("defaults optional fields to empty strings", async () => {
    const response = await request("/drinks", "POST", { date: sample.date, drink: sample.drink, url: sample.url }, env.ADMIN_KEY);
    expect(response.status).toBe(201); await response.json();
    expect((await list())[0]).toMatchObject({ theme: "", photo: "", note: "", ingredients: "", steps: "", taste: "", servings: 1 });
  });
  it("returns 404 for unknown routes", async () => {
    const response = await request("/does-not-exist");
    expect(response.status).toBe(404); expect(await response.text()).toBe("Not found");
  });
  it("allows CORS preflight without authentication", async () => {
    const response = await request("/drinks", "OPTIONS");
    expect(response.ok).toBe(true);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("X-Admin-Key");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("DELETE");
    await response.text();
  });
});
describe("admin authentication", () => {
  it("accepts the test admin key", async () => {
    const response = await request("/admin/verify", "POST", undefined, env.ADMIN_KEY);
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ success: true });
  });
  it.each([
    ["POST", "/admin/verify"], ["POST", "/drinks"], ["PUT", "/drinks/1"], ["DELETE", "/drinks/1"],
    ["POST", "/upload"], ["POST", "/upload/start"], ["PUT", "/upload/part"], ["POST", "/upload/complete"], ["POST", "/upload/abort"],
  ])("rejects missing and incorrect keys for %s %s", async (method, path) => {
    const id = await create(); await env.MEDIA.put(sample.url, "original-video");
    for (const key of [undefined, "incorrect-key"]) {
      const response = await request(path, method, undefined, key);
      expect(response.status).toBe(401); expect(await response.json()).toEqual({ error: "Unauthorized" });
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    }
    expect(await list()).toEqual([{ ...sample, id }]);
    expect(await (await env.MEDIA.get(sample.url))!.text()).toBe("original-video");
  });
});
describe("drink lifecycle", () => {
  it("logs one structured field event for each drink change", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const id = await create();
    log.mockClear();

    const response = await request(`/drinks/${id}`, "PUT", {
      ...sample,
      theme: "Lördag",
      drink: "Updated Sour",
    }, env.ADMIN_KEY);

    expect(response.status).toBe(200);
    const fieldEvents = log.mock.calls
      .map(([value]) => typeof value === "string" ? JSON.parse(value) : null)
      .filter((event) => event?.event === "drink_field_updated");

    expect(fieldEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "drink_field_updated",
        drink_id: String(id),
        drink_name: "Updated Sour",
        field: "theme",
        from: "Fredag",
        to: "Lördag",
      }),
      expect.objectContaining({
        event: "drink_field_updated",
        drink_id: String(id),
        drink_name: "Updated Sour",
        field: "drink",
        from: "Whiskey Sour",
        to: "Updated Sour",
      }),
    ]));
    expect(fieldEvents).toHaveLength(2);
    expect(fieldEvents.map((event) => event.field)).not.toContain("taste");
    log.mockRestore();
  });
  it("creates, edits, and deletes a drink and its associated media", async () => {
    const id = await create();
    await env.MEDIA.put(sample.url, "video"); await env.MEDIA.put(sample.photo, "photo"); await env.MEDIA.put("unrelated.mp4", "keep");
    const edited = { ...sample, drink: "Updated Sour", ingredients: "4 cl whiskey;2 cl citronjuice", steps: "Skaka;Sila;Servera" };
    const updated = await request(`/drinks/${id}`, "PUT", edited, env.ADMIN_KEY);
    expect(updated.status).toBe(200); expect(await updated.json()).toEqual({ success: true });
    expect(await list()).toEqual([{ ...edited, id }]);
    const deleted = await request(`/drinks/${id}`, "DELETE", undefined, env.ADMIN_KEY);
    expect(deleted.status).toBe(200); expect(await deleted.json()).toEqual({ success: true });
    expect(await list()).toEqual([]);
    expect(await env.MEDIA.head(sample.url)).toBeNull(); expect(await env.MEDIA.head(sample.photo)).toBeNull();
    expect(await env.MEDIA.head("unrelated.mp4")).not.toBeNull();
  });
  it("deletes a drink even if its media is already absent", async () => {
    const id = await create(); const response = await request(`/drinks/${id}`, "DELETE", undefined, env.ADMIN_KEY);
    expect(response.status).toBe(200); await response.json(); expect(await list()).toEqual([]);
  });
  it("persists the recipe's base servings and keeps them when an older client omits the field", async () => {
    const id = await create({ servings: 3 });
    expect(await list()).toEqual([{ ...sample, servings: 3, id }]);
    const { servings: _servings, ...legacyPayload } = sample;
    const updated = await request(`/drinks/${id}`, "PUT", { ...legacyPayload, drink: "Updated Sour" }, env.ADMIN_KEY);
    expect(updated.status).toBe(200);
    await updated.json();
    expect(await list()).toEqual([{ ...sample, drink: "Updated Sour", servings: 3, id }]);
  });
  it("persists separate servings for each drink variant", async () => {
    const variants = {
      drink: "Whiskey Sour & Vodka Sour",
      ingredients: "6 cl whiskey||4 cl vodka",
      steps: "Skaka||Rör",
      servings: [2, 4],
    };
    const id = await create(variants);
    const savedRecipe = { ...sample, ...variants };
    expect(await list()).toEqual([{ ...savedRecipe, id }]);
    const { servings: _servings, ...legacyPayload } = savedRecipe;
    const updated = await request(`/drinks/${id}`, "PUT", {
      ...legacyPayload,
      drink: "Updated Whiskey & Vodka Sour",
    }, env.ADMIN_KEY);
    expect(updated.status).toBe(200);
    await updated.json();
    expect(await list()).toEqual([{
      ...savedRecipe,
      drink: "Updated Whiskey & Vodka Sour",
      id,
    }]);
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "2", [], [1, 0], [1, 1.5]])("rejects invalid servings %j", async (servings) => {
    const response = await request("/drinks", "POST", { ...sample, servings }, env.ADMIN_KEY);
    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
    expect(await list()).toEqual([]);
  });
  it("returns 404 for nonexistent drinks without removing other media", async () => {
    await env.MEDIA.put("keep.jpeg", "keep");
    const response = await request("/drinks/999", "DELETE", undefined, env.ADMIN_KEY);
    expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: "Drink not found" });
    expect(await env.MEDIA.head("keep.jpeg")).not.toBeNull();
  });
});
describe("media uploads", () => {
  it("stores uploaded bytes without overwriting an existing filename", async () => {
    await env.MEDIA.put("20260102.jpeg", "original");
    const response = await SELF.fetch("https://example.test/upload?filename=photo.JPEG&date=2026-01-02", {
      method: "POST", headers: { "X-Admin-Key": env.ADMIN_KEY, "Content-Type": "image/jpeg" }, body: "new-photo",
    });
    expect(response.status).toBe(201); expect(await response.json()).toEqual({ url: "20260102_1.jpeg" });
    expect(await (await env.MEDIA.get("20260102_1.jpeg"))!.text()).toBe("new-photo");
    expect(await (await env.MEDIA.get("20260102.jpeg"))!.text()).toBe("original");
  });
  it.each(["/upload", "/upload/start", "/upload/complete", "/upload/abort"])("rejects missing parameters at %s", async (path) => {
    const response = await request(path, "POST", undefined, env.ADMIN_KEY);
    expect(response.status).toBe(400); expect(await response.json()).toHaveProperty("error");
  });
});

describe("archive analytics", () => {
  it("accepts archive page view events", async () => {
    const response = await request("/analytics/event", "POST", {
      event: "page_view",
      page: "archive",
    });
    expect(response.status).toBe(200);
  });

  it("ignores Grafana Synthetic Monitoring events", async () => {
    const response = await SELF.fetch("https://example.test/analytics/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "GrafanaSyntheticMonitoring/1.0",
      },
      body: JSON.stringify({
        event: "page_view",
        page: "archive",
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, synthetic: true });
  });

  it("rejects unknown page view pages", async () => {
    const response = await request("/analytics/event", "POST", {
      event: "page_view",
      page: "unknown",
    });
    expect(response.status).toBe(400);
  });

  it("accepts normalized filter events", async () => {
    const response = await request("/analytics/event", "POST", {
      event: "archive_filters",
      theme: "Fredag",
      spirits: ["Gin", "Gin", "Rom"],
      tastes: ["sour", "sweet"],
      search: "citron",
      resultCount: 4,
      favoritesOnly: false,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it("rejects unknown event types", async () => {
    const response = await request("/analytics/event", "POST", {
      event: "unknown",
    });
    expect(response.status).toBe(400);
  });

  it("accepts drink favorite events", async () => {
    const response = await request("/analytics/event", "POST", {
      event: "drink_favorite_changed",
      action: "added",
      drinkId: "577",
      drinkName: "Testdrink",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it("rejects malformed favorite events", async () => {
    const response = await request("/analytics/event", "POST", {
      event: "drink_favorite_changed",
      action: "unknown",
      drinkId: "577",
      drinkName: "Testdrink",
    });
    expect(response.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const headers = new Headers({ "Content-Type": "application/json" });
    const response = await SELF.fetch("https://example.test/analytics/event", {
      method: "POST",
      headers,
      body: "{",
    });
    expect(response.status).toBe(400);
  });
});

describe("individual drink links", () => {
  it("loads a drink by id without authentication", async () => {
    const id = await create();
    const response = await request(`/drinks/${id}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...sample, id });
  });
  it("returns JSON 404 when the drink does not exist", async () => {
    const response = await request('/drinks/999');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Drink not found' });
  });
});
