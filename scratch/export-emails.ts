
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://oaqvixsodmxvlyoivpzh.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hcXZpeHNvZG14dmx5b2l2cHpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTAxMDI3OCwiZXhwIjoyMDUwNTg2Mjc4fQ.E9IisQ-qG2u-lFz6Y392Qo6n1Lp9n9tP-U9_Uv0_Uv8";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const decryptPassword = (text: string) => {
    if (!text) return '(sem senha)';
    try {
        return Buffer.from(text, 'base64').toString('utf8');
    } catch (e) {
        return '(erro ao decifrar)';
    }
}

async function listAll() {
    console.log("--- LISTA DE EMAILS E SENHAS (SUPABASE) ---");
    try {
        const { data, error } = await supabaseAdmin
            .from('email_contas')
            .select('email, senha_cyberpanel')
            .order('email');

        if (error) throw error;

        console.log(`Total de contas: ${data.length}`);
        console.log("--------------------------------------------------");
        console.log("EMAIL | PASSWORD");
        console.log("--------------------------------------------------");
        
        data.forEach(item => {
            const pass = decryptPassword(item.senha_cyberpanel);
            console.log(`${item.email} | ${pass}`);
        });
        console.log("--------------------------------------------------");
    } catch (e) {
        console.error("ERRO:", e);
    }
}

listAll().catch(console.error);
