/**
 * Seeds realistic demo/dev data: farmer + buyer accounts (real, loginable
 * auth users, not just database rows) and >=15 products per marketplace
 * category. NEVER run this against a production project — it creates
 * real Supabase Auth users with a shared, publicly-documented password.
 *
 * This is intentionally a standalone script, not a numbered file under
 * supabase/migrations/ — migrations are real schema and always safe to
 * run anywhere, including production; this is sample data and must stay
 * something a developer runs on purpose, against a dev/staging project,
 * never something that runs automatically. See docs/DEPLOYMENT.md.
 *
 * Usage:
 *   npm run seed:demo
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
 * .env.local, pointed at a dev/staging Supabase project with the
 * migrations in supabase/migrations/ already applied.
 *
 * Idempotent: re-running skips any demo account that already exists (by
 * email) and any product that already exists (by farmer + name), so it
 * never duplicates data — see product spec §"Do not duplicate existing
 * products unnecessarily."
 */

import { existsSync } from "node:fs";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

import { createClient } from "@supabase/supabase-js";

import { slugifyProductName } from "../src/lib/validation/product";
import type { Database } from "../src/lib/supabase/types";

// Not src/lib/supabase/admin.ts: that module imports the `server-only`
// package, which unconditionally throws outside a Next.js server-bundling
// context (it works by relying on a webpack/Turbopack export condition,
// not a runtime environment check) — it would throw immediately under
// plain Node/tsx here. Same service-role client, constructed inline.
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local to seed demo data."
    );
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const DEMO_PASSWORD = "KilimoDemo123!";
const EMAIL_DOMAIN = "kilimosync.dev";

type FarmerSeed = {
  key: string;
  name: string;
  farmName: string;
  county: string;
  subcounty: string;
  phone: string;
};

const FARMERS: FarmerSeed[] = [
  { key: "f1", name: "Wanjiru Kamau", farmName: "Wanjiru Green Gardens", county: "Nakuru", subcounty: "Naivasha", phone: "0712000001" },
  { key: "f2", name: "Otieno Odhiambo", farmName: "Otieno Family Farm", county: "Kiambu", subcounty: "Limuru", phone: "0712000002" },
  { key: "f3", name: "Mwangi Njoroge", farmName: "Mwangi Orchards", county: "Meru", subcounty: "Imenti North", phone: "0712000003" },
  { key: "f4", name: "Chebet Kiprotich", farmName: "Chebet Grain Farm", county: "Uasin Gishu", subcounty: "Turbo", phone: "0712000004" },
  { key: "f5", name: "Wafula Simiyu", farmName: "Wafula Harvest Co", county: "Kakamega", subcounty: "Lurambi", phone: "0712000005" },
  { key: "f6", name: "Mutinda Kioko", farmName: "Mutinda Family Farm", county: "Machakos", subcounty: "Machakos Town", phone: "0712000006" },
  { key: "f7", name: "Wangari Muriithi", farmName: "Wangari Dairy & Poultry", county: "Nyeri", subcounty: "Mathira", phone: "0712000007" },
  { key: "f8", name: "Sironka Ntutu", farmName: "Sironka Livestock", county: "Kajiado", subcounty: "Kajiado Central", phone: "0712000008" },
  { key: "f9", name: "Nyaboke Ogeto", farmName: "Nyaboke Fresh Produce", county: "Kisii", subcounty: "Kisii Central", phone: "0712000009" },
  { key: "f10", name: "Wekesa Nabwire", farmName: "Wekesa Spice Gardens", county: "Bungoma", subcounty: "Kanduyi", phone: "0712000010" },
];

const BUYERS = [
  { key: "b1", name: "Achieng Otieno", county: "Nairobi", phone: "0722000001" },
  { key: "b2", name: "Kimani Wachira", county: "Mombasa", phone: "0722000002" },
  { key: "b3", name: "Halima Abdi", county: "Nairobi", phone: "0722000003" },
];

type CategorySeed = {
  slug: string;
  farmerKeys: string[];
  products: { name: string; priceRange: [number, number]; unit: string; qtyRange: [number, number] }[];
};

