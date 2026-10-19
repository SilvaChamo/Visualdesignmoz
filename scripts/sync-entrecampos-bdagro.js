const mysql = require("mysql2/promise");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

// Supabase Hetzner (supabase.visualdesignmoz.com via localhost interno)
const SUPABASE_URL = "http://localhost:8000";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODA3NDk0MTQsImV4cCI6MTkzODQyOTQxNH0.fAMHpZWJoAtCzItAfJEmWtAr4lP_8_c2admrlniCwlA";

const MYSQL_CONFIG = {
  host: "localhost",
  user: "admin_wp_entrecampos_co_mz",
  password: "46p6hSU7.!",
  database: "admin_wp_entrecampos_co_mz"
};

const WP_UPLOADS_DIR = "/home/admin/domains/entrecamposblog.com/public_html/wp-content/uploads";

function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function syncEntrecamposToSupabase() {
  console.log("[SYNC] Checking WordPress (Entrecampos) -> Supabase...");

  let conn;
  try {
    conn = await mysql.createConnection(MYSQL_CONFIG);

    const [rows] = await conn.execute(`
      SELECT 
        p.ID, 
        p.post_title, 
        p.post_content, 
        p.post_excerpt, 
        p.post_name, 
        p.post_date,
        GROUP_CONCAT(t.slug) as category_slugs
      FROM wpye_posts p
      LEFT JOIN wpye_term_relationships tr ON p.ID = tr.object_id
      LEFT JOIN wpye_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id AND tt.taxonomy = 'category'
      LEFT JOIN wpye_terms t ON tt.term_id = t.term_id
      WHERE p.post_type = 'post' AND p.post_status = 'publish'
      GROUP BY p.ID;
    `);

    let syncedCount = 0;
    let skippedCount = 0;

    for (const post of rows) {
      const catSlugs = (post.category_slugs || "").split(",").map(c => c.trim().toLowerCase());

      // RULE: EXCLUDE category 'comunidade'
      if (catSlugs.includes("comunidade")) {
        skippedCount++;
        continue;
      }

      const mainCategory = catSlugs.find(c => c && c !== "comunidade") || "geral";

      const payload = [{
        title: post.post_title,
        slug: post.post_name,
        summary: post.post_excerpt || post.post_title,
        content: post.post_content,
        category: mainCategory,
        site_id: "entrecampos",
        status: "Published",
        date: new Date(post.post_date).toISOString()
      }];

      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/news`, {
          method: "POST",
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            "Accept-Profile": "basededados",
            "Content-Profile": "basededados"
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          syncedCount++;
        } else {
          const txt = await res.text();
          if (res.status !== 409 && !txt.includes("duplicate key")) {
            console.error(`Post ID ${post.ID} HTTP ${res.status}:`, txt);
          }
        }
      } catch (err) {
        console.error(`Failed to sync post ID ${post.ID}:`, err.message);
      }
    }

    console.log(`[SYNC] Entrecampos -> Supabase Done. Synced/Verified: ${syncedCount}, Skipped (Comunidade): ${skippedCount}`);
  } catch (err) {
    console.error("[SYNC] Error reading WordPress MySQL:", err.message);
  } finally {
    if (conn) await conn.end();
  }
}

async function fetchSupabaseData(endpoint) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Accept-Profile": "basededados"
      }
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  } catch (err) {
    console.error(`Error fetching ${endpoint}:`, err.message);
  }
  return [];
}

async function attachFeaturedImage(conn, postId, imageUrl, title, slug) {
  if (!imageUrl) return false;

  try {
    if (imageUrl.startsWith("/")) {
      imageUrl = `https://basededadosagro.com${imageUrl}`;
    }

    // Check if thumbnail already exists as a valid attachment
    const [attMeta] = await conn.execute("SELECT meta_value FROM wpye_postmeta WHERE post_id = ? AND meta_key = '_thumbnail_id'", [postId]);
    if (attMeta.length > 0) {
      const attId = Number(attMeta[0].meta_value);
      if (attId > 0) {
        const [attRow] = await conn.execute("SELECT ID FROM wpye_posts WHERE ID = ? AND post_type = 'attachment'", [attId]);
        if (attRow.length > 0) {
          return false; // Already has valid attachment
        }
      }
    }

    console.log(`[SYNC] Downloading image for post ID ${postId} (${imageUrl})...`);
    const res = await fetch(imageUrl);
    if (!res.ok) {
      console.error(`[SYNC] Image fetch failed HTTP ${res.status} for ${imageUrl}`);
      return false;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 100) return false;

    const ext = imageUrl.split(".").pop().split("?")[0].toLowerCase() || "jpg";
    const cleanExt = ["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(ext) ? ext : "jpg";
    const mimeType = cleanExt === "png" ? "image/png" : cleanExt === "webp" ? "image/webp" : cleanExt === "avif" ? "image/avif" : "image/jpeg";

    const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "/");
    const targetFolder = path.join(WP_UPLOADS_DIR, yearMonth);
    await fs.promises.mkdir(targetFolder, { recursive: true });

    const filename = `bdagro-${postId}-${Date.now()}.${cleanExt}`;
    const filePath = path.join(targetFolder, filename);
    await fs.promises.writeFile(filePath, buffer);

    const relPath = `${yearMonth}/${filename}`;
    const guid = `https://entrecampos.co.mz/wp-content/uploads/${relPath}`;
    const dateStr = new Date().toISOString().slice(0, 19).replace("T", " ");

    // Insert attachment post
    const [attResult] = await conn.execute(`
      INSERT INTO wpye_posts (
        post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
        post_status, comment_status, ping_status, post_password, post_name, to_ping, pinged,
        post_modified, post_modified_gmt, post_content_filtered, post_parent, guid, menu_order, post_type, post_mime_type, comment_count
      ) VALUES (
        1, ?, ?, '', ?, '',
        'inherit', 'closed', 'closed', '', ?, '', '',
        ?, ?, '', ?, ?, 0, 'attachment', ?, 0
      );
    `, [dateStr, dateStr, title, `${slug}-thumb`, dateStr, dateStr, postId, guid, mimeType]);

    const newAttId = attResult.insertId;
    if (newAttId) {
      await conn.execute("DELETE FROM wpye_postmeta WHERE post_id = ? AND meta_key = '_thumbnail_id'", [postId]);
      await conn.execute("INSERT INTO wpye_postmeta (post_id, meta_key, meta_value) VALUES (?, '_thumbnail_id', ?)", [postId, newAttId]);
      await conn.execute("INSERT INTO wpye_postmeta (post_id, meta_key, meta_value) VALUES (?, '_wp_attached_file', ?)", [newAttId, relPath]);
      console.log(`[SYNC] Attached native thumbnail ID ${newAttId} to post ID ${postId}`);

      // Regenerate image crops for 100% theme compatibility
      exec(`wp --allow-root --path=/home/admin/domains/entrecamposblog.com/public_html media regenerate ${newAttId} --yes`, (err) => {
        if (err) console.error(`[SYNC] Media regenerate error for ${newAttId}:`, err.message);
      });
      return true;
    }
  } catch (err) {
    console.error(`[SYNC] Error attaching image for post ${postId}:`, err.message);
  }
  return false;
}

