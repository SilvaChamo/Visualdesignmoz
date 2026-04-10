const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({path: '.env.local'})
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
s.from('newsletter_subscribers').select('*').limit(10).then(r => console.log(JSON.stringify(r.data, null, 2)))