const CATEGORIES: CategorySeed[] = [
  {
    slug: "vegetables",
    farmerKeys: ["f1", "f2", "f9"],
    products: [
      { name: "Sukuma Wiki (Kale)", priceRange: [25, 45], unit: "kg", qtyRange: [40, 150] },
      { name: "Tomatoes", priceRange: [60, 110], unit: "kg", qtyRange: [30, 120] },
      { name: "Cabbage", priceRange: [30, 55], unit: "piece", qtyRange: [20, 80] },
      { name: "Spinach", priceRange: [30, 50], unit: "kg", qtyRange: [20, 70] },
      { name: "Red Onions", priceRange: [70, 120], unit: "kg", qtyRange: [40, 100] },
      { name: "Carrots", priceRange: [50, 90], unit: "kg", qtyRange: [30, 90] },
    ],
  },
  {
    slug: "fruits",
    farmerKeys: ["f2", "f3", "f10"],
    products: [
      { name: "Bananas", priceRange: [40, 80], unit: "bunch", qtyRange: [15, 60] },
      { name: "Mangoes", priceRange: [80, 150], unit: "kg", qtyRange: [20, 90] },
      { name: "Avocados", priceRange: [15, 35], unit: "piece", qtyRange: [50, 200] },
      { name: "Pineapples", priceRange: [70, 150], unit: "piece", qtyRange: [15, 60] },
      { name: "Watermelon", priceRange: [200, 400], unit: "piece", qtyRange: [10, 40] },
      { name: "Passion Fruit", priceRange: [150, 280], unit: "kg", qtyRange: [10, 40] },
    ],
  },
  {
    slug: "grains-cereals",
    farmerKeys: ["f4", "f5"],
    products: [
      { name: "White Maize", priceRange: [60, 90], unit: "kg", qtyRange: [100, 500] },
      { name: "Rice (Pishori)", priceRange: [140, 200], unit: "kg", qtyRange: [50, 300] },
      { name: "Wheat", priceRange: [70, 110], unit: "kg", qtyRange: [80, 400] },
      { name: "Finger Millet", priceRange: [150, 220], unit: "kg", qtyRange: [20, 100] },
      { name: "Sorghum", priceRange: [80, 130], unit: "kg", qtyRange: [30, 150] },
      { name: "Barley", priceRange: [70, 100], unit: "kg", qtyRange: [40, 200] },
      { name: "Brown Rice", priceRange: [150, 210], unit: "kg", qtyRange: [30, 150] },
      { name: "Yellow Maize", priceRange: [55, 85], unit: "kg", qtyRange: [100, 450] },
    ],
  },
  {
    slug: "tubers-roots",
    farmerKeys: ["f3", "f6", "f9"],
    products: [
      { name: "Irish Potatoes", priceRange: [50, 90], unit: "kg", qtyRange: [60, 300] },
      { name: "Sweet Potatoes", priceRange: [40, 70], unit: "kg", qtyRange: [40, 200] },
      { name: "Cassava", priceRange: [35, 60], unit: "kg", qtyRange: [30, 150] },
      { name: "Arrowroots", priceRange: [80, 130], unit: "kg", qtyRange: [15, 70] },
      { name: "Yams", priceRange: [70, 120], unit: "kg", qtyRange: [15, 60] },
      { name: "Purple Potatoes", priceRange: [60, 100], unit: "kg", qtyRange: [15, 60] },
    ],
  },
  {
    slug: "legumes",
    farmerKeys: ["f5", "f6"],
    products: [
      { name: "Rosecoco Beans", priceRange: [130, 190], unit: "kg", qtyRange: [30, 150] },
      { name: "Green Grams (Ndengu)", priceRange: [150, 220], unit: "kg", qtyRange: [20, 100] },
      { name: "Pigeon Peas", priceRange: [110, 170], unit: "kg", qtyRange: [20, 100] },
      { name: "Groundnuts", priceRange: [160, 240], unit: "kg", qtyRange: [15, 80] },
      { name: "Cowpeas", priceRange: [120, 180], unit: "kg", qtyRange: [15, 80] },
      { name: "Lentils", priceRange: [140, 210], unit: "kg", qtyRange: [15, 70] },
      { name: "Soybeans", priceRange: [110, 160], unit: "kg", qtyRange: [20, 100] },
      { name: "Yellow Beans", priceRange: [120, 180], unit: "kg", qtyRange: [20, 100] },
    ],
  },
  {
    slug: "dairy-eggs",
    farmerKeys: ["f7", "f8"],
    products: [
      { name: "Fresh Milk", priceRange: [60, 85], unit: "litre", qtyRange: [20, 100] },
      { name: "Eggs", priceRange: [380, 480], unit: "tray", qtyRange: [5, 40] },
      { name: "Yoghurt", priceRange: [150, 220], unit: "litre", qtyRange: [10, 40] },
      { name: "Ghee", priceRange: [600, 900], unit: "kg", qtyRange: [5, 20] },
      { name: "Cheese", priceRange: [700, 1000], unit: "kg", qtyRange: [5, 20] },
      { name: "Butter", priceRange: [500, 700], unit: "kg", qtyRange: [5, 25] },
      { name: "Mala (Fermented Milk)", priceRange: [60, 90], unit: "litre", qtyRange: [10, 40] },
      { name: "Fresh Cream", priceRange: [300, 450], unit: "litre", qtyRange: [5, 20] },
    ],
  },
  {
    slug: "poultry-livestock",
    farmerKeys: ["f7", "f8"],
    products: [
      { name: "Kienyeji Chicken", priceRange: [700, 1200], unit: "piece", qtyRange: [10, 50] },
      { name: "Broiler Chicken", priceRange: [500, 800], unit: "piece", qtyRange: [15, 60] },
      { name: "Goat Meat", priceRange: [500, 700], unit: "kg", qtyRange: [10, 40] },
      { name: "Live Goats", priceRange: [6000, 15000], unit: "piece", qtyRange: [3, 15] },
      { name: "Rabbit Meat", priceRange: [600, 900], unit: "kg", qtyRange: [5, 20] },
      { name: "Turkey", priceRange: [1500, 2500], unit: "piece", qtyRange: [3, 15] },
      { name: "Ducks", priceRange: [800, 1300], unit: "piece", qtyRange: [5, 20] },
      { name: "Quail Eggs", priceRange: [200, 350], unit: "tray", qtyRange: [5, 25] },
    ],
  },
  {
    slug: "herbs-spices",
    farmerKeys: ["f9", "f10", "f1"],
    products: [
      { name: "Dhania (Coriander)", priceRange: [20, 40], unit: "bunch", qtyRange: [30, 120] },
      { name: "Chili Peppers", priceRange: [150, 280], unit: "kg", qtyRange: [10, 50] },
      { name: "Ginger", priceRange: [180, 300], unit: "kg", qtyRange: [10, 50] },
      { name: "Garlic", priceRange: [300, 500], unit: "kg", qtyRange: [10, 40] },
      { name: "Mint", priceRange: [20, 40], unit: "bunch", qtyRange: [20, 80] },
      { name: "Turmeric", priceRange: [250, 400], unit: "kg", qtyRange: [8, 35] },
    ],
  },
];

