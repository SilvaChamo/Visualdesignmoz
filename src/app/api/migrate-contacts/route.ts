import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST() {
    try {
        // Buscar todos os contatos que não têm panel: 'client'
        const { data: allContacts, error: fetchError } = await supabaseAdmin
            .from('newsletter_subscribers')
            .select('*')

        if (fetchError) {
            console.error('Erro ao buscar contatos:', fetchError)
            return NextResponse.json({ error: fetchError.message }, { status: 500 })
        }

        // Filtrar contatos que precisam de migração (sem panel: 'client')
        const contactsToMigrate = allContacts?.filter((contact: any) => {
            const metadata = contact.metadata || {}
            return metadata.panel !== 'client'
        }) || []

        if (contactsToMigrate.length === 0) {
            return NextResponse.json({ 
                message: 'Nenhum contato precisa de migração',
                migrated: 0,
                total: allContacts?.length || 0
            })
        }

        // Migrar contatos - adicionar panel: 'client'
        let migrated = 0
        let errors = 0

        for (const contact of contactsToMigrate) {
            try {
                const currentMetadata = contact.metadata || {}
                
                // Preservar dados existentes e adicionar panel: 'client'
                const newMetadata = {
                    ...currentMetadata,
                    panel: 'client'
                }

                const { error: updateError } = await supabaseAdmin
                    .from('newsletter_subscribers')
                    .update({ metadata: newMetadata })
                    .eq('id', contact.id)

                if (updateError) {
                    console.error(`Erro ao migrar contato ${contact.email}:`, updateError)
                    errors++
                } else {
                    migrated++
                }
            } catch (err) {
                console.error(`Erro ao processar contato ${contact.email}:`, err)
                errors++
            }
        }

        return NextResponse.json({
            message: `Migração concluída: ${migrated} contatos migrados, ${errors} erros`,
            migrated,
            errors,
            total: allContacts?.length || 0,
            toMigrate: contactsToMigrate.length
        })

    } catch (error: any) {
        console.error('Erro na migração:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
