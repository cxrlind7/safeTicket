import { createClient } from "@supabase/supabase-js";

// Use same config as src/supabase.js
const supabaseUrl = "https://ncwxsvcqruvmrzcumwww.supabase.co";
const supabaseKey = "sb_publishable_URXvXo0-AhRMCpt5d0jNKQ_UNbjDQmm";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFetch() {
  console.log("Attempting to fetch changes...");

  const { data, error } = await supabase
    .from("cambios")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch Error:", error);
  } else {
    console.log("Fetch Success. Data length:", data.length);
    console.log("First item:", data[0]);
  }
}

testFetch();
