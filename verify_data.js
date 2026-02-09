import { createClient } from "@supabase/supabase-js";

// Hardcoding for this script to ensure standalone execution without module issues
const supabaseUrl = "https://ncwxsvcqruvmrzcumwww.supabase.co";
const supabaseKey = "sb_publishable_URXvXo0-AhRMCpt5d0jNKQ_UNbjDQmm"; // Public Anon Key from your change

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('Fetching 3 tickets from "ventas"...');

  const { data, error } = await supabase.from("ventas").select("*").limit(3);

  if (error) {
    console.error("Error fetching data:", error.message);
  } else {
    console.log("Successfully fetched data:");
    console.log(JSON.stringify(data, null, 2));
  }
}

verify();
