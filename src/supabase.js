import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ncwxsvcqruvmrzcumwww.supabase.co";
const supabaseKey = "sb_publishable_URXvXo0-AhRMCpt5d0jNKQ_UNbjDQmm"; // <--- REPLACE THIS WITH THE KEY FROM YOUR DASHBOARD

export const supabase = createClient(supabaseUrl, supabaseKey);
