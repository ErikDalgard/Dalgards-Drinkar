export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Kontrollerar att requesten har rätt hemlig nyckel i headern.
    // Används bara av skriv-routes (POST/PUT/DELETE) — GET förblir öppen.
    function isAuthorized(req: Request): boolean {
      const providedKey = req.headers.get("X-Admin-Key");
      return providedKey === env.ADMIN_KEY;
    }

    function broadDevice(request: Request): string {
      if (request.headers.get("Sec-CH-UA-Mobile") === "?1") return "mobile";
      const platform = (request.headers.get("Sec-CH-UA-Platform") || "").toLowerCase();
      const ua = (request.headers.get("User-Agent") || "").toLowerCase();
      if (platform.includes("android") || platform.includes("ios") || /android|iphone|ipad|mobile/.test(ua)) {
        return "mobile";
      }
      if (/tablet|ipad/.test(ua)) return "tablet";
      return "desktop";
    }

    function browserName(request: Request): string {
      const ua = request.headers.get("User-Agent") || "";
      if (/edg\//i.test(ua)) return "Edge";
      if (/chrome|chromium/i.test(ua) && !/edg\//i.test(ua)) return "Chrome";
      if (/firefox/i.test(ua)) return "Firefox";
      if (/safari/i.test(ua) && !/chrome|chromium/i.test(ua)) return "Safari";
      return "Other";
    }

    // GET /spirits — hämta spritsorter och sökord, publik
    if (url.pathname === "/spirits" && request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT name, synonyms FROM spirits ORDER BY position"
      ).all();
      const spirits = results.map((row: { name: string; synonyms: string }) => ({
        name: row.name,
        synonyms: JSON.parse(row.synonyms),
      }));
      return Response.json(spirits, { headers: corsHeaders });
    }

    // PUT /spirits — spara hela listan, KRÄVER nyckel
    if (url.pathname === "/spirits" && request.method === "PUT") {
      if (!isAuthorized(request)) {
        return Response.json({ error: "Unauthorized" }, {
          status: 401,
          headers: corsHeaders,
        });
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "Ogiltig JSON" }, {
          status: 400,
          headers: corsHeaders,
        });
      }

      const catalog = validateSpirits(body);
      if (!catalog) {
        return Response.json({
          error: "Ange unika spritsorter (max 50), namn (max 80 tecken) och minst ett sökord per sort (max 100 sökord à 100 tecken).",
        }, { status: 400, headers: corsHeaders });
      }

      // Alla ändringar görs tillsammans. Vid fel behålls den gamla listan.
      await env.DB.batch([
        env.DB.prepare("DELETE FROM spirits"),
        ...catalog.map((item, index) => env.DB.prepare(
          "INSERT INTO spirits (name, synonyms, position) VALUES (?, ?, ?)"
        ).bind(item.name, JSON.stringify(item.synonyms), index)),
      ]);
      return Response.json(catalog, { headers: corsHeaders });
    }

    if (url.pathname === "/spirits") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { ...corsHeaders, Allow: "GET, PUT, OPTIONS" },
      });
    }

    // GET /drinks — hämta alla, publik, ingen nyckel krävs
    if (url.pathname === "/drinks" && request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM drinks ORDER BY date DESC"
      ).all();
      const drinks = results.map(rowToDrink);
      return new Response(JSON.stringify(drinks), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // POST /analytics/event — publik, endast normaliserade filter- och sökinformation loggas
    if (url.pathname === "/analytics/event" && request.method === "POST") {
      const userAgent = request.headers.get("User-Agent") || "";
      if (/GrafanaSyntheticMonitoring/i.test(userAgent)) {
        return Response.json({ success: true, synthetic: true }, { headers: corsHeaders });
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "Ogiltig JSON" }, {
          status: 400,
          headers: corsHeaders,
        });
      }

      if (!body || typeof body !== "object") {
        return Response.json({ error: "Ogiltigt analytics-event" }, {
          status: 400,
          headers: corsHeaders,
        });
      }

      const payload = body as Record<string, unknown>;
      if (payload.event !== "archive_filters" &&
          payload.event !== "drink_favorite_changed" &&
          payload.event !== "page_view") {
        return Response.json({ error: "Okänd analytics-händelse" }, {
          status: 400,
          headers: corsHeaders,
        });
      }

      if (payload.event === "page_view") {
        const page = typeof payload.page === "string"
          ? payload.page.trim().slice(0, 40)
          : "";
        if (page !== "archive" && page !== "admin") {
          return Response.json({ error: "Ogiltig sida" }, {
            status: 400,
            headers: corsHeaders,
          });
        }

        console.log(JSON.stringify({
          event: "page_view",
          page,
        }));

        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (payload.event === "drink_favorite_changed") {
        const drinkId = typeof payload.drinkId === "string"
          ? payload.drinkId.trim().slice(0, 30)
          : typeof payload.drinkId === "number"
            ? String(payload.drinkId).slice(0, 30)
            : "";
        const drinkName = typeof payload.drinkName === "string"
          ? payload.drinkName.trim().slice(0, 100)
          : "";
        if (!drinkId || !drinkName || (payload.action !== "added" && payload.action !== "removed")) {
          return Response.json({ error: "Ogiltig favorit-händelse" }, {
            status: 400,
            headers: corsHeaders,
          });
        }

        console.log(JSON.stringify({
          event: "drink_favorite_changed",
          action: payload.action,
          drink_id: drinkId,
          drink_name: drinkName,
        }));

        return Response.json({ success: true }, { headers: corsHeaders });
      }

      const cleanArray = (value: unknown, maximum: number): string[] =>
        Array.isArray(value)
          ? [...new Set(value
              .filter((item): item is string => typeof item === "string")
              .map((item) => item.trim())
              .filter(Boolean)
              .slice(0, maximum))]
          : [];

      const theme = typeof payload.theme === "string" ? payload.theme.trim().slice(0, 80) : "";
      const search = typeof payload.search === "string" ? payload.search.trim().slice(0, 100) : "";
      const spirits = cleanArray(payload.spirits, 10);
      const tastes = cleanArray(payload.tastes, 10);
      const resultCount = typeof payload.resultCount === "number" &&
        Number.isSafeInteger(payload.resultCount) && payload.resultCount >= 0
        ? payload.resultCount
        : null;

      console.log(JSON.stringify({
        event: "archive_filters",
        theme: theme || null,
        spirits,
        tastes,
        search: search || null,
        result_count: resultCount,
        favorites_only: payload.favoritesOnly === true,
      }));

      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (url.pathname === "/analytics/event") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { ...corsHeaders, Allow: "POST, OPTIONS" },
      });
    }

    // GET /drinks/:id — public lookup for individual drink links and metadata.
    const getMatch = url.pathname.match(/^\/drinks\/(\d+)$/);
    if (getMatch && request.method === "GET") {
      const row = await env.DB.prepare("SELECT * FROM drinks WHERE id=?")
        .bind(getMatch[1]).first();
      if (row) {
        const cf = (request as Request & {
          cf?: {
            city?: string;
            country?: string;
            timezone?: string;
          };
        }).cf;
        console.log(JSON.stringify({
          event: "drink_viewed",
          drink_id: String(row.id),
          drink_name: row.drink,
          city: cf?.city || null,
          country: cf?.country || null,
          device: broadDevice(request),
          browser: browserName(request),
          timezone: cf?.timezone || null,
        }));
      }
      return Response.json(row ? rowToDrink(row) : { error: "Drink not found" }, {
        status: row ? 200 : 404,
        headers: corsHeaders,
      });
    }

    // POST /drinks — skapa ny drink, KRÄVER nyckel
    if (url.pathname === "/drinks" && request.method === "POST") {
      if (!isAuthorized(request)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      const body: any = await request.json();
      const servings = normalizeServings(body.servings);
      if (servings === null) {
        return Response.json({ error: "Portionsantal måste vara positiva heltal." }, {
          status: 400,
          headers: corsHeaders,
        });
      }
      const storedServings = serializeServings(servings);
      const result = await env.DB.prepare(
        `INSERT INTO drinks (date, theme, drink, video_url, photo_url, note, ingredients, steps, taste, servings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        body.date, body.theme || "", body.drink, body.url,
        body.photo || "", body.note || "", body.ingredients || "",
        body.steps || "", body.taste || "", storedServings
      ).run();

      console.log(JSON.stringify({
        event: "drink_created",
        drink_id: String(result.meta.last_row_id),
        drink_name: body.drink,
      }));

      return new Response(JSON.stringify({ id: result.meta.last_row_id }), {
        status: 201,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // PUT /drinks/:id — uppdatera, KRÄVER nyckel
    const putMatch = url.pathname.match(/^\/drinks\/(\d+)$/);
    if (putMatch && request.method === "PUT") {
      if (!isAuthorized(request)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      const id = putMatch[1];
      const body: any = await request.json();
      const previous = await env.DB.prepare("SELECT * FROM drinks WHERE id=?")
        .bind(id).first();
      const previousServings = parseStoredServings(previous?.servings ?? 1);
      const servings = normalizeServings(body.servings, previousServings);
      if (servings === null) {
        return Response.json({ error: "Portionsantal måste vara positiva heltal." }, {
          status: 400,
          headers: corsHeaders,
        });
      }
      const storedServings = serializeServings(servings);
      await env.DB.prepare(
        `UPDATE drinks SET date=?, theme=?, drink=?, video_url=?, photo_url=?,
         note=?, ingredients=?, steps=?, taste=?, servings=? WHERE id=?`
      ).bind(
        body.date, body.theme || "", body.drink, body.url,
        body.photo || "", body.note || "", body.ingredients || "",
        body.steps || "", body.taste || "", storedServings, id
      ).run();

      const updated = await env.DB.prepare("SELECT * FROM drinks WHERE id=?")
        .bind(id).first();
      if (updated) {
        const normalizeChangeValue = (value: unknown): unknown =>
          value == null ? "" : value;
        const fields = [
          ["date", "date", body.date],
          ["theme", "theme", body.theme || ""],
          ["drink", "drink", body.drink],
          ["video_url", "video_url", body.url],
          ["photo_url", "photo_url", body.photo || ""],
          ["note", "note", body.note || ""],
          ["ingredients", "ingredients", body.ingredients || ""],
          ["steps", "steps", body.steps || ""],
          ["taste", "taste", body.taste || ""],
          ["servings", "servings", storedServings],
        ] as const;
        const changes = Object.fromEntries(fields
          .filter(([column, , value]) =>
            normalizeChangeValue(previous?.[column]) !== normalizeChangeValue(value))
          .map(([column, label, value]) => [label, {
            from: normalizeChangeValue(previous?.[column]),
            to: normalizeChangeValue(value),
          }]));
        console.log(JSON.stringify({
          event: "drink_updated",
          drink_id: id,
          drink_name: updated.drink,
          changes,
        }));
        for (const [field, change] of Object.entries(changes)) {
          if (!change || typeof change !== "object") continue;
          console.log(JSON.stringify({
            event: "drink_field_updated",
            drink_id: id,
            drink_name: updated.drink,
            field,
            from: "from" in change ? change.from : null,
            to: "to" in change ? change.to : null,
          }));
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // DELETE /drinks/:id — ta bort, KRÄVER nyckel
   const deleteMatch = url.pathname.match(/^\/drinks\/(\d+)$/);

  if (deleteMatch && request.method === "DELETE") {
    if (!isAuthorized(request)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const id = deleteMatch[1];

    // Hämta drinken först så vi vet vilka mediafiler som hör till den
    const drink = await env.DB
      .prepare("SELECT drink, photo_url, video_url FROM drinks WHERE id=?")
      .bind(id)
      .first();

    if (!drink) {
      return new Response(JSON.stringify({ error: "Drink not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Ta bort eventuell bild från R2
    if (drink.photo_url) {
      await env.MEDIA.delete(drink.photo_url);
    }

    // Ta bort eventuell video från R2
    if (drink.video_url) {
      await env.MEDIA.delete(drink.video_url);
    }

    // Ta bort drinken från D1
    await env.DB
      .prepare("DELETE FROM drinks WHERE id=?")
      .bind(id)
      .run();

    console.log(JSON.stringify({
      event: "drink_deleted",
      drink_id: id,
      drink_name: drink.drink,
    }));

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

    // POST /upload — laddar upp en fil (video eller bild) till R2, KRÄVER nyckel
  if (url.pathname === "/upload" && request.method === "POST") {
    if (!isAuthorized(request)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const filename = url.searchParams.get("filename");
    const date = url.searchParams.get("date");

    if (!filename || !date) {
      return new Response(
        JSON.stringify({ error: "Filnamn och datum krävs" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // YYYY-MM-DD → YYYYMMDD
    const datePrefix = date.replace(/-/g, "");

    // Behåll filens riktiga extension (.jpg, .heic, .mov, .mp4 osv.)
    const extension = filename.includes(".")
      ? "." + filename.split(".").pop()!.toLowerCase()
      : "";

    // Hitta första lediga filnamnet
    let counter = 0;
    let finalFilename: string;

    while (true) {
      finalFilename =
        counter === 0
          ? `${datePrefix}${extension}`
          : `${datePrefix}_${counter}${extension}`;

      const existing = await env.MEDIA.head(finalFilename);

      if (!existing) {
        break;
      }

      counter++;
    }

    // Ladda upp filen
    try {
      await env.MEDIA.put(finalFilename, request.body);
      console.log(JSON.stringify({
        event: "upload_succeeded",
        upload_type: "file",
        key: finalFilename,
      }));

    } catch (err) {
        console.error(JSON.stringify({
          event: "upload_failed",
          upload_type: "file",
          key: finalFilename,
          error: err instanceof Error ? err.message : String(err),
        }));

      return new Response(
        JSON.stringify({
          error: "Uppladdningen till lagringen misslyckades",
          details: err instanceof Error ? err.message : String(err),
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
    return new Response(
      JSON.stringify({ url: finalFilename }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }

  // VIDEO MULTIPART
  if (url.pathname === "/upload/start" && request.method === "POST") {
    if (!isAuthorized(request)) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{"Content-Type":"application/json",...corsHeaders}});

    const filename=url.searchParams.get("filename");
    const date=url.searchParams.get("date");
    if (!filename||!date) return new Response(JSON.stringify({error:"Filnamn och datum krävs"}),{status:400,headers:{"Content-Type":"application/json",...corsHeaders}});

    const prefix=date.replace(/-/g,"");
    const ext=filename.includes(".")?"."+filename.split(".").pop()!.toLowerCase():"";
    let counter=0, key="";

    while (true) {
      key=counter===0?`${prefix}${ext}`:`${prefix}_${counter}${ext}`;
      if (!(await env.MEDIA.head(key))) break;
      counter++;
    }

    try {
      const upload=await env.MEDIA.createMultipartUpload(key,{
        httpMetadata:{contentType:filename.toLowerCase().endsWith(".mov")?"video/quicktime":"video/mp4"}
      });
      return new Response(JSON.stringify({key,uploadId:upload.uploadId}),{status:201,headers:{"Content-Type":"application/json",...corsHeaders}});
    } catch(err) {
        console.error(JSON.stringify({
          event:"upload_failed",
          upload_type:"multipart_start",
          error: String(err),
          key,
        }));
        return new Response(JSON.stringify({error:"Kunde inte starta videouppladdningen",details:String(err)}),{status:500,headers:{"Content-Type":"application/json",...corsHeaders}});
    }
  }

  if (url.pathname === "/upload/part" && request.method === "PUT") {
    if (!isAuthorized(request)) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{"Content-Type":"application/json",...corsHeaders}});

    const key=url.searchParams.get("key");
    const uploadId=url.searchParams.get("uploadId");
    const partNumber=Number(url.searchParams.get("partNumber"));

    if (!key||!uploadId||!partNumber||!request.body) return new Response(JSON.stringify({error:"Ogiltiga upload-parametrar"}),{status:400,headers:{"Content-Type":"application/json",...corsHeaders}});

    try {
      const upload=env.MEDIA.resumeMultipartUpload(key,uploadId);
      const part=await upload.uploadPart(partNumber,request.body);
      return new Response(JSON.stringify(part),{headers:{"Content-Type":"application/json",...corsHeaders}});
    } catch(err) {
      console.error(JSON.stringify({
        event:"upload_failed",
        upload_type:"multipart_part",
        key,
        part_number:partNumber,
        error:String(err),
      }));
      return new Response(JSON.stringify({error:"Deluppladdning misslyckades",details:String(err)}),{status:500,headers:{"Content-Type":"application/json",...corsHeaders}});
    }
  }

  if (url.pathname === "/upload/complete" && request.method === "POST") {
    if (!isAuthorized(request)) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{"Content-Type":"application/json",...corsHeaders}});

    const key=url.searchParams.get("key");
    const uploadId=url.searchParams.get("uploadId");
    if (!key||!uploadId) return new Response(JSON.stringify({error:"Upload-parametrar saknas"}),{status:400,headers:{"Content-Type":"application/json",...corsHeaders}});

    try {
      const {parts}=await request.json<{parts:R2UploadedPart[]}>();
      const upload=env.MEDIA.resumeMultipartUpload(key,uploadId);
      await upload.complete(parts);
      console.log(JSON.stringify({
        event:"upload_succeeded",
        upload_type:"multipart",
        key,
      }));
      return new Response(JSON.stringify({url:key}),{status:201,headers:{"Content-Type":"application/json",...corsHeaders}});
    } catch(err) {
      console.error(JSON.stringify({
        event:"upload_failed",
        upload_type:"multipart_complete",
        key,
        error:String(err),
      }));
      return new Response(JSON.stringify({error:"Kunde inte slutföra videon",details:String(err)}),{status:500,headers:{"Content-Type":"application/json",...corsHeaders}});
    }
  }

  if (url.pathname === "/upload/abort" && request.method === "POST") {
    if (!isAuthorized(request)) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{"Content-Type":"application/json",...corsHeaders}});

    const key=url.searchParams.get("key");
    const uploadId=url.searchParams.get("uploadId");
    if (!key||!uploadId) return new Response(JSON.stringify({error:"Upload-parametrar saknas"}),{status:400,headers:{"Content-Type":"application/json",...corsHeaders}});

    try {
      await env.MEDIA.resumeMultipartUpload(key,uploadId).abort();
      return new Response(null,{status:204,headers:corsHeaders});
    } catch(err) {
      console.error(JSON.stringify({
        event:"upload_failed",
        upload_type:"multipart_abort",
        key,
        error:String(err),
      }));
      return new Response(JSON.stringify({error:String(err)}),{status:500,headers:{"Content-Type":"application/json",...corsHeaders}});
    }
  }


      // POST /admin/verify — validera om nyckeln är rätt
    if (url.pathname === "/admin/verify" && request.method === "POST") {
      if (!isAuthorized(request)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }




    return new Response("Not found", { status: 404, headers: corsHeaders });
  },
};

function rowToDrink(row: any) {
  return {
    id: row.id,
    date: row.date,
    theme: row.theme || "",
    drink: row.drink,
    url: row.video_url,
    photo: row.photo_url || "",
    note: row.note || "",
    ingredients: row.ingredients || "",
    steps: row.steps || "",
    taste: row.taste || "",
    servings: row.servings == null ? 1 : parseStoredServings(row.servings),
  };
}

type Servings = number | number[];

function normalizeServings(value: unknown, fallback: Servings = 1): Servings | null {
  if (value === undefined) return fallback;
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (Array.isArray(value) && value.length > 0 &&
      value.every((item) => typeof item === "number" && Number.isSafeInteger(item) && item > 0)) {
    return value;
  }
  return null;
}

function serializeServings(value: Servings): number | string {
  return Array.isArray(value) ? JSON.stringify(value) : value;
}

function parseStoredServings(value: unknown): Servings {
  if (typeof value === "string" && value.startsWith("[")) {
    const parsed: unknown = JSON.parse(value);
    const servings = normalizeServings(parsed);
    if (!Array.isArray(servings)) {
      throw new Error("Stored drink portions are invalid.");
    }
    return servings;
  }
  const servings = normalizeServings(typeof value === "string" ? Number(value) : value);
  if (servings === null) {
    throw new Error("Stored drink portions are invalid.");
  }
  return servings;
}

type Spirit = { name: string; synonyms: string[] };

// Validate the complete draft before replacing anything in the database.
function validateSpirits(value: unknown): Spirit[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const names = new Set<string>();
  const catalog: Spirit[] = [];
  for (const item of value) {
    if (!item || typeof item.name !== "string" || !Array.isArray(item.synonyms)) return null;
    const name = item.name.trim();
    if (!name || name.length > 80 || names.has(name.toLowerCase()) || item.synonyms.length > 100) return null;
    names.add(name.toLowerCase());
    const synonyms: string[] = [];
    for (const word of item.synonyms) {
      if (typeof word !== "string" || !word.trim() || word.trim().length > 100) return null;
      const normalized = word.trim().toLowerCase();
      if (!synonyms.includes(normalized)) synonyms.push(normalized);
    }
    if (!synonyms.length) return null;
    catalog.push({ name, synonyms });
  }
  return catalog;
}
