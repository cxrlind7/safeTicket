import { createClient } from "@supabase/supabase-js";

// Use same config as src/supabase.js
const supabaseUrl = "https://ncwxsvcqruvmrzcumwww.supabase.co";
const supabaseKey = "sb_publishable_URXvXo0-AhRMCpt5d0jNKQ_UNbjDQmm";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFetch() {
  console.log("Attempting to fetch ventas without order...");

  const { data, error } = await supabase.from("ventas").select("*");

  if (error) {
    console.error("Fetch Error:", error);
  } else {
    console.log("Fetch Success. Data length:", data.length);
    if (data.length > 0) {
      console.log("First item keys: ", Object.keys(data[0]));
    }
  }
}

testFetch();
