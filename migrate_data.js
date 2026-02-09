import { createClient } from "@supabase/supabase-js";
import { boletos, horarios, infoDinamica } from "./src/data.js";

// CONFIGURATION
const supabaseUrl = "https://ncwxsvcqruvmrzcumwww.supabase.co";
const supabaseKey = "INSERT_YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE"; // <--- NEEDS SERVICE ROLE KEY

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log("Starting migration...");

  // 1. Migrate Ventas
  console.log("Migrating ventas...");
  const ventas = boletos.ventas.map((v) => ({
    dia: v.dia,
    zona: v.zona,
    precio: v.precio,
    tel: v.tel,
  }));
  const { error: errV } = await supabase.from("ventas").insert(ventas);
  if (errV) console.error("Error migrating ventas:", errV);
  else console.log(`Migrated ${ventas.length} ventas.`);

  // 2. Migrate Cambios
  console.log("Migrating cambios...");
  const cambios = boletos.cambios.map((c) => ({
    busca: c.busca,
    dia_busca: c.dia_busca,
    ofrece: c.ofrece,
    dia_ofrece: c.dia_ofrece,
    tel: c.tel,
  }));
  const { error: errC } = await supabase.from("cambios").insert(cambios);
  if (errC) console.error("Error migrating cambios:", errC);
  else console.log(`Migrated ${cambios.length} cambios.`);

  // 3. Migrate Info Dinámica
  console.log("Migrating info...");
  const info = {
    titulo: infoDinamica.titulo,
    admin_nombre: infoDinamica.admin,
    mensaje: infoDinamica.mensaje,
    reglas: infoDinamica.reglas,
  };
  const { error: errI } = await supabase.from("info_dinamica").insert([info]);
  if (errI) console.error("Error migrating info:", errI);
  else console.log("Migrated info.");

  // 4. Schedules
  // Note: Schedules now need a usuario_id (profile id).
  // We cannot easily migrate these without knowing the User UUIDs from Supabase Auth.
  // Requires users to be created first.
  console.log(
    "Skipping schedules migration. Please create users and assign schedules manually or update this script with User UUIDs.",
  );
}

migrate();