function randomInt(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function describeProduct(name: string, farmName: string, county: string): string {
  return `Fresh ${name.toLowerCase()} grown at ${farmName} in ${county}. Harvested to order and available for direct pickup or delivery.`;
}

async function main() {
  const admin = createAdminClient();
  const farmerIdByKey = new Map<string, string>();
  const farmerProfileIdByKey = new Map<string, string>();

  console.log("Seeding demo farmers…");
  for (const farmer of FARMERS) {
    const email = `${farmer.key}.${farmer.farmName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@${EMAIL_DOMAIN}`;

    const { data: existingUser } = await admin.from("users").select("id").eq("email", email).maybeSingle();
    let userId = existingUser?.id;

    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: {
          role: "farmer",
          name: farmer.name,
          phone: farmer.phone,
          county: farmer.county,
        },
      });
      if (error || !created.user) {
        console.error(`  ✗ Failed to create ${email}:`, error?.message);
        continue;
      }
      userId = created.user.id;
      console.log(`  + Created ${email}`);
    } else {
      console.log(`  = Reusing existing ${email}`);
    }
    farmerIdByKey.set(farmer.key, userId);

    const { data: existingProfile } = await admin
      .from("farmer_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingProfile) {
      farmerProfileIdByKey.set(farmer.key, existingProfile.id);
      continue;
    }

    const { data: profile, error: profileError } = await admin
      .from("farmer_profiles")
      .insert({
        user_id: userId,
        farm_name: farmer.farmName,
        county: farmer.county,
        subcounty: farmer.subcounty,
        farm_description: `${farmer.farmName} is a smallholder farm in ${farmer.subcounty}, ${farmer.county}.`,
        verification_status: "verified",
        verified_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (profileError || !profile) {
      console.error(`  ✗ Failed to create farmer_profiles for ${email}:`, profileError?.message);
      continue;
    }
    farmerProfileIdByKey.set(farmer.key, profile.id);
  }

  console.log("\nSeeding demo buyers…");
  for (const buyer of BUYERS) {
    const email = `${buyer.key}.${buyer.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@${EMAIL_DOMAIN}`;
    const { data: existingUser } = await admin.from("users").select("id").eq("email", email).maybeSingle();
    if (existingUser) {
      console.log(`  = Reusing existing ${email}`);
      continue;
    }
    const { error } = await admin.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { role: "buyer", name: buyer.name, phone: buyer.phone, county: buyer.county },
    });
    if (error) {
      console.error(`  ✗ Failed to create ${email}:`, error.message);
      continue;
    }
    console.log(`  + Created ${email}`);
  }

  console.log("\nSeeding products…");
  const categoryIdBySlug = new Map<string, string>();
  const { data: categoryRows } = await admin.from("categories").select("id, slug");
  for (const row of categoryRows ?? []) categoryIdBySlug.set(row.slug, row.id);

  const report: { category: string; count: number }[] = [];

  for (const category of CATEGORIES) {
    const categoryId = categoryIdBySlug.get(category.slug);
    if (!categoryId) {
      console.error(`  ✗ Category slug "${category.slug}" not found — run migrations first.`);
      continue;
    }

    let createdInCategory = 0;
    let existingInCategory = 0;

    for (const farmerKey of category.farmerKeys) {
      const farmerProfileId = farmerProfileIdByKey.get(farmerKey);
      const farmer = FARMERS.find((f) => f.key === farmerKey);
      if (!farmerProfileId || !farmer) continue;

      const { data: existingProducts } = await admin
        .from("products")
        .select("name")
        .eq("farmer_id", farmerProfileId);
      const existingNames = new Set((existingProducts ?? []).map((p) => p.name));

      for (const template of category.products) {
        if (existingNames.has(template.name)) {
          existingInCategory += 1;
          continue;
        }

        const slug = `${slugifyProductName(template.name)}-${farmerKey}`;
        const price = randomInt(template.priceRange[0], template.priceRange[1]);
        const quantity = randomInt(template.qtyRange[0], template.qtyRange[1]);
        const minOrder = Math.max(1, Math.round(quantity * 0.05));

        const { error } = await admin.from("products").insert({
          farmer_id: farmerProfileId,
          category_id: categoryId,
          name: template.name,
          slug,
          description: describeProduct(template.name, farmer.farmName, farmer.county),
          price,
          price_unit: template.unit,
          quantity_available: quantity,
          quantity_unit: template.unit,
          min_order_quantity: minOrder,
          images: [],
          status: "active",
        });

        if (error) {
          console.error(`  ✗ Failed to create "${template.name}" for ${farmer.farmName}:`, error.message);
          continue;
        }
        createdInCategory += 1;
      }
    }

    console.log(
      `  ${category.slug}: +${createdInCategory} created, ${existingInCategory} already existed`
    );
    const { count } = await admin
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("category_id", categoryId);
    report.push({ category: category.slug, count: count ?? 0 });
  }

  console.log("\n=== Product count per category ===");
  console.log("Category | Product Count");
  for (const row of report) {
    const flag = row.count < 15 ? "  ⚠ below 15" : "";
    console.log(`${row.category} | ${row.count}${flag}`);
  }

  console.log(`\nDemo login password for every seeded account: ${DEMO_PASSWORD}`);
  console.log(
    "No admin account is seeded — promote one demo user manually per docs/SECURITY.md:\n" +
      "  update public.users set role = 'admin' where email = '<demo-email>';"
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
