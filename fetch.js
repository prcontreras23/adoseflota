import { createClient } from '@supabase/supabase-js';

const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) env[parts[0]] = parts.slice(1).join('=');
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    const { data: devs } = await supabase.from('catalogo_dispositivos').select('*');
    const { data: plans } = await supabase.from('planes_claro').select('*');
    console.log("DEVS:", devs);
    console.log("PLANS:", plans);
}
run();