async function syncBDAgroToWordPress() {
  console.log("[SYNC] Checking Supabase (BD Agro - APPROVED ARTICLES ONLY) -> WordPress (Entrecampos)...");

  let conn;
  try {
    // ONLY APPROVED ARTICLES (news with site_id != entrecampos and active approved articles from basededados.articles)
    // DO NOT INCLUDE articles_pending (unapproved scraper queue)
    const [newsItems, articleItems] = await Promise.all([
      fetchSupabaseData("news?site_id=neq.entrecampos"),
      fetchSupabaseData("articles?deleted_at=is.null&status=eq.active")
    ]);

    const combined = [];
    const seenSlugs = new Set();

    for (const item of [...newsItems, ...articleItems]) {
      const title = item.title;
      if (!title || title.trim().length < 5) continue;

      const slug = item.slug || slugify(title);
      if (!slug || seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);

      let content = item.content || item.subtitle || item.summary || item.description || "";
      const summary = item.summary || item.subtitle || title;
      
      let imageUrl = item.image_url || null;
      if (imageUrl && imageUrl.startsWith("/")) {
        imageUrl = `https://basededadosagro.com${imageUrl}`;
      }

      // Prepend image to content if available and not already embedded
      if (imageUrl && !content.includes("<img")) {
        content = `<p><img src="${imageUrl}" alt="${title.replace(/"/g, '&quot;')}" class="aligncenter size-full wp-image-imported" style="max-width:100%; height:auto; border-radius:8px; margin-bottom:15px;" /></p>\n${content}`;
      }

      // Calculate date - ensure 2026 current timestamp if older or invalid
      let itemDate = item.created_at || item.date;
      let dateObj = itemDate ? new Date(itemDate) : new Date();
      if (isNaN(dateObj.getTime()) || dateObj.getFullYear() < 2026) {
        dateObj = new Date();
      }

      combined.push({
        title,
        slug,
        content,
        summary,
        date: dateObj,
        image_url: imageUrl
      });
    }

    if (combined.length === 0) {
      console.log("[SYNC] No approved news found from BD Agro.");
      return;
    }

    conn = await mysql.createConnection(MYSQL_CONFIG);

    // Get term_taxonomy_id for 'agricultura'
    const [termRows] = await conn.execute(`
      SELECT tt.term_taxonomy_id 
      FROM wpye_term_taxonomy tt 
      JOIN wpye_terms t ON tt.term_id = t.term_id 
      WHERE t.slug = 'agricultura' LIMIT 1;
    `);

    const termTaxonomyId = termRows.length > 0 ? termRows[0].term_taxonomy_id : null;

    let addedCount = 0;
    let imagesAttached = 0;

    for (const item of combined) {
      let postId = null;

      // Check if post slug already exists in WordPress
      const [existing] = await conn.execute(`SELECT ID FROM wpye_posts WHERE post_name = ? AND post_type = 'post' LIMIT 1;`, [item.slug]);
      if (existing.length > 0) {
        postId = existing[0].ID;
      } else {
        const dateStr = item.date.toISOString().slice(0, 19).replace("T", " ");
        const guid = `https://entrecampos.co.mz/${item.slug}`;

        const [result] = await conn.execute(`
          INSERT INTO wpye_posts (
            post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
            post_status, comment_status, ping_status, post_password, post_name, to_ping, pinged,
            post_modified, post_modified_gmt, post_content_filtered, post_parent, guid, menu_order, post_type, post_mime_type, comment_count
          ) VALUES (
            1, ?, ?, ?, ?, ?,
            'publish', 'open', 'open', '', ?, '', '',
            ?, ?, '', 0, ?, 0, 'post', '', 0
          );
        `, [dateStr, dateStr, item.content, item.title, item.summary, item.slug, dateStr, dateStr, guid]);

        postId = result.insertId;
        if (postId && termTaxonomyId) {
          await conn.execute(`INSERT IGNORE INTO wpye_term_relationships (object_id, term_taxonomy_id, term_order) VALUES (?, ?, 0);`, [postId, termTaxonomyId]);
        }
        addedCount++;
      }

      // Download & Attach native WordPress featured image
      if (postId && item.image_url) {
        const attached = await attachFeaturedImage(conn, postId, item.image_url, item.title, item.slug);
        if (attached) imagesAttached++;
      }
    }

    console.log(`[SYNC] BD Agro -> WordPress Done. Added ${addedCount} new posts. Attached ${imagesAttached} native thumbnails.`);

    if (addedCount > 0 || imagesAttached > 0) {
      exec("wp --allow-root --path=/home/admin/domains/entrecamposblog.com/public_html cache flush", (err) => {
        if (err) console.error("[SYNC] Cache flush error:", err.message);
        else console.log("[SYNC] WordPress cache flushed successfully.");
      });
    }
  } catch (err) {
    console.error("[SYNC] Error syncing BD Agro to WordPress:", err.message);
  } finally {
    if (conn) await conn.end();
  }
}

async function runSync() {
  console.log(`\n========================================`);
  console.log(`[SYNC RUN] ${new Date().toISOString()}`);
  await syncEntrecamposToSupabase();
  await syncBDAgroToWordPress();
  console.log(`========================================\n`);
}

runSync();
setInterval(runSync, 3 * 60 * 1000); // Repeat every 3 minutes
